import { and, count, eq, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { playerAmendments, players } from '#/db/schema'
import type { AvatarStore } from '#/claims/avatar'
import { deleteAvatarsIfUnreferenced } from '#/claims/avatar'
import { writeAudit } from '#/admin/audit'

/* The shadow: a proposed change to a claimed Player's profile waits for a
   Moderator while its owner — and only its owner — is served it everywhere.
   Approved values stay on `players`, so the published row is always the safe
   row and a call site that forgets the viewer serves the reviewed value. */

export type AmendmentField = 'avatar'

/** What a signed-in viewer is owed on top of the published rows. Resolved once
    per request: a User holds at most one Claim, so there is at most one pending
    value to overlay and never a per-row join. */
export interface AmendmentViewer {
  userId: string
  pendingAvatarKey: string
}

/** 10 changes per User per rolling hour, counted across the whole profile
    rather than per field — the eleventh in an hour is a script whichever field
    it touches. A cost and scripting guard, explicitly not a signal about the
    submitter: nothing reads it and nothing escalates off it. */
export const AMENDMENT_HOURLY_LIMIT = 10

/** The viewer's own pending value, or null when they have none. Joined to
    ownership, so a proposal left on a Player whose Claim has since moved can
    never overlay the Player they hold now. */
export async function loadAmendmentViewer(
  db: Db,
  userId: string,
): Promise<AmendmentViewer | null> {
  const pending = (
    await db
      .select({ value: playerAmendments.value })
      .from(playerAmendments)
      .innerJoin(players, eq(players.id, playerAmendments.playerId))
      .where(
        and(
          eq(playerAmendments.submittedBy, userId),
          eq(playerAmendments.field, 'avatar'),
          eq(playerAmendments.state, 'pending'),
          eq(players.userId, userId),
        ),
      )
      .limit(1)
  ).at(0)
  return pending ? { userId, pendingAvatarKey: pending.value } : null
}

/** Record a proposal, superseding the owner's own live one — queueing would
    make a Moderator reach one outcome through N reviews, and refusing would be
    feedback, which is the one thing the shadow cannot give. Returns the value
    it displaced so the caller can clean the object up after committing.

    Runs inside the caller's transaction, which must already hold the Player
    row: that lock, not the partial unique index, is what serialises two
    submits — the index is the backstop. */
export async function submitAmendment(
  tx: Db,
  input: {
    playerId: number
    field: AmendmentField
    value: string
    userId: string
  },
): Promise<{ supersededValue: string | null }> {
  await assertSubmitBudget(tx, input.userId)
  const superseded = (
    await tx
      .update(playerAmendments)
      .set({ state: 'superseded' })
      .where(
        and(
          eq(playerAmendments.playerId, input.playerId),
          eq(playerAmendments.field, input.field),
          eq(playerAmendments.state, 'pending'),
        ),
      )
      .returning({ value: playerAmendments.value })
  ).at(0)
  await tx.insert(playerAmendments).values({
    playerId: input.playerId,
    field: input.field,
    value: input.value,
    submittedBy: input.userId,
  })
  return { supersededValue: superseded?.value ?? null }
}

/** Superseded rows count: the guard counts submissions, not survivors. */
async function assertSubmitBudget(tx: Db, userId: string): Promise<void> {
  const [{ recent }] = await tx
    .select({ recent: count() })
    .from(playerAmendments)
    .where(
      and(
        eq(playerAmendments.submittedBy, userId),
        sql`${playerAmendments.submittedAt} >= now() - interval '1 hour'`,
      ),
    )
  if (recent >= AMENDMENT_HOURLY_LIMIT) {
    throw new Error('Too many changes just now — try again shortly.')
  }
}

/** Close every live proposal on a Player, without a decision: `withdrawn` when
    the Claim behind it ends (`rejected` would inflate the count a Moderator
    reads), `superseded` when the owner's own later act overtakes it. Returns
    the dereferenced values for post-commit cleanup. */
export async function closePendingAmendments(
  tx: Db,
  playerId: number,
  state: 'withdrawn' | 'superseded',
): Promise<string[]> {
  const closed = await tx
    .update(playerAmendments)
    .set({ state })
    .where(
      and(
        eq(playerAmendments.playerId, playerId),
        eq(playerAmendments.state, 'pending'),
      ),
    )
    .returning({ value: playerAmendments.value })
  return closed.map((row) => row.value)
}

/** Promote a proposal to the published row — pure metadata, nothing is moved
    or re-encoded; the bytes have been in place since the upload. This is where
    an Avatar is *replaced* now, so it is where the replaced object is deleted,
    or nothing would ever collect it. */
export async function approveAmendment(
  db: Db,
  store: AvatarStore | null,
  actorId: string,
  amendmentId: number,
): Promise<{ resolved: boolean }> {
  return resolveAmendment(db, store, actorId, amendmentId, {
    state: 'approved',
    reason: null,
  })
}

/** Refuse a proposal. `players.avatarKey` is never touched — refusing a change
    is not removing what is already published — and the proposed object is
    deleted, so a rejected image cannot be looked at twice. The reason text is
    the entire record. */
export async function rejectAmendment(
  db: Db,
  store: AvatarStore | null,
  actorId: string,
  amendmentId: number,
  reason?: string,
): Promise<{ resolved: boolean }> {
  return resolveAmendment(db, store, actorId, amendmentId, {
    state: 'rejected',
    reason: reason?.trim() || null,
  })
}

async function resolveAmendment(
  db: Db,
  store: AvatarStore | null,
  actorId: string,
  amendmentId: number,
  decision: { state: 'approved' | 'rejected'; reason: string | null },
): Promise<{ resolved: boolean }> {
  const outcome = await db.transaction(async (tx) => {
    const claimed = (
      await tx
        .select({
          playerId: playerAmendments.playerId,
          userId: players.userId,
          avatarKey: players.avatarKey,
          submittedBy: playerAmendments.submittedBy,
          value: playerAmendments.value,
        })
        .from(playerAmendments)
        .innerJoin(players, eq(players.id, playerAmendments.playerId))
        .where(
          and(
            eq(playerAmendments.id, amendmentId),
            eq(playerAmendments.state, 'pending'),
          ),
        )
        // Both rows: the proposal is what two Moderators race for, and locking
        // only the Player would let the loser read a stale `pending`.
        .for('update')
    ).at(0)
    // Already resolved (or never pending): a benign no-op, not a write — the
    // other Moderator's decision stands.
    if (!claimed) return { applied: false, keys: [] }

    // Deleting an auth User nulls players.user_id by FK without running
    // unclaim(), so a live proposal can outlive the Claim it belonged to. It
    // is the system's to close, not a Moderator's to decide.
    if (claimed.userId == null || claimed.userId !== claimed.submittedBy) {
      const keys = await closePendingAmendments(
        tx,
        claimed.playerId,
        'withdrawn',
      )
      return { applied: false, keys }
    }

    // The compare-and-set proper: the state predicate is on the WRITE, so a
    // decision that lost the race changes nothing, whatever the read saw.
    const decided = await tx
      .update(playerAmendments)
      .set({
        state: decision.state,
        reason: decision.reason,
        reviewedAt: new Date(),
        reviewedBy: actorId,
      })
      .where(
        and(
          eq(playerAmendments.id, amendmentId),
          eq(playerAmendments.state, 'pending'),
        ),
      )
      .returning({ id: playerAmendments.id })
    if (decided.length === 0) return { applied: false, keys: [] }
    if (decision.state === 'rejected') {
      await writeAudit(tx, {
        actorId,
        action: 'player.reject_amendment',
        entity: 'player',
        entityId: claimed.playerId,
        // The reason lives on the amendment row: one source of truth, and one
        // that a per-player query reads.
        diff: { context: { amendmentId, field: 'avatar' } },
      })
      return { applied: true, keys: [claimed.value] }
    }
    await tx
      .update(players)
      .set({ avatarKey: claimed.value })
      .where(eq(players.id, claimed.playerId))
    await writeAudit(tx, {
      actorId,
      action: 'player.approve_amendment',
      entity: 'player',
      entityId: claimed.playerId,
      diff: {
        before: { avatarKey: claimed.avatarKey },
        after: { avatarKey: claimed.value },
        context: { amendmentId, field: 'avatar' },
      },
    })
    return {
      applied: true,
      keys:
        claimed.avatarKey && claimed.avatarKey !== claimed.value
          ? [claimed.avatarKey]
          : [],
    }
  })
  await deleteAvatarsIfUnreferenced(db, store, outcome.keys)
  return { resolved: outcome.applied }
}
