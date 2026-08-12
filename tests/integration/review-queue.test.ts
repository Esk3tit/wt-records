import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { playerAmendments, playerClaims, players, profiles } from '#/db/schema'
import {
  countPendingAmendments,
  listPendingAmendments,
  rejectAmendment,
} from '#/claims/amendments'
import { countPendingClaims } from '#/claims/claims'
import { getPlayer, getPlayerEnrichment } from '#/db/queries'

/* What the Moderator's Review screen is handed: the work waiting, in the order
   it must be worked, with the history that makes a refusal mean something —
   and nothing of it anywhere a visitor can reach. */

const OWNER = '00000000-0000-4000-8000-00000000000a'
const OTHER = '00000000-0000-4000-8000-00000000000b'
const MOD = '00000000-0000-4000-8000-00000000000c'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle] of [
    [OWNER, 'AceIRL'],
    [OTHER, 'Rival'],
    [MOD, 'Warden'],
  ]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
    await t.db.insert(profiles).values({ id, handle })
  }
})
afterEach(async () => {
  await t.client.close()
})

async function claimedPlayer(
  slug: string,
  userId: string,
  avatarKey: string | null = null,
) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  await t.db
    .update(players)
    .set({ userId, avatarKey })
    .where(eq(players.id, p.id))
  return p
}

async function propose(
  playerId: number,
  userId: string,
  value: string,
  submittedAt?: Date,
) {
  const [row] = await t.db
    .insert(playerAmendments)
    .values({
      playerId,
      field: 'avatar',
      value,
      submittedBy: userId,
      ...(submittedAt ? { submittedAt } : {}),
    })
    .returning()
  return row
}

async function refused(playerId: number, reason: string | null, at: Date) {
  await t.db.insert(playerAmendments).values({
    playerId,
    field: 'avatar',
    value: `players/${playerId}/refused-${at.getTime()}.webp`,
    submittedBy: OWNER,
    state: 'rejected',
    reason,
    reviewedAt: at,
    reviewedBy: MOD,
  })
}

const AGES_AGO = new Date('2026-01-01T00:00:00Z')
const RECENTLY = new Date('2026-06-01T00:00:00Z')

describe('the amendments panel', () => {
  it('puts the oldest first, whichever field it is for', async () => {
    const first = await claimedPlayer('ace', OWNER)
    const second = await claimedPlayer('maverick', OTHER)
    // Inserted newest-first, so an unordered query would answer in this order.
    const newer = await propose(second.id, OTHER, 'b.webp', RECENTLY)
    const older = await propose(first.id, OWNER, 'a.webp', AGES_AGO)

    const rows = await listPendingAmendments(t.db)

    // The ordering key is the submission, and nothing else — not the player,
    // and not the field. The cross-field half cannot be asserted here: the
    // `amend_field_valid` CHECK admits only 'avatar', so a fixture for a second
    // field cannot be written until one exists.
    expect(rows.map((r) => r.id)).toEqual([older.id, newer.id])
  })

  it('carries what is live now beside what is proposed', async () => {
    const player = await claimedPlayer('ace', OWNER, 'live.webp')
    await propose(player.id, OWNER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    expect(row).toMatchObject({
      playerId: player.id,
      playerDisplayName: player.displayName,
      field: 'avatar',
      value: 'proposed.webp',
      publishedValue: 'live.webp',
      submitterHandle: 'AceIRL',
    })
    expect(row.submittedAt).toBeInstanceOf(Date)
  })

  it('says the published value is the Medallion by saying nothing', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await propose(player.id, OWNER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    expect(row.publishedValue).toBeNull()
  })

  it('is quiet about a Player nobody has ever refused', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await propose(player.id, OWNER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    expect(row.priorRejections).toEqual([])
  })

  it('carries the reasons, so two refusals are not one number', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await refused(player.id, 'blurry', AGES_AGO)
    await refused(player.id, 'hateful', RECENTLY)
    // Neither of these was refused: nothing was decided about them at all.
    await t.db.insert(playerAmendments).values({
      playerId: player.id,
      field: 'avatar',
      value: 'gone.webp',
      submittedBy: OWNER,
      state: 'withdrawn',
    })
    await propose(player.id, OWNER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    expect(row.priorRejections.map((r) => r.reason)).toEqual([
      'hateful',
      'blurry',
    ])
  })

  it('counts a refusal nobody wrote a reason for', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await refused(player.id, null, AGES_AGO)
    await propose(player.id, OWNER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    expect(row.priorRejections).toHaveLength(1)
    expect(row.priorRejections[0].reason).toBeNull()
  })

  it('does not hand a new holder the last one’s rejections', async () => {
    const player = await claimedPlayer('ace', OTHER)
    // Refused while somebody else held this Player, before a revoke freed it.
    await refused(player.id, 'hateful', AGES_AGO)
    await propose(player.id, OTHER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    // "Refused 4 times" is a judgement about a person, and this is not that
    // person: a history written about someone else must not follow the row.
    expect(row.priorRejections).toEqual([])
  })

  it('ships the newest reasons and counts the rest, however long the history', async () => {
    const player = await claimedPlayer('ace', OWNER)
    for (let nth = 1; nth <= 7; nth++) {
      await refused(
        player.id,
        `refusal ${nth}`,
        new Date(Date.UTC(2026, 0, nth)),
      )
    }
    await propose(player.id, OWNER, 'proposed.webp')

    const [row] = await listPendingAmendments(t.db)

    // The count is the fact past a few; the whole history is never shipped to
    // a browser just to render four lines of it.
    expect(row.priorRejectionCount).toBe(7)
    expect(row.priorRejections.map((r) => r.reason)).toEqual([
      'refusal 7',
      'refusal 6',
      'refusal 5',
      'refusal 4',
    ])
  })

  it('keeps one Player’s history off another’s row', async () => {
    const refusedBefore = await claimedPlayer('ace', OWNER)
    const clean = await claimedPlayer('maverick', OTHER)
    await refused(refusedBefore.id, 'blurry', AGES_AGO)
    await propose(refusedBefore.id, OWNER, 'a.webp', AGES_AGO)
    await propose(clean.id, OTHER, 'b.webp', RECENTLY)

    const rows = await listPendingAmendments(t.db)

    expect(rows[0].priorRejections).toHaveLength(1)
    expect(rows[1].priorRejections).toEqual([])
  })
})

describe('a proposal that outlived the Claim behind it', () => {
  it('is neither offered as work nor counted as any', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await propose(player.id, OWNER, 'orphaned.webp')
    // Deleting the auth User nulls players.user_id by FK without running
    // unclaim(), so the proposal survives the Claim it belonged to.
    await t.db
      .update(players)
      .set({ userId: null })
      .where(eq(players.id, player.id))

    // A Moderator can decide nothing about it — an Approve could only answer
    // "already settled" — so it must not sit on the queue or the badge.
    expect(await listPendingAmendments(t.db)).toEqual([])
    expect(await countPendingAmendments(t.db)).toBe(0)
  })

  it('is still there to be closed by whoever claims the Player next', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await propose(player.id, OWNER, 'orphaned.webp')
    await t.db
      .update(players)
      .set({ userId: null })
      .where(eq(players.id, player.id))

    // Hidden from the queue is not resolved: the row is the next claim's to
    // withdraw, and leaving it pending is what keeps its object referenced.
    const [row] = await t.db
      .select()
      .from(playerAmendments)
      .where(eq(playerAmendments.playerId, player.id))
    expect(row.state).toBe('pending')
  })
})

describe('the badge', () => {
  it('has both halves of one number to sum', async () => {
    const claimed = await claimedPlayer('ace', OWNER)
    await propose(claimed.id, OWNER, 'proposed.webp')
    const [unclaimed] = await t.db
      .select()
      .from(players)
      .where(eq(players.slug, 'maverick'))
    await t.db
      .insert(playerClaims)
      .values({ playerId: unclaimed.id, userId: OTHER })

    expect(await countPendingClaims(t.db)).toBe(1)
    expect(await countPendingAmendments(t.db)).toBe(1)
  })

  it('counts nothing that is no longer waiting', async () => {
    const player = await claimedPlayer('ace', OWNER)
    await refused(player.id, 'blurry', AGES_AGO)

    expect(await countPendingAmendments(t.db)).toBe(0)
    expect(await countPendingClaims(t.db)).toBe(0)
  })
})

describe('the reject reason', () => {
  it('is on the row, and on no payload a visitor can reach', async () => {
    const player = await claimedPlayer('ace', OWNER, 'live.webp')
    const proposal = await propose(player.id, OWNER, 'proposed.webp')

    await rejectAmendment(t.db, null, MOD, proposal.id, 'hateful')

    const [row] = await t.db
      .select()
      .from(playerAmendments)
      .where(eq(playerAmendments.id, proposal.id))
    expect(row.reason).toBe('hateful')

    // The loader's own response, not the column read back: the reason must not
    // ride out on anything the profile page serialises to a visitor.
    const profile = await getPlayer(t.db, player.slug)
    const enrichment = await getPlayerEnrichment(t.db, player.id)
    // Anchored: a loader answering null would carry no reason either, and pass
    // both silences below without serving the page this is about.
    expect(profile?.player.displayName).toBe(player.displayName)
    expect(profile?.player.avatarKey).toBe('live.webp')
    expect(JSON.stringify({ profile, enrichment })).not.toContain('hateful')
    expect(JSON.stringify({ profile, enrichment })).not.toContain('proposed')
  })
})
