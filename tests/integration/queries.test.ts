import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { seedDemo } from '#/db/seed-demo'
import { replaceSearchTerms } from '#/db/search-terms'
import { browseFilters } from '#/lib/browse-params'
import { modes, nations, records, players, vehicles } from '#/db/schema'
import {
  browseVehicles,
  lookupVehicles,
  getLeaderboard,
  getMode,
  getModeLanding,
  getModeStats,
  getNationSheet,
  getPlayer,
  getRules,
  getVehicle,
  listModes,
  listNations,
  search,
} from '#/db/queries'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
})
afterEach(async () => {
  await t.client.close()
})

describe('listModes', () => {
  it('returns all modes ordered by sort', async () => {
    const modeList = await listModes(t.db)
    expect(modeList.map((m) => m.mode)).toEqual(['grb', 'gab', 'arb', 'aab'])
    expect(modeList.find((m) => m.mode === 'grb')?.isLive).toBe(true)
    expect(modeList.find((m) => m.mode === 'gab')?.isLive).toBe(false)
  })
})

describe('getMode', () => {
  it('returns the mode row or null', async () => {
    expect((await getMode(t.db, 'grb'))?.name).toBe('Ground Realistic Battles')
    expect(await getMode(t.db, 'nope')).toBeNull()
  })
})

describe('getLeaderboard', () => {
  it('ranks players by current verified record count, ties broken by name', async () => {
    const board = await getLeaderboard(t.db, 'grb')
    expect(board).toEqual([
      { slug: 'ace', displayName: 'Ace', records: 2 },
      { slug: 'floppa', displayName: 'Floppa', records: 1 },
      { slug: 'maverick', displayName: 'Maverick', records: 1 },
    ])
  })

  it('excludes superseded (non-current) and unverified records', async () => {
    // Maverick's superseded M4A1 (12) must not count — he only holds M26.
    const board = await getLeaderboard(t.db, 'grb')
    expect(board.find((r) => r.slug === 'maverick')?.records).toBe(1)
  })

  it('honours the limit', async () => {
    expect(await getLeaderboard(t.db, 'grb', 1)).toHaveLength(1)
  })

  it('is empty for a mode with no records', async () => {
    expect(await getLeaderboard(t.db, 'gab')).toEqual([])
  })
})

describe('getModeStats', () => {
  it('counts current records, holders, covered and eligible vehicles', async () => {
    expect(await getModeStats(t.db, 'grb')).toEqual({
      records: 4,
      holders: 3,
      coveredVehicles: 4,
      eligibleVehicles: 7,
      remainingVehicles: 3,
      completionPct: 57,
    })
  })

  it('returns null for an unknown mode', async () => {
    expect(await getModeStats(t.db, 'nope')).toBeNull()
  })
})

describe('listNations', () => {
  it('reports per-nation eligible and covered vehicle counts for the mode', async () => {
    const nationRows = await listNations(t.db, 'grb')
    expect(nationRows).toEqual([
      {
        slug: 'usa',
        name: 'USA',
        eligibleVehicles: 4,
        coveredVehicles: 2,
        completionPct: 50,
      },
      {
        slug: 'germany',
        name: 'Germany',
        eligibleVehicles: 3,
        coveredVehicles: 2,
        completionPct: 67,
      },
    ])
  })
})

describe('getNationSheet', () => {
  it('lists the nation eligible vehicles with current holder or open bounty', async () => {
    const sheet = await getNationSheet(t.db, 'grb', 'usa')
    expect(sheet?.nation.name).toBe('USA')
    const bySlug = Object.fromEntries(
      sheet!.rows.map((r) => [r.vehicleSlug, r]),
    )
    expect(bySlug['m4a1']).toMatchObject({
      vehicleName: 'M4A1',
      br: 3.7,
      kills: 14,
      displayName: 'Ace',
      playerSlug: 'ace',
    })
    // Open bounty: no current record.
    expect(bySlug['m18-gmc'].kills).toBeNull()
    expect(bySlug['m18-gmc'].playerSlug).toBeNull()
    expect(bySlug['m18-gmc'].br).toBe(4.0)
  })

  it('returns null for an unknown nation', async () => {
    expect(await getNationSheet(t.db, 'grb', 'nope')).toBeNull()
  })

  it('applies the shared catalog filters, pinned to the nation', async () => {
    const sheet = await getNationSheet(
      t.db,
      'grb',
      'usa',
      browseFilters({ status: 'open' }),
    )
    expect(sheet?.rows.map((r) => r.vehicleSlug).sort()).toEqual([
      'm163',
      'm18-gmc',
    ])
  })
})

describe('getVehicle', () => {
  it('returns the vehicle, BR, current holder and ordered proofs', async () => {
    const v = await getVehicle(t.db, 'grb', 'm4a1')
    expect(v?.vehicle.nationName).toBe('USA')
    expect(v?.br).toBe(3.7)
    expect(v?.current).toMatchObject({ kills: 14, displayName: 'Ace' })
    expect(v?.proofs.map((p) => p.kind)).toEqual(['scoreboard', 'video'])
  })

  it('returns an open-bounty vehicle with no current record', async () => {
    const v = await getVehicle(t.db, 'grb', 'm18-gmc')
    expect(v?.current).toBeNull()
    expect(v?.proofs).toEqual([])
  })

  it('returns null for an unknown vehicle', async () => {
    expect(await getVehicle(t.db, 'grb', 'nope')).toBeNull()
  })
})

describe('getPlayer', () => {
  it('returns the player, aliases and current records across the board', async () => {
    const p = await getPlayer(t.db, 'ace')
    expect(p?.player.displayName).toBe('Ace')
    expect(p?.aliases).toContain('Ace')
    expect(p?.records.map((r) => r.vehicleSlug)).toEqual(['m4a1', 'panther-d'])
    expect(p?.records[0].kills).toBe(14)
  })

  it('returns null for an unknown player', async () => {
    expect(await getPlayer(t.db, 'nope')).toBeNull()
  })
})

describe('getRules', () => {
  it('returns the mode and its per-class thresholds ordered by class', async () => {
    const r = await getRules(t.db, 'grb')
    expect(r?.mode.difficultMinKills).toBe(5)
    // Ordered by the vehicle_class enum's declaration order, not alphabetically.
    expect(r?.thresholds.map((th) => [th.class, th.minKills])).toEqual([
      ['light', 8],
      ['medium', 10],
      ['heavy', 10],
      ['spg', 7],
      ['spaa', 6],
    ])
  })
})

describe('search', () => {
  it('finds vehicles and players by name, case-insensitively', async () => {
    expect((await search(t.db, 'm4')).vehicles).toEqual([
      {
        slug: 'm4a1',
        name: 'M4A1',
        nation: 'USA',
        isEvent: false,
        isPremium: false,
        isSquadron: false,
        isRemoved: false,
        linkMode: 'grb',
      },
    ])
    expect((await search(t.db, 'ace')).players).toEqual([
      { slug: 'ace', displayName: 'Ace' },
    ])
  })

  it('links a result only to a live mode for its branch', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const jets = await t.db
      .insert(vehicles)
      .values({
        externalId: 'jetx',
        name: 'Jetx',
        slug: 'jetx',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    await replaceSearchTerms(t.db, jets)
    // ARB is not live yet → no link target.
    expect((await search(t.db, 'Jetx')).vehicles[0].linkMode).toBeNull()
    await t.db.update(modes).set({ isLive: true }).where(eq(modes.mode, 'arb'))
    expect((await search(t.db, 'Jetx')).vehicles[0].linkMode).toBe('arb')
  })

  it('returns empty results for a blank query', async () => {
    expect(await search(t.db, '   ')).toEqual({ players: [], vehicles: [] })
  })

  it('matches numeral variants and separator-blind input', async () => {
    for (const q of ['tiger 2', 'TigerII', 'tiger2h']) {
      expect((await search(t.db, q)).vehicles.map((v) => v.slug)).toContain(
        'tiger-ii-h',
      )
    }
  })

  it('catches one-typo queries via the similarity tier', async () => {
    expect((await search(t.db, 'tigre')).vehicles.map((v) => v.slug)).toContain(
      'tiger-ii-h',
    )
  })

  it('ranks shorter exact matches above longer ones', async () => {
    expect((await search(t.db, 'm1')).vehicles.map((v) => v.slug)).toEqual([
      'm163',
      'm18-gmc',
    ])
  })

  it('treats LIKE metacharacters in the term literally', async () => {
    await t.db.insert(players).values([
      { slug: 'x_ace', displayName: 'x_ace' },
      { slug: 'x1ace', displayName: 'x1ace' },
    ])
    const res = await search(t.db, 'x_ace')
    expect(res.players.map((p) => p.slug)).toEqual(['x_ace'])
  })
})

describe('browseVehicles', () => {
  const filters = (params: Parameters<typeof browseFilters>[0] = {}) =>
    browseFilters(params)

  it('returns the whole branch population unfiltered, name-ordered', async () => {
    const r = await browseVehicles(t.db, 'grb', filters())
    expect(r?.total).toBe(7)
    expect(r?.pageCount).toBe(1)
    expect(r?.rows.map((v) => v.vehicleName)).toEqual([
      'M163',
      'M18 GMC',
      'M26',
      'M4A1',
      'Panther D',
      'Tiger II (H)',
      'Wirbelwind',
    ])
  })

  it('composes AND across categories, OR within one', async () => {
    const r = await browseVehicles(
      t.db,
      'grb',
      filters({ nation: 'germany', class: 'heavy,medium' }),
    )
    expect(r?.rows.map((v) => v.vehicleSlug)).toEqual([
      'panther-d',
      'tiger-ii-h',
    ])
  })

  it('splits held titles from open bounties', async () => {
    const open = await browseVehicles(t.db, 'grb', filters({ status: 'open' }))
    expect(open?.rows.map((v) => v.vehicleSlug).sort()).toEqual([
      'm163',
      'm18-gmc',
      'wirbelwind',
    ])
    const held = await browseVehicles(t.db, 'grb', filters({ status: 'held' }))
    expect(held?.total).toBe(4)
    expect(held?.rows.every((v) => v.playerSlug !== null)).toBe(true)
  })

  it('BR range is inclusive at both bounds', async () => {
    const r = await browseVehicles(t.db, 'grb', filters({ br: '3.7-5.7' }))
    expect(r?.rows.map((v) => v.vehicleSlug).sort()).toEqual([
      'm18-gmc',
      'm4a1',
      'panther-d',
    ])
  })

  it('acquisition chips OR together; tech-tree means unflagged', async () => {
    await seedDemo(t.db)
    const eventOrRemoved = await browseVehicles(
      t.db,
      'grb',
      filters({ acq: 'event,removed' }),
    )
    expect(eventOrRemoved?.rows.map((v) => v.vehicleSlug).sort()).toEqual([
      'is-7',
      'maus',
      'object-279',
      't-34-100',
    ])
    const tree = await browseVehicles(
      t.db,
      'grb',
      filters({ acq: 'tech-tree' }),
    )
    expect(
      tree?.rows.every((v) => !v.isEvent && !v.isPremium && !v.isSquadron),
    ).toBe(true)
    // Removed is orthogonal to acquisition — a removed tech-tree stays tech-tree.
    expect(tree?.rows.some((v) => v.isRemoved)).toBe(false)
  })

  it('q matches via search terms and leads with relevance', async () => {
    const r = await browseVehicles(t.db, 'grb', filters({ q: 'm1' }))
    expect(r?.rows.map((v) => v.vehicleSlug)).toEqual(['m163', 'm18-gmc'])
    const tiger = await browseVehicles(t.db, 'grb', filters({ q: 'tiger 2' }))
    expect(tiger?.rows.map((v) => v.vehicleSlug)).toEqual(['tiger-ii-h'])
  })

  it('explicit sort overrides, nulls last', async () => {
    const r = await browseVehicles(
      t.db,
      'grb',
      filters({ sort: 'br', dir: 'desc' }),
    )
    expect(r?.rows[0].vehicleSlug).toBe('m163')
    expect(r?.rows[0].br).toBe(8.7)
  })

  it('clamps a page past the end instead of returning nothing', async () => {
    const r = await browseVehicles(t.db, 'grb', filters({ page: 99 }))
    expect(r?.page).toBe(1)
    expect(r?.rows).toHaveLength(7)
  })

  it('returns null for an unknown mode', async () => {
    expect(await browseVehicles(t.db, 'nope', filters())).toBeNull()
  })
})

describe('lookupVehicles', () => {
  it('scopes to the mode branch and carries that mode BR', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const jets = await t.db
      .insert(vehicles)
      .values({
        externalId: 'tiger_jet',
        name: 'Tiger Jet',
        slug: 'tiger-jet',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    await replaceSearchTerms(t.db, jets)

    const found = await lookupVehicles(t.db, 'grb', 'tiger')
    expect(found.map((v) => v.slug)).toEqual(['tiger-ii-h'])
    expect(found[0].br).toBe(6.7)
  })

  it('returns nothing for an unknown mode', async () => {
    expect(await lookupVehicles(t.db, 'nope', 'tiger')).toEqual([])
  })
})

describe('removed vehicles', () => {
  async function addRemovedUsaTank(isRemoved = true) {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const [v] = await t.db
      .insert(vehicles)
      .values({
        externalId: 'us_removed',
        name: 'Removed Tank',
        slug: 'removed-tank',
        nationId: usa.id,
        branch: 'ground',
        class: 'medium',
        isRemoved,
      })
      .returning()
    return v
  }

  it('are still counted in eligibility and completion (metadata, not a filter)', async () => {
    await addRemovedUsaTank()
    expect((await getModeStats(t.db, 'grb'))?.eligibleVehicles).toBe(8)
    const usaRow = (await listNations(t.db, 'grb'))?.find(
      (n) => n.slug === 'usa',
    )
    expect(usaRow?.eligibleVehicles).toBe(5)
  })

  it('render everywhere they appear, flagged with isRemoved', async () => {
    const veh = await addRemovedUsaTank()
    const [ace] = await t.db
      .select()
      .from(players)
      .where(eq(players.slug, 'ace'))
    await t.db.insert(records).values({
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
      kills: 20,
      status: 'verified',
      isCurrent: true,
    })

    const sheet = await getNationSheet(t.db, 'grb', 'usa')
    expect(
      sheet?.rows.find((r) => r.vehicleSlug === 'removed-tank')?.isRemoved,
    ).toBe(true)

    const v = await getVehicle(t.db, 'grb', 'removed-tank')
    expect(v?.vehicle.isRemoved).toBe(true)
    expect(v?.current?.kills).toBe(20)

    // The record on the removed vehicle counts toward the leaderboard + profile.
    expect(
      (await getLeaderboard(t.db, 'grb')).find((r) => r.slug === 'ace')
        ?.records,
    ).toBe(3)
    const p = await getPlayer(t.db, 'ace')
    expect(
      p?.records.find((r) => r.vehicleSlug === 'removed-tank')?.isRemoved,
    ).toBe(true)
  })
})

describe('acquisition flags', () => {
  // The flags overlap in WT — an event vehicle can also be premium.
  async function addEventPremiumRecord() {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const [veh] = await t.db
      .insert(vehicles)
      .values({
        externalId: 'us_event_prem',
        name: 'Event Premium Tank',
        slug: 'event-premium-tank',
        nationId: usa.id,
        branch: 'ground',
        class: 'medium',
        isEvent: true,
        isPremium: true,
      })
      .returning()
    await replaceSearchTerms(t.db, [veh])
    const [ace] = await t.db
      .select()
      .from(players)
      .where(eq(players.slug, 'ace'))
    await t.db.insert(records).values({
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
      kills: 20,
      status: 'verified',
      isCurrent: true,
    })
  }

  it('flow through the landing record rows', async () => {
    await addEventPremiumRecord()

    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.topRecords[0]).toMatchObject({
      vehicleSlug: 'event-premium-tank',
      isEvent: true,
      isPremium: true,
      isSquadron: false,
      isRemoved: false,
    })
    expect(landing.topRecords[1]).toMatchObject({
      vehicleSlug: 'm4a1',
      isEvent: false,
      isPremium: false,
      isSquadron: false,
    })
    expect(landing.contestedTitles[0]).toMatchObject({
      vehicleSlug: 'm4a1',
      isEvent: false,
      isPremium: false,
      isSquadron: false,
    })
    expect(landing.fallen[0]).toMatchObject({
      vehicleSlug: 'm4a1',
      isEvent: false,
      isPremium: false,
      isSquadron: false,
    })
  })

  it('flow through the nation sheet, vehicle page, player profile and search', async () => {
    await addEventPremiumRecord()
    const flagged = {
      isEvent: true,
      isPremium: true,
      isSquadron: false,
      isRemoved: false,
    }

    const sheet = await getNationSheet(t.db, 'grb', 'usa')
    expect(
      sheet?.rows.find((r) => r.vehicleSlug === 'event-premium-tank'),
    ).toMatchObject(flagged)

    const v = await getVehicle(t.db, 'grb', 'event-premium-tank')
    expect(v?.vehicle).toMatchObject(flagged)

    const p = await getPlayer(t.db, 'ace')
    expect(
      p?.records.find((r) => r.vehicleSlug === 'event-premium-tank'),
    ).toMatchObject(flagged)

    const found = await search(t.db, 'Event Premium')
    expect(found.vehicles[0]).toMatchObject(flagged)
  })
})

async function vehicleBySlug(slug: string) {
  const [v] = await t.db.select().from(vehicles).where(eq(vehicles.slug, slug))
  return v
}

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

async function setCurrentVerifiedAt(vehicleSlug: string, when: Date) {
  const v = await vehicleBySlug(vehicleSlug)
  await t.db
    .update(records)
    .set({ verifiedAt: when })
    .where(
      and(
        eq(records.vehicleId, v.id),
        eq(records.mode, 'grb'),
        eq(records.isCurrent, true),
      ),
    )
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

// The seed dates records relative to now for a living dev landing; tests that
// assert on time windows first push everything safely out of every window.
async function resetDates() {
  await t.db.update(records).set({ verifiedAt: null, submittedAt: daysAgo(60) })
}

describe('getModeLanding top records', () => {
  it('ranks the five highest current verified kill counts', async () => {
    const landing = await getModeLanding(t.db, 'grb')
    expect(
      landing.topRecords.map((r) => [r.vehicleSlug, r.kills, r.displayName]),
    ).toEqual([
      ['m4a1', 14, 'Ace'],
      ['panther-d', 13, 'Ace'],
      ['m26', 11, 'Maverick'],
      ['tiger-ii-h', 8, 'Floppa'],
    ])
    expect(landing.topRecords[0].nationName).toBe('USA')
  })

  it('never crowns an off-branch record, matching the stats views', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const ace = await playerBySlug('ace')
    const [jet] = await t.db
      .insert(vehicles)
      .values({
        externalId: 'jet_top',
        name: 'JetTop',
        slug: 'jet-top',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    // Invalid data (no constraint forbids it): a ground-mode record on an
    // air vehicle with a crown-taking kill count.
    await t.db.insert(records).values({
      vehicleId: jet.id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
      kills: 99,
      status: 'verified',
      isCurrent: true,
    })
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.topRecords[0].vehicleSlug).toBe('m4a1')
    expect(landing.topRecords.map((r) => r.vehicleSlug)).not.toContain(
      'jet-top',
    )
  })
})

describe('getModeLanding latest feed', () => {
  it('ranks a record with a real verifiedAt ahead of NULL-verifiedAt rows', async () => {
    await resetDates()
    await setCurrentVerifiedAt('m26', new Date('2030-01-01T00:00:00Z'))
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.latestFeed[0].vehicleSlug).toBe('m26')
  })

  it('logs superseded entries too — they were real when they landed', async () => {
    const landing = await getModeLanding(t.db, 'grb')
    const m4a1Entries = landing.latestFeed.filter(
      (r) => r.vehicleSlug === 'm4a1',
    )
    expect(m4a1Entries.map((r) => r.kills).sort()).toEqual([12, 14, 9])
  })
})

describe('getModeLanding week top', () => {
  it('includes only records verified in the current week', async () => {
    await resetDates()
    await setCurrentVerifiedAt('m4a1', new Date())
    await setCurrentVerifiedAt('panther-d', daysAgo(14))
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.weekTop.map((r) => r.vehicleSlug)).toEqual(['m4a1'])
  })
})

describe('getModeLanding verification queue', () => {
  it('counts pending, this-week verifications, and the median review time', async () => {
    await resetDates()
    const now = Date.now()
    const m4 = await vehicleBySlug('m4a1')
    await t.db
      .update(records)
      .set({
        submittedAt: new Date(now - 2 * 3_600_000),
        verifiedAt: new Date(now),
      })
      .where(
        and(
          eq(records.vehicleId, m4.id),
          eq(records.mode, 'grb'),
          eq(records.isCurrent, true),
        ),
      )

    const landing = await getModeLanding(t.db, 'grb')
    // The seeded Wirbelwind submission is the one pending row.
    expect(landing.verifyQueue.pending).toBe(1)
    expect(landing.verifyQueue.verifiedThisWeek).toBe(1)
    expect(landing.verifyQueue.medianReviewSecs).toBeCloseTo(7200, -1)
  })

  it('is all-zero on a mode with no records', async () => {
    const landing = await getModeLanding(t.db, 'gab')
    expect(landing.verifyQueue).toEqual({
      pending: 0,
      verifiedThisWeek: 0,
      medianReviewSecs: null,
    })
  })
})

describe('getModeLanding contested titles', () => {
  it('ranks titles by verified-record count, only count ≥ 2 qualifies', async () => {
    const landing = await getModeLanding(t.db, 'grb')
    // Straight from the seed: only the M4A1 has changed hands (3 verified
    // records); every other title has one and must not appear.
    expect(landing.contestedTitles).toEqual([
      {
        vehicleSlug: 'm4a1',
        vehicleName: 'M4A1',
        isEvent: false,
        isPremium: false,
        isSquadron: false,
        isRemoved: false,
        nationName: 'USA',
        nationSlug: 'usa',
        contests: 3,
        kills: 14,
        playerSlug: 'ace',
        displayName: 'Ace',
      },
    ])
  })

  it('counts a holder beating their own record as a contest', async () => {
    const panther = await vehicleBySlug('panther-d')
    const ace = await playerBySlug('ace')
    // Ace held the Panther D at 10 before improving to his current 13.
    await t.db.insert(records).values({
      vehicleId: panther.id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      patch: '2.51',
      kills: 10,
      status: 'verified',
      isCurrent: false,
    })
    const landing = await getModeLanding(t.db, 'grb')
    expect(
      landing.contestedTitles.map((c) => [c.vehicleSlug, c.contests]),
    ).toEqual([
      ['m4a1', 3],
      ['panther-d', 2],
    ])
    expect(landing.contestedTitles[1]).toMatchObject({
      kills: 13,
      playerSlug: 'ace',
      displayName: 'Ace',
    })
  })

  it('breaks contest-count ties alphabetically', async () => {
    const floppa = await playerBySlug('floppa')
    const m26 = await vehicleBySlug('m26')
    const tiger = await vehicleBySlug('tiger-ii-h')
    // A superseded record each on the M26 and Tiger II (H) ties them at 2.
    await t.db.insert(records).values(
      [m26, tiger].map((v) => ({
        vehicleId: v.id,
        mode: 'grb',
        playerId: floppa.id,
        ignSnapshot: 'Floppa',
        patch: '2.49',
        kills: 5,
        status: 'verified' as const,
        isCurrent: false,
      })),
    )
    const landing = await getModeLanding(t.db, 'grb')
    expect(
      landing.contestedTitles.map((c) => [c.vehicleSlug, c.contests]),
    ).toEqual([
      ['m4a1', 3],
      ['m26', 2],
      ['tiger-ii-h', 2],
    ])
  })

  it('ignores pending and rejected submissions', async () => {
    const m26 = await vehicleBySlug('m26')
    const floppa = await playerBySlug('floppa')
    await t.db.insert(records).values(
      (['pending', 'rejected'] as const).map((status) => ({
        vehicleId: m26.id,
        mode: 'grb',
        playerId: floppa.id,
        ignSnapshot: 'Floppa',
        patch: '2.53',
        kills: 15,
        status,
        isCurrent: false,
      })),
    )
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.contestedTitles.map((c) => c.vehicleSlug)).toEqual(['m4a1'])
  })

  it('never lists an off-branch title, matching the stats views', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const ace = await playerBySlug('ace')
    const [jet] = await t.db
      .insert(vehicles)
      .values({
        externalId: 'jet_contest',
        name: 'JetContest',
        slug: 'jet-contest',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    // Invalid data (no constraint forbids it): ground-mode records on an
    // air vehicle, enough of them to qualify as contested.
    await t.db.insert(records).values(
      [false, true].map((isCurrent) => ({
        vehicleId: jet.id,
        mode: 'grb',
        playerId: ace.id,
        ignSnapshot: 'Ace',
        patch: '2.53',
        kills: isCurrent ? 99 : 98,
        status: 'verified' as const,
        isCurrent,
      })),
    )
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.contestedTitles.map((c) => c.vehicleSlug)).toEqual(['m4a1'])
  })
})

describe('getModeLanding fallen records', () => {
  it('reports recently superseded titles with old and new holders', async () => {
    // Straight from the seed: Ace took the M4A1 title two days ago.
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.fallen).toHaveLength(1)
    expect(landing.fallen[0]).toMatchObject({
      vehicleSlug: 'm4a1',
      oldKills: 12,
      oldHolder: 'Maverick',
      newKills: 14,
      newHolder: 'Ace',
    })
  })

  it('omits recent records that dethroned nobody', async () => {
    await resetDates()
    await setCurrentVerifiedAt('panther-d', daysAgo(2))
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.fallen).toEqual([])
  })
})

describe('getModeLanding history steps', () => {
  it('returns the top vehicle record progression when it has history', async () => {
    const landing = await getModeLanding(t.db, 'grb')
    // Top vehicle is the M4A1: Floppa 9 → Maverick 12 → Ace 14.
    expect(landing.historySteps.map((s) => [s.kills, s.displayName])).toEqual([
      [9, 'Floppa'],
      [12, 'Maverick'],
      [14, 'Ace'],
    ])
  })

  it('is empty when the top vehicle has a single verified record', async () => {
    // Retire the M4A1 history rows so the top vehicle has no progression.
    const m4 = await vehicleBySlug('m4a1')
    await t.db
      .update(records)
      .set({ status: 'rejected' })
      .where(and(eq(records.vehicleId, m4.id), eq(records.isCurrent, false)))
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.historySteps).toEqual([])
  })
})

describe('getModeLanding longest standing', () => {
  it('lists the oldest still-current records first', async () => {
    const landing = await getModeLanding(t.db, 'grb')
    expect(landing.longestStanding.map((r) => r.vehicleSlug)).toEqual([
      'panther-d',
      'm26',
      'm4a1',
    ])
  })
})

describe('getModeLanding empty mode', () => {
  it('returns empty sections without crashing', async () => {
    const landing = await getModeLanding(t.db, 'gab')
    expect(landing.topRecords).toEqual([])
    expect(landing.latestFeed).toEqual([])
    expect(landing.weekTop).toEqual([])
    expect(landing.contestedTitles).toEqual([])
    expect(landing.fallen).toEqual([])
    expect(landing.historySteps).toEqual([])
    expect(landing.longestStanding).toEqual([])
  })
})

describe('mode scoping', () => {
  it('getVehicle is null for a wrong-branch vehicle, valid under its own mode', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    await t.db.insert(vehicles).values({
      externalId: 'jet1',
      name: 'Jet',
      slug: 'jet',
      nationId: usa.id,
      branch: 'air',
      class: 'fighter',
    })
    expect(await getVehicle(t.db, 'grb', 'jet')).toBeNull()
    expect((await getVehicle(t.db, 'arb', 'jet'))?.vehicle.name).toBe('Jet')
  })

  it('getPlayer omits records from non-live modes', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const [ace] = await t.db
      .select()
      .from(players)
      .where(eq(players.slug, 'ace'))
    const [jet] = await t.db
      .insert(vehicles)
      .values({
        externalId: 'jet2',
        name: 'Jet2',
        slug: 'jet2',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    await t.db.insert(records).values({
      vehicleId: jet.id,
      mode: 'arb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
      kills: 9,
      status: 'verified',
      isCurrent: true,
    })
    const p = await getPlayer(t.db, 'ace')
    expect(p?.records.map((r) => r.mode)).not.toContain('arb')
    expect(p?.records.map((r) => r.vehicleSlug)).toEqual(['m4a1', 'panther-d'])
  })

  it('getPlayer omits an off-branch record, matching the stats views', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    const [ace] = await t.db
      .select()
      .from(players)
      .where(eq(players.slug, 'ace'))
    const [jet] = await t.db
      .insert(vehicles)
      .values({
        externalId: 'jet3',
        name: 'Jet3',
        slug: 'jet3',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    // Invalid data (no constraint forbids it): a ground-mode record on an
    // air vehicle.
    await t.db.insert(records).values({
      vehicleId: jet.id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
      kills: 99,
      status: 'verified',
      isCurrent: true,
    })
    const p = await getPlayer(t.db, 'ace')
    expect(p?.records.map((r) => r.vehicleSlug)).toEqual(['m4a1', 'panther-d'])
  })
})
