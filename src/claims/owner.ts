import { eq } from 'drizzle-orm'
import type { Db } from '#/db'
import { players } from '#/db/schema'
import type { AvatarStore } from '#/claims/avatar'
import {
  deleteAvatarIfUnreferenced,
  deleteAvatarsIfUnreferenced,
} from '#/claims/avatar'
import { closePendingAmendments, submitAmendment } from '#/claims/amendments'
import { REVIEW_QUEUE_PATH, notifyAmendmentSubmitted } from '#/claims/notify'
import { playerAvatarKey } from '#/storage/avatar-key'

/* What a holder may change on their own page, without a moderator. Every one
   of these asserts ownership first: the Claim is the whole permission model. */

/** The acting User must be the Player's current owner for a self-service avatar
    change — a merged, accountless, or someone-else's Player is refused. */
export function assertClaimOwnership<
  T extends { userId: string | null; mergedInto: number | null },
>(player: T | undefined, userId: string): asserts player is T {
  if (!player) throw new Error('Unknown player')
  if (player.mergedInto != null) throw new Error('This player was merged')
  if (player.userId == null) throw new Error('This player is not claimed')
  if (player.userId !== userId) throw new Error('You do not hold this claim')
}

/** The owner uploads a new Avatar for their own Player: the bytes are decoded,
    center-cropped, and re-encoded to a 512×512 WebP (never stored as-is), put
    under a fresh content-hashed key, and proposed as an Amendment. The sibling
    of the seed path — same cap, key scheme, and reference-guarded cleanup.
    Refuses when no store is configured: persisting a key with no object behind
    it would render a broken avatar, unlike the best-effort seed which just
    stays null.

    They see it immediately and are told nothing: the published row is the one a
    Moderator has accepted, and everything about the wait — including that there
    is one — stays off the page. */
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

  let proposed: { staleKey: string | null; displayName: string }
  try {
    proposed = await db.transaction(async (tx) => {
      const player = (
        await tx
          .select({
            userId: players.userId,
            mergedInto: players.mergedInto,
            displayName: players.displayName,
          })
          .from(players)
          .where(eq(players.id, playerId))
          .for('update')
      ).at(0)
      assertClaimOwnership(player, userId)
      const { supersededValue } = await submitAmendment(tx, {
        playerId,
        field: 'avatar',
        value: key,
        userId,
      })
      // The displaced proposal's object is now unreferenced unless this upload
      // is the identical picture, which lands on the identical key.
      return {
        staleKey:
          supersededValue && supersededValue !== key ? supersededValue : null,
        displayName: player.displayName,
      }
    })
  } catch (error) {
    await deleteAvatarIfUnreferenced(db, store, key)
    throw error
  }
  if (proposed.staleKey) {
    await deleteAvatarIfUnreferenced(db, store, proposed.staleKey)
  }
  // After the commit, and unable to fail it: there is one Moderator, and
  // nothing today tells them anything is waiting.
  notifyAmendmentSubmitted({
    playerId,
    playerDisplayName: proposed.displayName,
    reviewPath: REVIEW_QUEUE_PATH,
  })
  return { avatarKey: key }
}

/** The owner removes their Avatar, returning the Player to the Medallion. This
    publishes instantly and unconditionally, review or no review: removal can
    only ever reduce what the site broadcasts, so it is never shadowed — and a
    picture they regret must never wait on anybody. Any proposal in flight is
    overtaken by it. The dereferenced objects are cleaned up when unreferenced;
    a Player already on the Medallion with nothing proposed is a no-op
    (idempotent), never an error. */
export async function removeOwnAvatar(
  db: Db,
  store: AvatarStore | null,
  userId: string,
  playerId: number,
): Promise<void> {
  const staleKeys = await db.transaction(async (tx) => {
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
    const dropped = await closePendingAmendments(tx, playerId, 'superseded')
    if (player.avatarKey == null) return dropped
    await tx
      .update(players)
      .set({ avatarKey: null })
      .where(eq(players.id, playerId))
    return [...dropped, player.avatarKey]
  })
  await deleteAvatarsIfUnreferenced(db, store, staleKeys)
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
