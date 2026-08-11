import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '#/db'
import { playerAliases, playerClaims, players, profiles } from '#/db/schema'
import type { Storage } from '#/storage/r2'
import { writeAudit } from '#/admin/audit'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import {
  MAX_AVATAR_BYTES,
  RASTER_IMAGE_CONTENT_TYPES,
} from '#/storage/image-types'
import { playerAvatarKey } from '#/storage/avatar-key'
import { isAllowedAvatarHost } from '#/auth/profile'
import { MAX_NOTE_LENGTH } from '#/claims/limits'
import { ADMIN_PAGE_SIZE } from '#/lib/paging'
import { requiredReason } from '#/claims/validate'

/* The claim lifecycle. Approving consumes the request (players.user_id is the
   durable link); a denial is kept, and that is what refuses the second ask. */

type AvatarStore = Pick<Storage, 'put' | 'delete'>

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
    and clear every pending request on that Player (the winner and the losers).
    Denied rows on that Player survive it — approving is not an amnesty. */
export async function approveClaim(
  db: Db,
  store: AvatarStore | null,
  actorId: string,
  claimId: number,
  opts: { fetchImpl?: typeof fetch } = {},
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

      // A fresh owner gets a fresh identity: seed or Medallion, and no country.
      // Deleting an auth user nulls user_id by FK without running unclaim(), so
      // this is the only thing standing between that row and its next claimant.
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

/** Unlimited and self-serve with no cooldown: the rule is stated, not verified,
    so a correction costs one action. */
export async function setOwnCountry(
  db: Db,
  userId: string,
  playerId: number,
  countryCode: string | null,
): Promise<void> {
  return db.transaction(async (tx) => {
    const player = (
      await tx
        .select({ userId: players.userId, mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    assertClaimOwnership(player, userId)
    await tx
      .update(players)
      .set({ countryCode })
      .where(eq(players.id, playerId))
  })
}

/** Deny a claim request — the row is KEPT, marked denied, and that memory is
    what refuses the same ask forever. Locks the player row so a deny
    serialises with a concurrent approve. */
export async function denyClaim(
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
      .set({ state: 'denied', decidedBy: actorId, decidedAt: new Date() })
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
      diff: { context: { claimId, userId: claim.userId } },
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

/** THE single path back to accountless: link, Avatar and Country all go, or
    a value left behind resurrects on the next claim. */
async function unclaim(
  db: Db,
  store: AvatarStore | null,
  playerId: number,
  audit: { actorId: string; reason: string },
): Promise<void> {
  const staleKey = await db.transaction(async (tx) => {
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
    return player.avatarKey
  })
  // After commit, and only if a concurrent re-claim hasn't taken the key.
  if (staleKey && store) await deleteAvatarIfUnreferenced(db, store, staleKey)
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
  wantsAvatarSeed: boolean
  requesterHandle: string | null
  requesterDiscordId: string | null
  createdAt: Date | null
  decidedByHandle: string | null
  decidedAt: Date | null
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
      wantsAvatarSeed: sql<boolean>`${playerClaims.seedAvatarUrl} is not null`,
      requesterHandle: profiles.handle,
      requesterDiscordId: profiles.discordId,
      createdAt: playerClaims.createdAt,
      decidedByHandle: decider.handle,
      decidedAt: playerClaims.decidedAt,
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
