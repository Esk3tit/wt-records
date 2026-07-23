import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { playerAliases, playerClaims, players, profiles } from '#/db/schema'
import type { Storage } from '#/storage/r2'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import { RASTER_IMAGE_CONTENT_TYPES } from '#/storage/image-types'
import { playerAvatarKey } from '#/storage/avatar-key'
import { MAX_NOTE_LENGTH } from '#/claims/limits'

/* The claim lifecycle. A pending Claim is the whole player_claims row: it lives
   only until a moderator resolves it, at which point the row is deleted and the
   durable link is players.user_id. There is no audit trail in v1 (ADR 0010). */

type AvatarStore = Pick<Storage, 'put' | 'delete'>

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export interface ClaimRequestInput {
  note?: string | null
  /** The provider picture to seed, or null for the Medallion. */
  seedAvatarUrl?: string | null
}

/** File a pending claim (User → Player). Refused when the player is merged or
    already claimed; one pending request per (user, player). */
export async function requestClaim(
  db: Db,
  userId: string,
  playerId: number,
  input: ClaimRequestInput,
): Promise<{ id: number }> {
  const note = input.note?.trim() || null
  if (note && note.length > MAX_NOTE_LENGTH) {
    throw new Error(`Keep the note under ${MAX_NOTE_LENGTH} characters`)
  }
  const seedAvatarUrl = input.seedAvatarUrl?.trim() || null
  return db.transaction(async (tx) => {
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
    const row = (
      await tx
        .insert(playerClaims)
        .values({ playerId, userId, note, seedAvatarUrl })
        .onConflictDoNothing({
          target: [playerClaims.userId, playerClaims.playerId],
        })
        .returning({ id: playerClaims.id })
    ).at(0)
    if (!row) throw new Error('You already have a pending claim on this player')
    return row
  })
}

/** Whether this User has a pending claim on this Player (drives the CTA state). */
export async function viewerHasPendingClaim(
  db: Db,
  userId: string,
  playerId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: playerClaims.id })
    .from(playerClaims)
    .where(
      and(eq(playerClaims.userId, userId), eq(playerClaims.playerId, playerId)),
    )
    .limit(1)
  return rows.length > 0
}

/** Fetch the provider picture and mirror it into the assets bucket. Best-effort:
    any failure returns null so a flaky image never blocks a legitimate claim —
    the Player falls back to the Medallion, which #85's upload flow can replace. */
async function seedAvatar(
  store: AvatarStore,
  playerId: number,
  url: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  try {
    const res = await fetchUpstream(url, { fetchImpl, timeoutMs: 15_000 })
    const contentType =
      res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!RASTER_IMAGE_CONTENT_TYPES.has(contentType)) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES)
      return null
    const key = playerAvatarKey(playerId, bytes, contentType)
    await store.put('assets', key, bytes, contentType)
    return key
  } catch {
    return null
  }
}

/** Approve a pending claim: link the User, seed the avatar if they asked for it,
    and clear every pending request on that Player (the winner and the losers). */
export async function approveClaim(
  db: Db,
  store: AvatarStore | null,
  claimId: number,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<{ playerId: number; avatarSeeded: boolean }> {
  const claim = (
    await db
      .select({
        playerId: playerClaims.playerId,
        userId: playerClaims.userId,
        seedAvatarUrl: playerClaims.seedAvatarUrl,
      })
      .from(playerClaims)
      .where(eq(playerClaims.id, claimId))
  ).at(0)
  if (!claim) throw new Error(`Unknown claim ${claimId}`)

  // Mirror the avatar BEFORE the transaction so a 15s fetch never holds the
  // player row locked; the object is cleaned up if the write below fails.
  const avatarKey =
    store && claim.seedAvatarUrl
      ? await seedAvatar(
          store,
          claim.playerId,
          claim.seedAvatarUrl,
          opts.fetchImpl ?? fetch,
        )
      : null

  try {
    await db.transaction(async (tx) => {
      const player = (
        await tx
          .select({ userId: players.userId, mergedInto: players.mergedInto })
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
          .where(eq(playerClaims.id, claimId))
      ).at(0)
      if (!stillPending) throw new Error('This claim was already resolved')

      await tx
        .update(players)
        .set({ userId: claim.userId, ...(avatarKey && { avatarKey }) })
        .where(eq(players.id, claim.playerId))
      await tx
        .delete(playerClaims)
        .where(eq(playerClaims.playerId, claim.playerId))
    })
  } catch (error) {
    if (avatarKey && store) {
      await store.delete('assets', avatarKey).catch(() => undefined)
    }
    throw error
  }
  return { playerId: claim.playerId, avatarSeeded: avatarKey != null }
}

/** Deny a pending claim — the row vanishes, leaving no trace on the Player. */
export async function denyClaim(db: Db, claimId: number): Promise<void> {
  const deleted = await db
    .delete(playerClaims)
    .where(eq(playerClaims.id, claimId))
    .returning({ id: playerClaims.id })
  if (deleted.length === 0) throw new Error(`Unknown claim ${claimId}`)
}

/** Undo an approved claim, returning the Player to the accountless state and
    resetting its avatar to the Medallion. Records and Snapshots never move. */
async function unclaim(
  db: Db,
  store: AvatarStore | null,
  playerId: number,
  mustBeUserId: string | null,
): Promise<void> {
  const staleKey = await db.transaction(async (tx) => {
    const player = (
      await tx
        .select({ userId: players.userId, avatarKey: players.avatarKey })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    if (!player) throw new Error(`Unknown player ${playerId}`)
    if (player.userId == null) throw new Error('This player is not claimed')
    if (mustBeUserId != null && player.userId !== mustBeUserId) {
      throw new Error('You do not hold this claim')
    }
    await tx
      .update(players)
      .set({ userId: null, avatarKey: null })
      .where(eq(players.id, playerId))
    return player.avatarKey
  })
  // Delete the orphaned object after commit — a failed delete only leaks bytes.
  if (staleKey && store) {
    await store.delete('assets', staleKey).catch(() => undefined)
  }
}

/** The User unlinks their own claim (never gated). */
export function releaseClaim(
  db: Db,
  store: AvatarStore | null,
  userId: string,
  playerId: number,
): Promise<void> {
  return unclaim(db, store, playerId, userId)
}

/** A moderator severs any claim. */
export function revokeClaim(
  db: Db,
  store: AvatarStore | null,
  playerId: number,
): Promise<void> {
  return unclaim(db, store, playerId, null)
}

export interface PendingClaim {
  id: number
  playerId: number
  playerSlug: string
  playerDisplayName: string
  aliases: string[]
  note: string | null
  wantsAvatarSeed: boolean
  requesterHandle: string | null
  requesterDiscordId: string | null
  createdAt: Date | null
}

/** The moderator queue: each pending request with the requester's Discord
    identity next to the Player's name + aliases, oldest first. */
export async function listPendingClaims(db: Db): Promise<PendingClaim[]> {
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
      wantsAvatarSeed: sql<boolean>`${playerClaims.seedAvatarUrl} is not null`,
      requesterHandle: profiles.handle,
      requesterDiscordId: profiles.discordId,
      createdAt: playerClaims.createdAt,
    })
    .from(playerClaims)
    .innerJoin(players, eq(players.id, playerClaims.playerId))
    .leftJoin(playerAliases, eq(playerAliases.playerId, playerClaims.playerId))
    .leftJoin(profiles, eq(profiles.id, playerClaims.userId))
    .groupBy(
      playerClaims.id,
      players.slug,
      players.displayName,
      profiles.handle,
      profiles.discordId,
    )
    .orderBy(asc(playerClaims.createdAt), asc(playerClaims.id))
}
