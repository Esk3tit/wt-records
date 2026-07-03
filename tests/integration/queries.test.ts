import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { modes, nations, records, players, vehicles } from '#/db/schema'
import {
  getLeaderboard,
  getMode,
  getModeHome,
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
      { slug: 'm4a1', name: 'M4A1', isRemoved: false, linkMode: 'grb' },
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
    await t.db.insert(vehicles).values({
      externalId: 'jetx',
      name: 'Jetx',
      slug: 'jetx',
      nationId: usa.id,
      branch: 'air',
      class: 'fighter',
    })
    // ARB is not live yet → no link target.
    expect((await search(t.db, 'Jetx')).vehicles[0].linkMode).toBeNull()
    await t.db.update(modes).set({ isLive: true }).where(eq(modes.mode, 'arb'))
    expect((await search(t.db, 'Jetx')).vehicles[0].linkMode).toBe('arb')
  })

  it('returns empty results for a blank query', async () => {
    expect(await search(t.db, '   ')).toEqual({ players: [], vehicles: [] })
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

describe('getModeHome latest ordering', () => {
  it('ranks a record with a real verifiedAt ahead of NULL-verifiedAt rows', async () => {
    const [m26] = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.slug, 'm26'))
    await t.db
      .update(records)
      .set({ verifiedAt: new Date('2030-01-01T00:00:00Z') })
      .where(
        and(
          eq(records.vehicleId, m26.id),
          eq(records.mode, 'grb'),
          eq(records.isCurrent, true),
        ),
      )

    const home = await getModeHome(t.db, 'grb')
    expect(home.latest?.vehicleSlug).toBe('m26')
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
      kills: 99,
      status: 'verified',
      isCurrent: true,
    })
    const p = await getPlayer(t.db, 'ace')
    expect(p?.records.map((r) => r.vehicleSlug)).toEqual(['m4a1', 'panther-d'])
  })
})
