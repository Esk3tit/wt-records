import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import {
  globalStats,
  leaderboard,
  nationStats,
  leaderboardAllModes,
  modes,
  nations,
  playerStats,
  players,
  records,
  vehicles,
} from '#/db/schema'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
})
afterEach(async () => {
  await t.client.close()
})

describe('player_stats', () => {
  it('aggregates current verified records per (mode, player)', async () => {
    const rows = await t.db
      .select()
      .from(playerStats)
      .where(eq(playerStats.mode, 'grb'))
      .orderBy(asc(playerStats.records))

    const byPlayer = new Map(rows.map((r) => [r.playerId, r]))
    expect(rows).toHaveLength(3)
    const stats = [...byPlayer.values()].map((r) => ({
      records: r.records,
      totalKills: r.totalKills,
      avgKills: r.avgKills,
    }))
    // Ace holds M4A1 (14) + Panther D (13); Maverick's superseded M4A1 (12)
    // must not count — he only holds M26 (11); Floppa holds Tiger II (8).
    expect(stats).toEqual(
      expect.arrayContaining([
        { records: 2, totalKills: 27, avgKills: 13.5 },
        { records: 1, totalKills: 11, avgKills: 11 },
        { records: 1, totalKills: 8, avgKills: 8 },
      ]),
    )
  })

  it('has no rows for a mode without records', async () => {
    expect(
      await t.db.select().from(playerStats).where(eq(playerStats.mode, 'gab')),
    ).toEqual([])
  })
})

describe('leaderboard', () => {
  it('ranks players per mode by current verified record count, ties sharing a rank', async () => {
    const rows = await t.db
      .select({
        rank: leaderboard.rank,
        slug: leaderboard.slug,
        displayName: leaderboard.displayName,
        records: leaderboard.records,
      })
      .from(leaderboard)
      .where(eq(leaderboard.mode, 'grb'))
      .orderBy(asc(leaderboard.rank), asc(leaderboard.displayName))

    expect(rows).toEqual([
      { rank: 1, slug: 'ace', displayName: 'Ace', records: 2 },
      { rank: 2, slug: 'floppa', displayName: 'Floppa', records: 1 },
      { rank: 2, slug: 'maverick', displayName: 'Maverick', records: 1 },
    ])
  })
})

describe('leaderboard_all_modes', () => {
  it('counts records across live modes only, matching the coming-soon gate', async () => {
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
        externalId: 'jet_lb',
        name: 'Jet LB',
        slug: 'jet-lb',
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

    const board = () =>
      t.db
        .select({
          slug: leaderboardAllModes.slug,
          records: leaderboardAllModes.records,
          rank: leaderboardAllModes.rank,
        })
        .from(leaderboardAllModes)
        .orderBy(asc(leaderboardAllModes.rank), asc(leaderboardAllModes.slug))

    // ARB is not live: the jet record must not leak into the public board.
    expect(await board()).toEqual([
      { slug: 'ace', records: 2, rank: 1 },
      { slug: 'floppa', records: 1, rank: 2 },
      { slug: 'maverick', records: 1, rank: 2 },
    ])

    await t.db.update(modes).set({ isLive: true }).where(eq(modes.mode, 'arb'))
    expect((await board())[0]).toEqual({ slug: 'ace', records: 3, rank: 1 })
  })
})

describe('global_stats', () => {
  function grbRow() {
    return t.db
      .select()
      .from(globalStats)
      .where(eq(globalStats.mode, 'grb'))
      .then((rows) => rows[0])
  }

  it('aggregates the mode: counts, completion, averages, latest record', async () => {
    const [panther] = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.slug, 'panther-d'))
    const [pantherRecord] = await t.db
      .select()
      .from(records)
      .where(and(eq(records.vehicleId, panther.id), eq(records.mode, 'grb')))

    expect(await grbRow()).toEqual({
      mode: 'grb',
      records: 4,
      holders: 3,
      coveredVehicles: 4,
      eligibleVehicles: 7,
      remainingVehicles: 3,
      completionPct: 57,
      avgKills: 11.5,
      medianKills: 12,
      // All verified_at are NULL: newest insert (Panther D) wins on id.
      latestRecordId: pantherRecord.id,
    })
  })

  it('ranks a record with a real verifiedAt ahead of NULL-verifiedAt rows', async () => {
    const [m26] = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.slug, 'm26'))
    await t.db
      .update(records)
      .set({ verifiedAt: new Date('2030-01-01T00:00:00Z') })
      .where(and(eq(records.vehicleId, m26.id), eq(records.mode, 'grb')))
    const [m26Record] = await t.db
      .select()
      .from(records)
      .where(and(eq(records.vehicleId, m26.id), eq(records.mode, 'grb')))

    expect((await grbRow()).latestRecordId).toBe(m26Record.id)
  })

  it('reports a recordless mode as all-zero with the full denominator remaining', async () => {
    const [gab] = await t.db
      .select()
      .from(globalStats)
      .where(eq(globalStats.mode, 'gab'))
    expect(gab).toEqual({
      mode: 'gab',
      records: 0,
      holders: 0,
      coveredVehicles: 0,
      eligibleVehicles: 7,
      remainingVehicles: 7,
      completionPct: 0,
      avgKills: null,
      medianKills: null,
      latestRecordId: null,
    })
  })

  it('includes premium, squadron, event and removed vehicles in the denominator', async () => {
    const [usa] = await t.db
      .select()
      .from(nations)
      .where(eq(nations.slug, 'usa'))
    await t.db.insert(vehicles).values(
      (
        [
          ['prem', { isPremium: true }],
          ['squad', { isSquadron: true }],
          ['event', { isEvent: true }],
          ['gone', { isRemoved: true }],
        ] as const
      ).map(([slug, flags]) => ({
        externalId: `den_${slug}`,
        name: slug,
        slug: `den-${slug}`,
        nationId: usa.id,
        branch: 'ground' as const,
        class: 'medium' as const,
        ...flags,
      })),
    )

    const row = await grbRow()
    expect(row.eligibleVehicles).toBe(11)
    expect(row.remainingVehicles).toBe(7)
    expect(row.completionPct).toBe(36)
  })

  it('never counts a record whose vehicle is off-branch for the mode', async () => {
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
        externalId: 'jet_gs',
        name: 'Jet GS',
        slug: 'jet-gs',
        nationId: usa.id,
        branch: 'air',
        class: 'fighter',
      })
      .returning()
    // Invalid data (no constraint forbids it): a ground-mode record on an air
    // vehicle. It must not inflate covered past the branch-scoped denominator.
    await t.db.insert(records).values({
      vehicleId: jet.id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      kills: 99,
      status: 'verified',
      isCurrent: true,
    })

    const row = await grbRow()
    expect(row).toMatchObject({
      records: 4,
      coveredVehicles: 4,
      eligibleVehicles: 7,
      remainingVehicles: 3,
      completionPct: 57,
    })

    // player_stats shares the branch guard, so the leaderboard agrees.
    const [aceRow] = await t.db
      .select()
      .from(playerStats)
      .where(and(eq(playerStats.mode, 'grb'), eq(playerStats.playerId, ace.id)))
    expect(aceRow.records).toBe(2)
    expect(aceRow.totalKills).toBe(27)
  })
})

describe('view security', () => {
  it('every stats view is security_invoker, so RLS applies to the caller', async () => {
    const { rows } = await t.client.query<{
      relname: string
      reloptions: Array<string> | null
    }>(
      `select relname, reloptions from pg_class
       where relkind = 'v' and relnamespace = 'public'::regnamespace`,
    )
    const views = new Map(rows.map((r) => [r.relname, r.reloptions]))
    for (const name of [
      'player_stats',
      'leaderboard',
      'leaderboard_all_modes',
      'global_stats',
      'nation_stats',
    ]) {
      expect(views.get(name), name).toContain('security_invoker=true')
    }
  })
})

describe('nation_stats', () => {
  it('reports per-nation coverage for the mode, ordered by nation sort', async () => {
    const rows = await t.db
      .select({
        slug: nationStats.slug,
        name: nationStats.name,
        eligibleVehicles: nationStats.eligibleVehicles,
        coveredVehicles: nationStats.coveredVehicles,
        completionPct: nationStats.completionPct,
        avgKills: nationStats.avgKills,
      })
      .from(nationStats)
      .where(eq(nationStats.mode, 'grb'))
      .orderBy(asc(nationStats.sort))

    expect(rows).toEqual([
      {
        slug: 'usa',
        name: 'USA',
        eligibleVehicles: 4,
        coveredVehicles: 2,
        completionPct: 50,
        avgKills: 12.5,
      },
      {
        slug: 'germany',
        name: 'Germany',
        eligibleVehicles: 3,
        coveredVehicles: 2,
        completionPct: 67,
        avgKills: 10.5,
      },
    ])
  })

  it('keeps every nation present for a recordless mode, at zero coverage', async () => {
    const rows = await t.db
      .select()
      .from(nationStats)
      .where(eq(nationStats.mode, 'gab'))
      .orderBy(asc(nationStats.sort))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      slug: 'usa',
      eligibleVehicles: 4,
      coveredVehicles: 0,
      completionPct: 0,
      avgKills: null,
    })
  })
})
