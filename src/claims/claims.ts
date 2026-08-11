import { and, asc, count, desc, eq, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '#/db'
import { playerAliases, playerClaims, players, profiles } from '#/db/schema'
import { writeAudit } from '#/admin/audit'
import type { AvatarStore } from '#/claims/avatar'
import {
  deleteAvatarIfUnreferenced,
  deleteAvatarsIfUnreferenced,
  seedAvatar,
} from '#/claims/avatar'
import { closePendingAmendments } from '#/claims/amendments'
import { MAX_NOTE_LENGTH } from '#/claims/limits'
import { ADMIN_PAGE_SIZE } from '#/lib/paging'
import { optionalNote, requiredReason } from '#/claims/validate'

/* The claim lifecycle. Approving consumes the request (players.user_id is the
   durable link); a denial is kept, and that is what refuses the second ask. */

/** Where a (User, Player) pair stands, from the requester's side. */
export type ViewerClaimState = 'none' | 'pending' | 'denied'

export interface ClaimRequestInput {
  note?: string | null
  /** The provider picture to seed, or null for the Medallion. */
  seedAvatarUrl?: string | null
}

/** File a claim request. A User holds one thing at a time: one approved Claim
    or one pending request, and never a twice-asked denial. */
export async function requestClaim(
  db: Db,
  userId: string,
  playerId: number,
  input: ClaimRequestInput,
): Promise<{ id: number }> {
  const note = input.note?.trim() || null
  if (note && note.length > MAX_NOTE_LENGTH) {
    throw new Error(`Keep the note to at most ${MAX_NOTE_LENGTH} characters`)
  }
  const seedAvatarUrl = input.seedAvatarUrl?.trim() || null
  return db.transaction(async (tx) => {
    await lockClaimant(tx, userId)
    const player = (
      await tx
        .select({
          userId: players.userId,
          mergedInto: players.mergedInto,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    if (!player) throw new Error(`Unknown player ${playerId}`)
    if (player.mergedInto != null) {
      throw new Error('This player was merged — claim the surviving player')
    }
    if (player.userId != null) {
      throw new Error(
        player.userId === userId
          ? 'You already hold this claim'
          : 'This player is already claimed',
      )
    }
    const held = (
      await tx
        .select({ displayName: players.displayName })
        .from(players)
        .where(eq(players.userId, userId))
        .limit(1)
    ).at(0)
    if (held) {
      throw new Error(
        `You already hold the claim on ${held.displayName}. A claim is permanent — a moderator has to revoke it before you can claim another player`,
      )
    }
    const existing = (
      await tx
        .select({ state: playerClaims.state })
        .from(playerClaims)
        .where(
          and(
            eq(playerClaims.userId, userId),
            eq(playerClaims.playerId, playerId),
          ),
        )
    ).at(0)
    if (existing) {
      throw new Error(
        existing.state === 'denied' ? DENIED_ALREADY : PENDING_HERE,
      )
    }
    const elsewhere = (
      await tx
        .select({ id: playerClaims.id })
        .from(playerClaims)
        .where(
          and(
            eq(playerClaims.userId, userId),
            eq(playerClaims.state, 'pending'),
            ne(playerClaims.playerId, playerId),
          ),
        )
        .limit(1)
    ).at(0)
    if (elsewhere) throw new Error(PENDING_ELSEWHERE)
    try {
      return (
        await tx
          .insert(playerClaims)
          .values({ playerId, userId, note, seedAvatarUrl })
          .returning({ id: playerClaims.id })
      )[0]
    } catch (error) {
      // The checks above lose to a concurrent request; the indexes don't.
      throw refusalForCollision(error)
    }
  })
}

/** Serialises a request against an approval of the same User — the half no
    index can hold. Taken BEFORE any players lock, or the two deadlock. */
async function lockClaimant(tx: Db, userId: string): Promise<void> {
  const locked = await tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .for('update')
  // A missing row locks nothing and raises nothing — silence, not safety.
  if (locked.length === 0) {
    throw new Error('Finish signing in before claiming a player')
  }
}

/* Claim requests are not shadowed — unlike an Amendment, a refusal here says
   exactly what it is. */
const PENDING_HERE = 'You already have a pending claim request on this player'
const PENDING_ELSEWHERE =
  'You already have a claim request awaiting review — one at a time'
const DENIED_ALREADY =
  'This request was denied. Ask a moderator on Discord if that was a mistake'

function refusalForCollision(error: unknown): Error {
  const text = String((error as { cause?: unknown }).cause ?? error)
  if (text.includes('claim_one_pending_uq')) return new Error(PENDING_ELSEWHERE)
  if (text.includes('claim_user_player_uq')) return new Error(PENDING_HERE)
  return error instanceof Error ? error : new Error(String(error))
}

/** Whether this User is already spoken for — one Claim held, or one request
    waiting. Either way there is nothing to offer them on another Player. */
export async function viewerIsCommitted(
  db: Db,
  userId: string,
): Promise<boolean> {
  const holds = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.userId, userId))
    .limit(1)
  if (holds.length > 0) return true
  const waiting = await db
    .select({ id: playerClaims.id })
    .from(playerClaims)
    .where(
      and(eq(playerClaims.userId, userId), eq(playerClaims.state, 'pending')),
    )
    .limit(1)
  return waiting.length > 0
}

/** Which of the three the panel shows: the CTA, the pending note, the denied
    note. A denial is a fact about the pair, not a queue entry. */
export async function viewerClaimState(
  db: Db,
  userId: string,
  playerId: number,
): Promise<ViewerClaimState> {
  const row = (
    await db
      .select({ state: playerClaims.state })
      .from(playerClaims)
      .where(
        and(
          eq(playerClaims.userId, userId),
          eq(playerClaims.playerId, playerId),
        ),
      )
      .limit(1)
  ).at(0)
  if (!row) return 'none'
  return row.state === 'denied' ? 'denied' : 'pending'
}

/** Approve a pending claim: link the User, seed the avatar if they asked for it
    and the Moderator accepted it, and clear every pending request on that
    Player (the winner and the losers). Denied rows on that Player survive it —
    approving is not an amnesty. The seed is a second, independent decision:
    `acceptSeed: false` links the User onto the Medallion, and can only ever
    refuse the picture the request already carried. */
export async function approveClaim(
  db: Db,
  store: AvatarStore | null,
  actorId: string,
  claimId: number,
  opts: { fetchImpl?: typeof fetch; acceptSeed?: boolean } = {},
): Promise<{ playerId: number; avatarSeeded: boolean }> {
  const claim = (
    await db
      .select({
        playerId: playerClaims.playerId,
        userId: playerClaims.userId,
        seedAvatarUrl: playerClaims.seedAvatarUrl,
        state: playerClaims.state,
      })
      .from(playerClaims)
      .where(eq(playerClaims.id, claimId))
  ).at(0)
  if (!claim) throw new Error(`Unknown claim ${claimId}`)
  if (claim.state !== 'pending')
    throw new Error('This claim was already resolved')

  // Mirror the avatar BEFORE the transaction so a 15s fetch never holds the
  // player row locked; the object is cleaned up if the write below fails.
  const avatarKey =
    store && claim.seedAvatarUrl && opts.acceptSeed !== false
      ? await seedAvatar(
          store,
          claim.playerId,
          claim.seedAvatarUrl,
          opts.fetchImpl ?? fetch,
        )
      : null

  let staleKeys: string[] = []
  try {
    staleKeys = await db.transaction(async (tx) => {
      await lockClaimant(tx, claim.userId)
      const player = (
        await tx
          .select({
            userId: players.userId,
            mergedInto: players.mergedInto,
            avatarKey: players.avatarKey,
          })
          .from(players)
          .where(eq(players.id, claim.playerId))
          .for('update')
      ).at(0)
      if (!player) throw new Error('Unknown player')
      if (player.mergedInto != null) throw new Error('This player was merged')
      if (player.userId != null) {
        throw new Error(
          player.userId === claim.userId
            ? 'This player is already claimed by this user'
            : 'This player is already claimed by someone else',
        )
      }
      // Guard a concurrent resolve of the same claim.
      const stillPending = (
        await tx
          .select({ id: playerClaims.id })
          .from(playerClaims)
          .where(
            and(
              eq(playerClaims.id, claimId),
              eq(playerClaims.state, 'pending'),
            ),
          )
      ).at(0)
      if (!stillPending) throw new Error('This claim was already resolved')

      // A fresh owner gets a fresh identity: seed or Medallion, no country, and
      // nothing a previous holder proposed. Deleting an auth user nulls user_id
      // by FK without running unclaim(), so this is the only thing standing
      // between that row and its next claimant.
      const orphaned = await closePendingAmendments(
        tx,
        claim.playerId,
        'withdrawn',
      )
      await tx
        .update(players)
        .set({ userId: claim.userId, avatarKey, countryCode: null })
        .where(eq(players.id, claim.playerId))
      // The winner's row and the losers'. Pending only: a denial is a
      // decision, and it outlives whoever wins the page.
      await tx
        .delete(playerClaims)
        .where(
          and(
            eq(playerClaims.playerId, claim.playerId),
            eq(playerClaims.state, 'pending'),
          ),
        )
      await writeAudit(tx, {
        actorId,
        action: 'player.approve_claim',
        entity: 'player',
        entityId: claim.playerId,
        diff: {
          after: { userId: claim.userId },
          context: { claimId, avatarSeeded: avatarKey != null },
        },
      })
      // The prior owner's object and anything they left proposed are now
      // unreferenced (keys are per-player).
      return player.avatarKey && player.avatarKey !== avatarKey
        ? [...orphaned, player.avatarKey]
        : orphaned
    })
  } catch (error) {
    // Roll back the just-seeded object — but never one a concurrent approval
    // already committed and referenced (content-addressed keys can collide).
    if (avatarKey && store)
      await deleteAvatarIfUnreferenced(db, store, avatarKey)
    throw error
  }
  // Same collision guard on the prior owner's objects: a concurrent re-seed of
  // the identical image could have re-referenced the same content-hash key.
  await deleteAvatarsIfUnreferenced(db, store, staleKeys)
  return { playerId: claim.playerId, avatarSeeded: avatarKey != null }
}

/** Deny a claim request — the row is KEPT, marked denied, and that memory is
    what refuses the same ask forever. Locks the player row so a deny
    serialises with a concurrent approve. */
export async function denyClaim(
  db: Db,
  actorId: string,
  claimId: number,
  reason?: string,
): Promise<void> {
  const recorded = optionalNote(reason)?.trim() || null
  return db.transaction(async (tx) => {
    const claim = (
      await tx
        .select({
          playerId: playerClaims.playerId,
          userId: playerClaims.userId,
        })
        .from(playerClaims)
        .where(eq(playerClaims.id, claimId))
    ).at(0)
    if (!claim) throw new Error(`Unknown claim ${claimId}`)
    await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, claim.playerId))
      .for('update')
    // A concurrent approve may have consumed the row since the read above.
    const denied = await tx
      .update(playerClaims)
      .set({
        state: 'denied',
        decidedBy: actorId,
        decidedAt: new Date(),
        decidedReason: recorded,
      })
      .where(
        and(eq(playerClaims.id, claimId), eq(playerClaims.state, 'pending')),
      )
      .returning({ id: playerClaims.id })
    if (denied.length === 0) throw new Error('This claim was already resolved')
    await writeAudit(tx, {
      actorId,
      action: 'player.deny_claim',
      entity: 'player',
      entityId: claim.playerId,
      diff: { context: { claimId, userId: claim.userId, reason: recorded } },
    })
  })
}

/** Forgive a denial made for something fixable — a useless note, the wrong
    Player picked by accident — re-opening that (User, Player) pair. */
export async function clearClaimDenial(
  db: Db,
  actorId: string,
  claimId: number,
): Promise<void> {
  return db.transaction(async (tx) => {
    const claim = (
      await tx
        .select({
          playerId: playerClaims.playerId,
          userId: playerClaims.userId,
          note: playerClaims.note,
          state: playerClaims.state,
        })
        .from(playerClaims)
        .where(eq(playerClaims.id, claimId))
        .for('update')
    ).at(0)
    if (!claim) throw new Error(`Unknown claim ${claimId}`)
    if (claim.state !== 'denied') {
      throw new Error('Only a denied request can be cleared')
    }
    await tx.delete(playerClaims).where(eq(playerClaims.id, claimId))
    await writeAudit(tx, {
      actorId,
      action: 'player.clear_denial',
      entity: 'player',
      entityId: claim.playerId,
      diff: { before: { userId: claim.userId, note: claim.note } },
    })
  })
}

/** THE single path back to accountless: link, Avatar, Country and any
    Amendment in flight all go, or a value left behind resurrects on the next
    claim. A pending Amendment is written `withdrawn`, never `rejected`:
    nothing about it was refused, and inflating the rejection count would show
    a Moderator "3 rejected" for someone never rejected once. */
async function unclaim(
  db: Db,
  store: AvatarStore | null,
  playerId: number,
  audit: { actorId: string; reason: string },
): Promise<void> {
  const staleKeys = await db.transaction(async (tx) => {
    const player = (
      await tx
        .select({
          userId: players.userId,
          avatarKey: players.avatarKey,
          countryCode: players.countryCode,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    if (!player) throw new Error(`Unknown player ${playerId}`)
    if (player.userId == null) throw new Error('This player is not claimed')
    const withdrawn = await closePendingAmendments(tx, playerId, 'withdrawn')
    await tx
      .update(players)
      .set({ userId: null, avatarKey: null, countryCode: null })
      .where(eq(players.id, playerId))
    await writeAudit(tx, {
      actorId: audit.actorId,
      action: 'player.revoke_claim',
      entity: 'player',
      entityId: playerId,
      diff: {
        before: {
          userId: player.userId,
          avatarKey: player.avatarKey,
          countryCode: player.countryCode,
        },
        context: { reason: audit.reason },
      },
    })
    return player.avatarKey ? [...withdrawn, player.avatarKey] : withdrawn
  })
  // After commit, and only if a concurrent re-claim hasn't taken the key.
  await deleteAvatarsIfUnreferenced(db, store, staleKeys)
}

/** A moderator severs a Claim. It frees the Player, not the User: a revoked
    User may ask again, and a denial is what makes a refusal permanent. */
export async function revokeClaim(
  db: Db,
  store: AvatarStore | null,
  actorId: string,
  playerId: number,
  reason: string,
): Promise<void> {
  return unclaim(db, store, playerId, {
    actorId,
    reason: requiredReason(reason),
  })
}

/** One row of either moderator list; the decided_* pair is null while pending. */
export interface ClaimQueueRow {
  id: number
  playerId: number
  playerSlug: string
  playerDisplayName: string
  aliases: string[]
  note: string | null
  /** The picture itself, not a boolean: no Moderator can judge an image they
      have not been shown. Null is the Medallion. /admin-gated. */
  seedAvatarUrl: string | null
  requesterHandle: string | null
  requesterDiscordId: string | null
  createdAt: Date | null
  decidedByHandle: string | null
  decidedAt: Date | null
  decidedReason: string | null
}

const decider = alias(profiles, 'decider')

/** Both moderator lists are the same row shape: the request with the
    requester's Discord identity next to the Player's name + aliases. */
function claimQueueSelect(db: Db) {
  return db
    .select({
      id: playerClaims.id,
      playerId: playerClaims.playerId,
      playerSlug: players.slug,
      playerDisplayName: players.displayName,
      aliases: sql<
        string[]
      >`coalesce(array_agg(distinct ${playerAliases.name}) filter (where ${playerAliases.name} is not null), '{}')`,
      note: playerClaims.note,
      seedAvatarUrl: playerClaims.seedAvatarUrl,
      requesterHandle: profiles.handle,
      requesterDiscordId: profiles.discordId,
      createdAt: playerClaims.createdAt,
      decidedByHandle: decider.handle,
      decidedAt: playerClaims.decidedAt,
      decidedReason: playerClaims.decidedReason,
    })
    .from(playerClaims)
    .innerJoin(players, eq(players.id, playerClaims.playerId))
    .leftJoin(playerAliases, eq(playerAliases.playerId, playerClaims.playerId))
    .leftJoin(profiles, eq(profiles.id, playerClaims.userId))
    .leftJoin(decider, eq(decider.id, playerClaims.decidedBy))
    .groupBy(
      playerClaims.id,
      players.slug,
      players.displayName,
      profiles.handle,
      profiles.discordId,
      decider.handle,
    )
}

/** The work actually waiting on a moderator, oldest first. Denied rows are
    kept forever, so this must ask for pending — they are not work. */
export async function listPendingClaims(db: Db): Promise<ClaimQueueRow[]> {
  return claimQueueSelect(db)
    .where(eq(playerClaims.state, 'pending'))
    .orderBy(asc(playerClaims.createdAt), asc(playerClaims.id))
}

/** The other half of the one number on the Review tab. */
export async function countPendingClaims(db: Db): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(playerClaims)
    .where(eq(playerClaims.state, 'pending'))
  return pending
}

/** The denials, most recent first. The pending queue drains; this only ever
    grows, so it pages — every denial has to stay reachable to be cleared. */
export async function listDeniedClaims(
  db: Db,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: ClaimQueueRow[]; hasMore: boolean }> {
  const limit = opts.limit ?? ADMIN_PAGE_SIZE
  const rows = await claimQueueSelect(db)
    .where(eq(playerClaims.state, 'denied'))
    .orderBy(desc(playerClaims.decidedAt), desc(playerClaims.id))
    .limit(limit + 1)
    .offset(opts.offset ?? 0)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}
