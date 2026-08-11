import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { playerAmendments, players, profiles } from '#/db/schema'
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

/** A refusal this Player already collected. Four rejections mean nothing until
    you can see that they were all *blurry* rather than all *hateful*. */
export interface AmendmentRejection {
  reason: string | null
  reviewedAt: Date | null
}

/** One row of the Moderator's amendments panel: the proposal, what it would
    displace, and the history that makes a refusal mean something. */
export interface AmendmentQueueRow {
  id: number
  playerId: number
  playerDisplayName: string
  field: AmendmentField
  value: string
  /** What is live now for this field — null is the Medallion, not an absence. */
  publishedValue: string | null
  submittedAt: Date
  submitterHandle: string | null
  priorRejections: AmendmentRejection[]
}

/** The proposals waiting on a Moderator, oldest first ACROSS fields: the unit
    of work is one thing awaiting them, and a panel per field lets a whole pile
    age unseen behind another. */
export async function listPendingAmendments(
  db: Db,
): Promise<AmendmentQueueRow[]> {
  const rows = await db
    .select({
      id: playerAmendments.id,
      playerId: playerAmendments.playerId,
      playerDisplayName: players.displayName,
      field: playerAmendments.field,
      value: playerAmendments.value,
      // The published column for this row's field. A second field selects its
      // own here, keyed the way the renderer is.
      publishedValue: players.avatarKey,
      submittedAt: playerAmendments.submittedAt,
      submitterHandle: profiles.handle,
    })
    .from(playerAmendments)
    .innerJoin(players, eq(players.id, playerAmendments.playerId))
    .leftJoin(profiles, eq(profiles.id, playerAmendments.submittedBy))
    .where(eq(playerAmendments.state, 'pending'))
    .orderBy(asc(playerAmendments.submittedAt), asc(playerAmendments.id))
  return withPriorRejections(db, rows)
}

/** Only `rejected` counts: a `withdrawn` or `superseded` row was never refused,
    and counting it would show a Moderator a history nobody wrote. */
async function withPriorRejections<T extends { playerId: number }>(
  db: Db,
  rows: T[],
): Promise<(T & { priorRejections: AmendmentRejection[] })[]> {
  if (rows.length === 0) return []
  const refusals = await db
    .select({
      playerId: playerAmendments.playerId,
      reason: playerAmendments.reason,
      reviewedAt: playerAmendments.reviewedAt,
    })
    .from(playerAmendments)
    .where(
      and(
        inArray(playerAmendments.playerId, [
          ...new Set(rows.map((row) => row.playerId)),
        ]),
        eq(playerAmendments.state, 'rejected'),
      ),
    )
    .orderBy(desc(playerAmendments.reviewedAt), desc(playerAmendments.id))
  const byPlayer = new Map<number, AmendmentRejection[]>()
  for (const { playerId, ...rejection } of refusals) {
    byPlayer.set(playerId, [...(byPlayer.get(playerId) ?? []), rejection])
  }
  return rows.map((row) => ({
    ...row,
    priorRejections: byPlayer.get(row.playerId) ?? [],
  }))
}

/** Half of the one number on the Review tab. */
export async function countPendingAmendments(db: Db): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(playerAmendments)
    .where(eq(playerAmendments.state, 'pending'))
  return pending
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
    // The Player first, then the proposal — the order every owner-side write
    // takes. Taking them the other way round is what deadlocks a Moderator's
    // decision against the holder's next upload.
    const target = (
      await tx
        .select({ playerId: playerAmendments.playerId })
        .from(playerAmendments)
        .where(eq(playerAmendments.id, amendmentId))
    ).at(0)
    if (!target) return { applied: false, keys: [] }
    const player = (
      await tx
        .select({ userId: players.userId, avatarKey: players.avatarKey })
        .from(players)
        .where(eq(players.id, target.playerId))
        .for('update')
    ).at(0)
    if (!player) return { applied: false, keys: [] }

    const claimed = (
      await tx
        .select({
          playerId: playerAmendments.playerId,
          submittedBy: playerAmendments.submittedBy,
          value: playerAmendments.value,
        })
        .from(playerAmendments)
        .where(
          and(
            eq(playerAmendments.id, amendmentId),
            eq(playerAmendments.state, 'pending'),
          ),
        )
        // The proposal is what two Moderators race for, so it is locked too.
        .for('update')
    ).at(0)
    // Already resolved (or never pending): a benign no-op, not a write — the
    // other Moderator's decision stands.
    if (!claimed) return { applied: false, keys: [] }

    // Deleting an auth User nulls players.user_id by FK without running
    // unclaim(), so a live proposal can outlive the Claim it belonged to. It
    // is the system's to close, not a Moderator's to decide.
    if (player.userId == null || player.userId !== claimed.submittedBy) {
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
        before: { avatarKey: player.avatarKey },
        after: { avatarKey: claimed.value },
        context: { amendmentId, field: 'avatar' },
      },
    })
    return {
      applied: true,
      keys:
        player.avatarKey && player.avatarKey !== claimed.value
          ? [player.avatarKey]
          : [],
    }
  })
  await deleteAvatarsIfUnreferenced(db, store, outcome.keys)
  return { resolved: outcome.applied }
}
