import { and, count, eq, ne } from 'drizzle-orm'
import type { Db } from '#/db'
import { playerLinks, players } from '#/db/schema'
import { assertClaimOwnership } from '#/claims/owner'
import { assertProfileWriteBudget } from '#/claims/amendments'
import { MAX_NAMED_LINKS, WEBSITE_PLATFORM } from '#/links/platforms'
import { parseLinkValue } from '#/links/parse'
import type { StoredLink } from '#/links/parse'

/* The owner's Profile links. Only the Claim holder authors — the same rule as
   the Country, for the same reasons — and links publish the moment they are
   saved, because nothing here waits on anybody: Content Creator status was
   dropped, so there is no application to review, and links were cut from the
   Amendment queue, so there is no Moderator seeing them either.

   Which is exactly why the parse happens before the transaction opens and the
   stored value is a handle: the config and its validators ARE the review. */

/** Publish one link on the owner's own Player. Idempotent per platform: a
    second save replaces the first rather than adding a row, which is what caps
    the stored result at one handle per platform however hard it is driven. */
export async function setOwnLink(
  db: Db,
  userId: string,
  playerId: number,
  platformId: string,
  raw: string,
): Promise<StoredLink> {
  const stored = parseLinkValue(platformId, raw)
  await db.transaction(async (tx) => {
    const player = (
      await tx
        .select({ userId: players.userId, mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    assertClaimOwnership(player, userId)
    await assertProfileWriteBudget(tx, userId)
    await assertUnderCap(tx, playerId, stored.platform)
    await assertHandleFree(tx, playerId, stored)
    await tx
      .insert(playerLinks)
      .values({
        playerId,
        platform: stored.platform,
        handle: stored.handle,
        normalizedHandle: stored.normalized,
      })
      .onConflictDoUpdate({
        target: [playerLinks.playerId, playerLinks.platform],
        set: {
          handle: stored.handle,
          normalizedHandle: stored.normalized,
          updatedAt: new Date(),
        },
      })
  })
  return stored
}

/** Removal, which can only ever reduce what the site broadcasts and so is
    never guarded and never refused. A platform with nothing on it is a no-op,
    not an error. */
export async function removeOwnLink(
  db: Db,
  userId: string,
  playerId: number,
  platformId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const player = (
      await tx
        .select({ userId: players.userId, mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    assertClaimOwnership(player, userId)
    await tx
      .delete(playerLinks)
      .where(
        and(
          eq(playerLinks.playerId, playerId),
          eq(playerLinks.platform, platformId),
        ),
      )
  })
}

/** Every link row a Player carries, gone. The one path both `unclaim()` and a
    Moderator's clear take, so neither can drift from the other. */
export async function deletePlayerLinks(
  tx: Db,
  playerId: number,
): Promise<Array<{ platform: string; handle: string }>> {
  return tx
    .delete(playerLinks)
    .where(eq(playerLinks.playerId, playerId))
    .returning({ platform: playerLinks.platform, handle: playerLinks.handle })
}

/** Five named platforms; the personal site sits on top of them and does not
    count. The cap is the one hoop kept deliberately — and under the full-colour
    plates it does design work as well as calm work, because it is what bounds
    how much colour a stranger's profile can put on screen. */
async function assertUnderCap(
  tx: Db,
  playerId: number,
  platformId: string,
): Promise<void> {
  if (platformId === WEBSITE_PLATFORM) return
  const [{ named }] = await tx
    .select({ named: count() })
    .from(playerLinks)
    .where(
      and(
        eq(playerLinks.playerId, playerId),
        ne(playerLinks.platform, WEBSITE_PLATFORM),
        // Replacing a platform already on the row spends no new slot.
        ne(playerLinks.platform, platformId),
      ),
    )
  if (named >= MAX_NAMED_LINKS) {
    throw new Error(
      `You can show ${MAX_NAMED_LINKS} platforms plus a personal site — remove one first.`,
    )
  }
}

/** The one impersonation check available with no human in the loop: the second
    Player to claim a channel collides instead of quietly coexisting. Read here
    for the message; `plink_handle_uq` is what actually enforces it, and it is
    the index that decides a race. The personal site is carved out — a squadron
    or clan domain is legitimately linked by several Players. */
async function assertHandleFree(
  tx: Db,
  playerId: number,
  stored: StoredLink,
): Promise<void> {
  if (stored.platform === WEBSITE_PLATFORM) return
  const clash = await tx
    .select({ playerId: playerLinks.playerId })
    .from(playerLinks)
    .where(
      and(
        eq(playerLinks.platform, stored.platform),
        eq(playerLinks.normalizedHandle, stored.normalized),
        ne(playerLinks.playerId, playerId),
      ),
    )
    .limit(1)
  if (clash.length > 0) {
    throw new Error('Another player already shows that handle.')
  }
}
