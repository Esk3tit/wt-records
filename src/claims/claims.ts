import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { playerAliases, playerClaims, players, profiles } from '#/db/schema'
import type { Storage } from '#/storage/r2'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import {
  MAX_AVATAR_BYTES,
  RASTER_IMAGE_CONTENT_TYPES,
} from '#/storage/image-types'
import { playerAvatarKey } from '#/storage/avatar-key'
import { isAllowedAvatarHost } from '#/auth/profile'
import { MAX_NOTE_LENGTH } from '#/claims/limits'

/* The claim lifecycle. A pending Claim is the whole player_claims row: it lives
   only until a moderator resolves it, at which point the row is deleted and the
   durable link is players.user_id. There is no audit trail in v1 (ADR 0010). */

type AvatarStore = Pick<Storage, 'put' | 'delete'>

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
    throw new Error(`Keep the note to at most ${MAX_NOTE_LENGTH} characters`)
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
    the Player falls back to the Medallion, which a later upload flow replaces. */
async function seedAvatar(
  store: AvatarStore,
  playerId: number,
  url: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  // Re-validate the host at the fetch boundary (defence in depth) and refuse
  // redirects — a provider CDN must never bounce the server fetch off-host.
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return null
  }
  if (!isAllowedAvatarHost(hostname)) return null
  try {
    const res = await fetchUpstream(url, {
      fetchImpl,
      timeoutMs: 15_000,
      redirect: 'error',
      // One shot: the seed is best-effort with a Medallion fallback, so don't
      // spend retry backoff on a transient blip or a redirect rejection.
      maxAttempts: 1,
    })
    const contentType =
      res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!RASTER_IMAGE_CONTENT_TYPES.has(contentType)) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    const bytes = await readCapped(res, MAX_AVATAR_BYTES)
    if (!bytes || bytes.byteLength === 0) return null
    const key = playerAvatarKey(playerId, bytes, contentType)
    await store.put('assets', key, bytes, contentType)
    return key
  } catch {
    return null
  }
}

/** Read a response body but never buffer more than `max` bytes: a
    content-length precheck plus a streamed cap, so a lying or unbounded
    upstream can't exhaust process memory. */
async function readCapped(
  res: Response,
  max: number,
): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) {
    await res.body?.cancel().catch(() => undefined)
    return null
  }
  const reader = res.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
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

  let staleKey: string | null = null
  try {
    staleKey = await db.transaction(async (tx) => {
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
          .where(eq(playerClaims.id, claimId))
      ).at(0)
      if (!stillPending) throw new Error('This claim was already resolved')

      // A fresh owner gets a fresh identity: set the seed or reset to the
      // Medallion (null) — never inherit a prior owner's avatar.
      await tx
        .update(players)
        .set({ userId: claim.userId, avatarKey })
        .where(eq(players.id, claim.playerId))
      await tx
        .delete(playerClaims)
        .where(eq(playerClaims.playerId, claim.playerId))
      // The prior owner's object is now unreferenced (keys are per-player).
      return player.avatarKey && player.avatarKey !== avatarKey
        ? player.avatarKey
        : null
    })
  } catch (error) {
    // Roll back the just-seeded object — but never one a concurrent approval
    // already committed and referenced (content-addressed keys can collide).
    if (avatarKey && store)
      await deleteAvatarIfUnreferenced(db, store, avatarKey)
    throw error
  }
  // Same collision guard on the prior owner's object: a concurrent re-seed of
  // the identical image could have re-referenced this same content-hash key.
  if (staleKey && store) await deleteAvatarIfUnreferenced(db, store, staleKey)
  return { playerId: claim.playerId, avatarSeeded: avatarKey != null }
}

/** Delete an avatar object only when no player row still references its key —
    a content-addressed key can be re-referenced by a concurrent seed. Fully
    best-effort: it runs after the owning write has committed at every call
    site, so a leaked object must never surface as an error. */
export async function deleteAvatarIfUnreferenced(
  db: Db,
  store: AvatarStore,
  key: string,
): Promise<void> {
  try {
    const referenced =
      (
        await db
          .select({ id: players.id })
          .from(players)
          .where(eq(players.avatarKey, key))
          .limit(1)
      ).length > 0
    if (!referenced) await store.delete('assets', key)
  } catch {
    // A post-commit cleanup failure only leaks bytes; never fail the caller.
  }
}

/** The acting User must be the Player's current owner for a self-service avatar
    change — a merged, accountless, or someone-else's Player is refused. */
function assertClaimOwnership<
  T extends { userId: string | null; mergedInto: number | null },
>(player: T | undefined, userId: string): asserts player is T {
  if (!player) throw new Error('Unknown player')
  if (player.mergedInto != null) throw new Error('This player was merged')
  if (player.userId == null) throw new Error('This player is not claimed')
  if (player.userId !== userId) throw new Error('You do not hold this claim')
}

/** The owner uploads a new Avatar for their own Player: the bytes are decoded,
    center-cropped, and re-encoded to a 512×512 WebP (never stored as-is), put
    under a fresh content-hashed key, and the Player is repointed. The sibling of
    the seed path — same cap, key scheme, and reference-guarded cleanup. Refuses
    when no store is configured: persisting a key with no object behind it would
    render a broken avatar, unlike the best-effort seed which just stays null. */
export async function setOwnAvatar(
  db: Db,
  store: AvatarStore | null,
  userId: string,
  playerId: number,
  bytes: Uint8Array,
): Promise<{ avatarKey: string }> {
  if (!store) throw new Error('Avatar uploads are not available right now')
  // Fast-fail ownership before spending any CPU on the decode; the transaction
  // below re-checks under a row lock (the authoritative guard against a race).
  assertClaimOwnership(
    (
      await db
        .select({ userId: players.userId, mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, playerId))
    ).at(0),
    userId,
  )

  // Imported here, not at module top: keep sharp (a heavy native addon) out of
  // the profile-view path, which pulls this module only for claim reads.
  const { encodeAvatar } = await import('#/storage/avatar-image')
  const processed = await encodeAvatar(bytes)
  const key = playerAvatarKey(playerId, processed, 'image/webp')
  // Put before the transaction so the (fast) DB write never waits on the store;
  // the object is cleaned up below if that write fails.
  await store.put('assets', key, processed, 'image/webp')

  let staleKey: string | null = null
  try {
    staleKey = await db.transaction(async (tx) => {
      const player = (
        await tx
          .select({
            userId: players.userId,
            mergedInto: players.mergedInto,
            avatarKey: players.avatarKey,
          })
          .from(players)
          .where(eq(players.id, playerId))
          .for('update')
      ).at(0)
      assertClaimOwnership(player, userId)
      await tx
        .update(players)
        .set({ avatarKey: key })
        .where(eq(players.id, playerId))
      // The prior object is now unreferenced unless a concurrent write already
      // repointed another player at this identical content-hash key.
      return player.avatarKey && player.avatarKey !== key
        ? player.avatarKey
        : null
    })
  } catch (error) {
    await deleteAvatarIfUnreferenced(db, store, key)
    throw error
  }
  if (staleKey) await deleteAvatarIfUnreferenced(db, store, staleKey)
  return { avatarKey: key }
}

/** The owner removes their Avatar, returning the Player to the Medallion. The
    dereferenced object is cleaned up when unreferenced; a Player already on the
    Medallion is a no-op (idempotent), never an error. */
export async function removeOwnAvatar(
  db: Db,
  store: AvatarStore | null,
  userId: string,
  playerId: number,
): Promise<void> {
  const staleKey = await db.transaction(async (tx) => {
    const player = (
      await tx
        .select({
          userId: players.userId,
          mergedInto: players.mergedInto,
          avatarKey: players.avatarKey,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    assertClaimOwnership(player, userId)
    if (player.avatarKey == null) return null
    await tx
      .update(players)
      .set({ avatarKey: null })
      .where(eq(players.id, playerId))
    return player.avatarKey
  })
  if (staleKey && store) await deleteAvatarIfUnreferenced(db, store, staleKey)
}

/** Deny a pending claim — the row vanishes, leaving no trace on the Player.
    Locks the player row so a deny serialises with a concurrent approve. */
export async function denyClaim(db: Db, claimId: number): Promise<void> {
  return db.transaction(async (tx) => {
    const claim = (
      await tx
        .select({ playerId: playerClaims.playerId })
        .from(playerClaims)
        .where(eq(playerClaims.id, claimId))
    ).at(0)
    if (!claim) throw new Error(`Unknown claim ${claimId}`)
    await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, claim.playerId))
      .for('update')
    // Re-check under the lock: a concurrent approve may have deleted the row
    // between the read above and this delete — 0 rows means it already won.
    const deleted = await tx
      .delete(playerClaims)
      .where(eq(playerClaims.id, claimId))
      .returning({ id: playerClaims.id })
    if (deleted.length === 0) throw new Error('This claim was already resolved')
  })
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
  // Delete the orphaned object after commit, but only if a concurrent re-claim
  // hasn't re-referenced the same content-hash key; a failed delete only leaks.
  if (staleKey && store) await deleteAvatarIfUnreferenced(db, store, staleKey)
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
