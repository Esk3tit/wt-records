import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq, sql } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import {
  playerAmendments,
  playerClaims,
  playerLinks,
  players,
  profiles,
} from '#/db/schema'
import { removeOwnLink, setOwnLink } from '#/claims/links'
import { approveClaim, revokeClaim } from '#/claims/claims'
import { AMENDMENT_HOURLY_LIMIT } from '#/claims/amendments'
import { clearPlayerLinks } from '#/admin/players'
import { effectiveLinks, getPlayerLinks } from '#/db/queries'
import { MAX_NAMED_LINKS } from '#/links/platforms'

const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'
const MOD = '00000000-0000-4000-8000-00000000000c'

let t: TestDb

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

async function claim(slug: string, userId: string) {
  const p = await playerBySlug(slug)
  await t.db.update(players).set({ userId }).where(eq(players.id, p.id))
  return p
}

async function linksOf(playerId: number) {
  return t.db
    .select({
      platform: playerLinks.platform,
      handle: playerLinks.handle,
      normalizedHandle: playerLinks.normalizedHandle,
    })
    .from(playerLinks)
    .where(eq(playerLinks.playerId, playerId))
    .orderBy(asc(playerLinks.platform))
}

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle] of [
    [USER_A, 'AceIRL'],
    [USER_B, 'Rival'],
    [MOD, 'Warden'],
  ]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
    await t.db.insert(profiles).values({ id, handle })
  }
})
afterEach(async () => {
  await t.client.close()
})

describe('the holder authors, and only the holder', () => {
  it('stores a handle and echoes back exactly what was stored', async () => {
    const ace = await claim('ace', USER_A)
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily'),
    ).resolves.toMatchObject({ platform: 'youtube', handle: 'PhlyDaily' })
    expect(await linksOf(ace.id)).toEqual([
      {
        platform: 'youtube',
        handle: 'PhlyDaily',
        normalizedHandle: 'phlydaily',
      },
    ])
  })

  it('normalises a pasted URL to a handle', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(
      t.db,
      USER_A,
      ace.id,
      'youtube',
      'https://www.youtube.com/@PhlyDaily?sub_confirmation=1',
    )
    expect((await linksOf(ace.id))[0].handle).toBe('PhlyDaily')
  })

  it('replaces rather than accumulates, one handle per platform', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'SomethingElse')
    expect(await linksOf(ace.id)).toHaveLength(1)
    expect((await linksOf(ace.id))[0].handle).toBe('SomethingElse')
  })

  it('removes one in a single action, and removing nothing is not an error', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await removeOwnLink(t.db, USER_A, ace.id, 'youtube')
    await removeOwnLink(t.db, USER_A, ace.id, 'youtube')
    expect(await linksOf(ace.id)).toHaveLength(0)
  })

  it('refuses a write from anyone but the claim holder', async () => {
    const ace = await claim('ace', USER_A)
    await expect(
      setOwnLink(t.db, USER_B, ace.id, 'youtube', 'Rival'),
    ).rejects.toThrow(/do not hold this claim/)
    await expect(
      removeOwnLink(t.db, USER_B, ace.id, 'youtube'),
    ).rejects.toThrow(/do not hold this claim/)
    expect(await linksOf(ace.id)).toHaveLength(0)
  })

  it('refuses a write to an unclaimed player', async () => {
    const ace = await playerBySlug('ace')
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily'),
    ).rejects.toThrow(/not claimed/)
  })

  it('refuses a platform nobody configured', async () => {
    const ace = await claim('ace', USER_A)
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'steam', 'phlydaily'),
    ).rejects.toThrow(/not one this site links/)
    // Admissible, but not shippable.
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'kick', 'phlydaily'),
    ).rejects.toThrow(/not one this site links/)
  })
})

describe('the cap', () => {
  const named = ['youtube', 'discord', 'twitch', 'tiktok', 'x', 'instagram']

  it('refuses a sixth named platform', async () => {
    const ace = await claim('ace', USER_A)
    for (const platform of named.slice(0, MAX_NAMED_LINKS)) {
      await setOwnLink(t.db, USER_A, ace.id, platform, 'phlydaily')
    }
    await expect(
      setOwnLink(t.db, USER_A, ace.id, named[MAX_NAMED_LINKS], 'phlydaily'),
    ).rejects.toThrow(/remove one first/)
  })

  it('lets a platform already on the row be edited at the cap', async () => {
    const ace = await claim('ace', USER_A)
    for (const platform of named.slice(0, MAX_NAMED_LINKS)) {
      await setOwnLink(t.db, USER_A, ace.id, platform, 'phlydaily')
    }
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily2'),
    ).resolves.toBeTruthy()
  })

  it('does not count the personal site against it', async () => {
    const ace = await claim('ace', USER_A)
    for (const platform of named.slice(0, MAX_NAMED_LINKS)) {
      await setOwnLink(t.db, USER_A, ace.id, platform, 'phlydaily')
    }
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'website', 'https://phlydaily.example'),
    ).resolves.toBeTruthy()
    expect(await linksOf(ace.id)).toHaveLength(MAX_NAMED_LINKS + 1)
  })
})

describe('two players claiming the same channel', () => {
  it('collide, rather than quietly coexisting', async () => {
    const ace = await claim('ace', USER_A)
    const rival = await claim('floppa', USER_B)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await expect(
      setOwnLink(t.db, USER_B, rival.id, 'youtube', 'phlydaily'),
    ).rejects.toThrow(/already shows that handle/)
  })

  // The index, not the read: a race gets past the read and must still fail.
  it('are refused by the database even with the read bypassed', async () => {
    const ace = await claim('ace', USER_A)
    const rival = await claim('floppa', USER_B)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await expect(
      t.db.insert(playerLinks).values({
        playerId: rival.id,
        platform: 'youtube',
        handle: 'phlydaily',
        normalizedHandle: 'phlydaily',
      }),
    ).rejects.toThrow()
  })

  it('do not collide on a personal site — a squadron domain is shared', async () => {
    const ace = await claim('ace', USER_A)
    const mate = await claim('floppa', USER_B)
    const squadron = 'https://squadron.example'
    await setOwnLink(t.db, USER_A, ace.id, 'website', squadron)
    await expect(
      setOwnLink(t.db, USER_B, mate.id, 'website', squadron),
    ).resolves.toBeTruthy()
  })

  // A handle names a person; the case it is typed in does not make it another.
  it('collide across case where the platform is case-insensitive', async () => {
    const ace = await claim('ace', USER_A)
    const rival = await claim('floppa', USER_B)
    await setOwnLink(t.db, USER_A, ace.id, 'twitch', 'PhlyDaily')
    await expect(
      setOwnLink(t.db, USER_B, rival.id, 'twitch', 'phlydaily'),
    ).rejects.toThrow(/already shows that handle/)
  })

  // A Discord invite code IS case-sensitive: two casings are two servers.
  it('do not collide across case where the platform is case-sensitive', async () => {
    const ace = await claim('ace', USER_A)
    const other = await claim('floppa', USER_B)
    await setOwnLink(t.db, USER_A, ace.id, 'discord', 'aBcDeF')
    await expect(
      setOwnLink(t.db, USER_B, other.id, 'discord', 'abcdef'),
    ).resolves.toBeTruthy()
  })
})

describe('an unclaimed player carries nothing', () => {
  it('is enforced by the read gate', () => {
    const link = { platform: 'youtube', handle: 'PhlyDaily' }
    expect(effectiveLinks({ userId: null }, [link])).toEqual([])
    expect(effectiveLinks({ userId: USER_A }, [link])).toEqual([link])
  })

  // The gate alone would leave the rows to resurrect on the next claim, and
  // for a child table the FK cannot reach them at all.
  it('is enforced again by deletion on revoke', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')

    await revokeClaim(t.db, null, MOD, ace.id, 'asked to leave')
    expect(await linksOf(ace.id)).toHaveLength(0)

    await claim('ace', USER_B)
    expect(await linksOf(ace.id)).toHaveLength(0)
  })

  it('is not inherited by the next claimant when the FK cleared user_id', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await t.db
      .update(players)
      .set({ userId: null })
      .where(eq(players.id, ace.id))

    const [pending] = await t.db
      .insert(playerClaims)
      .values({ playerId: ace.id, userId: USER_B })
      .returning({ id: playerClaims.id })
    await approveClaim(t.db, null, MOD, pending.id)

    expect((await playerBySlug('ace')).userId).toBe(USER_B)
    expect(await linksOf(ace.id)).toHaveLength(0)
  })

  it('leaves an anonymous visitor a claimed player’s links in full', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    const rows = await getPlayerLinks(t.db, ace.id)
    expect(effectiveLinks({ userId: USER_A }, rows)).toHaveLength(1)
  })
})

describe('the Moderator clears, never authors', () => {
  it('clears every link and audits it under the player', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await setOwnLink(t.db, USER_A, ace.id, 'website', 'https://phly.example')

    await expect(clearPlayerLinks(t.db, MOD, ace.id)).resolves.toEqual({
      clearedLinks: 2,
    })
    expect(await linksOf(ace.id)).toHaveLength(0)
    const audit = await t.client.query(
      `select action, entity from audit_log where action = 'player.clear_links'`,
    )
    expect(audit.rows).toEqual([
      { action: 'player.clear_links', entity: 'player' },
    ])
  })

  it('leaves the claim itself untouched', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await clearPlayerLinks(t.db, MOD, ace.id)
    expect((await playerBySlug('ace')).userId).toBe(USER_A)
  })

  it('refuses a clear on a player showing nothing', async () => {
    const ace = await claim('ace', USER_A)
    await expect(clearPlayerLinks(t.db, MOD, ace.id)).rejects.toThrow(
      /shows no links/,
    )
  })

  // Asserted, not merely absent from the UI: a mod-authored link has no author
  // for a dispute to be judged against, and would force provenance columns on
  // every row, to tell what unclaim must clear from what it must keep.
  it('offers no moderator path that sets a link', async () => {
    const admin = await import('#/admin/players')
    expect(Object.keys(admin).filter((name) => /link/i.test(name))).toEqual([
      'clearPlayerLinks',
    ])
  })

  it('cannot reach the owner’s own path either, moderator or not', async () => {
    const ace = await claim('ace', USER_A)
    await expect(
      setOwnLink(t.db, MOD, ace.id, 'youtube', 'Warden'),
    ).rejects.toThrow(/do not hold this claim/)
  })
})

describe('the submit guard', () => {
  it('refuses the eleventh profile change in an hour, counting links too', async () => {
    const ace = await claim('ace', USER_A)
    // Six amendments and four link writes: neither reaches the limit alone.
    await t.db.insert(playerAmendments).values(
      Array.from({ length: AMENDMENT_HOURLY_LIMIT - 4 }, (_, i) => ({
        playerId: ace.id,
        field: 'avatar' as const,
        value: `avatars/${ace.id}/spent${i}.webp`,
        state: 'superseded' as const,
        submittedBy: USER_A,
      })),
    )
    for (const platform of ['youtube', 'twitch', 'x', 'instagram']) {
      await setOwnLink(t.db, USER_A, ace.id, platform, 'phlydaily')
    }

    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'telegram', 'phlydaily'),
    ).rejects.toThrow(/too many changes/i)
  })

  it('says nothing about review, because links have none', async () => {
    const ace = await claim('ace', USER_A)
    await t.db.insert(playerAmendments).values(
      Array.from({ length: AMENDMENT_HOURLY_LIMIT }, (_, i) => ({
        playerId: ace.id,
        field: 'avatar' as const,
        value: `avatars/${ace.id}/spent${i}.webp`,
        state: 'superseded' as const,
        submittedBy: USER_A,
      })),
    )
    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily'),
    ).rejects.not.toThrow(/review|pending|moderat/i)
  })

  it('counts the window from now, not from the whole history', async () => {
    const ace = await claim('ace', USER_A)
    for (const platform of ['youtube', 'twitch', 'x', 'instagram', 'discord']) {
      await setOwnLink(t.db, USER_A, ace.id, platform, 'phlydaily')
    }
    await t.db
      .update(playerLinks)
      .set({ updatedAt: sql`now() - interval '2 hours'` })
      .where(eq(playerLinks.playerId, ace.id))
    await t.db.insert(playerAmendments).values(
      Array.from({ length: AMENDMENT_HOURLY_LIMIT - 1 }, (_, i) => ({
        playerId: ace.id,
        field: 'avatar' as const,
        value: `avatars/${ace.id}/old${i}.webp`,
        state: 'superseded' as const,
        submittedBy: USER_A,
      })),
    )

    await expect(
      setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily2'),
    ).resolves.toBeTruthy()
  })

  // Removal can only reduce what the site broadcasts, so it is never guarded.
  it('never refuses a removal', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnLink(t.db, USER_A, ace.id, 'youtube', 'PhlyDaily')
    await t.db.insert(playerAmendments).values(
      Array.from({ length: AMENDMENT_HOURLY_LIMIT }, (_, i) => ({
        playerId: ace.id,
        field: 'avatar' as const,
        value: `avatars/${ace.id}/spent${i}.webp`,
        state: 'superseded' as const,
        submittedBy: USER_A,
      })),
    )
    await expect(
      removeOwnLink(t.db, USER_A, ace.id, 'youtube'),
    ).resolves.toBeUndefined()
  })
})
