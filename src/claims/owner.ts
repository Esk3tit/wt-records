import { eq } from 'drizzle-orm'
import type { Db } from '#/db'
import { players } from '#/db/schema'
import type { AvatarStore } from '#/claims/avatar'
import { deleteAvatarIfUnreferenced } from '#/claims/avatar'
import { playerAvatarKey } from '#/storage/avatar-key'

/* What a holder may change on their own page, without a moderator. Every one
   of these asserts ownership first: the Claim is the whole permission model. */

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
