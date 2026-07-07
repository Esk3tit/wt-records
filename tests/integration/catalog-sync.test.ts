import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import type { CatalogSnapshot, SourceVehicle } from '#/catalog/source'
import { syncCatalog } from '#/catalog/sync'
import {
  modes,
  nations,
  patches,
  players,
  records,
  vehicleBr,
  vehicleSearchTerms,
  vehicles,
} from '#/db/schema'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await t.db.insert(modes).values([
    { mode: 'grb', name: 'Ground RB', branch: 'ground', isLive: true, sort: 1 },
    { mode: 'gab', name: 'Ground AB', branch: 'ground', sort: 2 },
    { mode: 'arb', name: 'Air RB', branch: 'air', sort: 3 },
    { mode: 'aab', name: 'Air AB', branch: 'air', sort: 4 },
  ])
})
afterEach(async () => {
  await t.client.close()
})

function vehicle(overrides: Partial<SourceVehicle> = {}): SourceVehicle {
  return {
    externalId: 'us_m1_abrams',
    name: 'M1 Abrams',
    country: 'usa',
    vehicleType: 'medium_tank',
    era: 6,
    arcadeBr: 10.3,
    realisticBr: 10.3,
    simulatorBr: 10.3,
    isPremium: false,
    isSquadron: false,
    event: null,
    imageUrl: 'https://example.test/us_m1_abrams.png',
    ...overrides,
  }
}

function snapshot(
  vehicleList: Array<SourceVehicle>,
  gameVersion = '2.57.0.8',
): CatalogSnapshot {
  return { gameVersion, vehicles: vehicleList }
}

const relaxed = { minVehicles: 0 }

describe('syncCatalog', () => {
  it('lands a fresh snapshot: vehicles, nations, patch, and per-mode BR rows', async () => {
    const summary = await syncCatalog(
      t.db,
      snapshot([
        vehicle(),
        vehicle({
          externalId: 'germ_flakpanzer_IV_Wirbelwind',
          name: 'Wirbelwind',
          country: 'germany',
          vehicleType: 'spaa',
          era: 3,
          arcadeBr: 4.0,
          realisticBr: 3.7,
          simulatorBr: 3.7,
          event: 'summer_2020',
          isPremium: true,
        }),
        vehicle({
          externalId: 'us_a_20g',
          name: 'A-20G-25',
          country: 'usa',
          vehicleType: 'assault',
          era: 2,
          arcadeBr: 2.7,
          realisticBr: 3.0,
          simulatorBr: 3.0,
          isSquadron: true,
        }),
      ]),
      relaxed,
    )

    const vehicleRows = await t.db
      .select()
      .from(vehicles)
      .orderBy(asc(vehicles.externalId))
    expect(vehicleRows).toHaveLength(3)

    const wirbel = vehicleRows[0]
    expect(wirbel.name).toBe('Wirbelwind')
    expect(wirbel.slug).toBe('wirbelwind')
    expect(wirbel.branch).toBe('ground')
    expect(wirbel.class).toBe('spaa')
    expect(wirbel.rank).toBe(3)
    expect(wirbel.isEvent).toBe(true)
    expect(wirbel.isPremium).toBe(true)
    expect(wirbel.isSquadron).toBe(false)
    expect(wirbel.isRemoved).toBe(false)
    expect(wirbel.lastSyncedAt).not.toBeNull()

    const a20 = vehicleRows[1]
    expect(a20.branch).toBe('air')
    expect(a20.class).toBe('attacker')
    expect(a20.isSquadron).toBe(true)
    expect(a20.imageUrl).toBe('https://example.test/us_m1_abrams.png')

    const nationRows = await t.db
      .select()
      .from(nations)
      .orderBy(asc(nations.sort))
    expect(nationRows).toHaveLength(10)
    expect(nationRows[0]).toMatchObject({ slug: 'usa', name: 'USA', sort: 1 })
    expect(wirbel.nationId).toBe(
      nationRows.find((n) => n.slug === 'germany')!.id,
    )

    expect(await t.db.select().from(patches)).toMatchObject([
      { version: '2.57' },
    ])

    // ground vehicles get grb+gab rows, air vehicles arb+aab — never cross-branch
    const brRows = await t.db.select().from(vehicleBr)
    const byVehicle = (id: number) =>
      brRows.filter((r) => r.vehicleId === id).map((r) => `${r.mode}:${r.br}`)
    expect(byVehicle(wirbel.id).sort()).toEqual(['gab:4', 'grb:3.7'])
    expect(byVehicle(a20.id).sort()).toEqual(['aab:2.7', 'arb:3'])

    expect(summary).toMatchObject({
      gameVersion: '2.57.0.8',
      patch: '2.57',
      inserted: 3,
      updated: 0,
      removed: 0,
      brRows: 6,
      warnings: [],
    })
  })

  it('re-running the same snapshot is idempotent', async () => {
    const snap = snapshot([vehicle(), vehicle({ externalId: 'us_m26' })])
    await syncCatalog(t.db, snap, relaxed)
    const second = await syncCatalog(t.db, snap, relaxed)

    expect(second).toMatchObject({ inserted: 0, updated: 2, removed: 0 })
    expect(await t.db.select().from(vehicles)).toHaveLength(2)
    expect(await t.db.select().from(vehicleBr)).toHaveLength(4)
    expect(await t.db.select().from(patches)).toHaveLength(1)
  })

  it('flags vehicles missing from the snapshot as removed, and restores them when they return', async () => {
    const both = snapshot([vehicle(), vehicle({ externalId: 'us_m26' })])
    await syncCatalog(t.db, both, relaxed)

    const onlyOne = snapshot([vehicle()])
    const removal = await syncCatalog(t.db, onlyOne, relaxed)
    expect(removal).toMatchObject({ removed: 1, restored: 0 })
    const m26 = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.externalId, 'us_m26'))
    expect(m26[0].isRemoved).toBe(true)
    // removed vehicles keep their BR rows — they stay fully visible (metadata-only)
    expect(
      await t.db
        .select()
        .from(vehicleBr)
        .where(eq(vehicleBr.vehicleId, m26[0].id)),
    ).toHaveLength(2)
    // and their search terms — removed vehicles stay searchable
    expect(
      (
        await t.db
          .select()
          .from(vehicleSearchTerms)
          .where(eq(vehicleSearchTerms.vehicleId, m26[0].id))
      ).length,
    ).toBeGreaterThan(0)

    const restore = await syncCatalog(t.db, both, relaxed)
    expect(restore).toMatchObject({ removed: 0, restored: 1 })
    const m26Back = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.externalId, 'us_m26'))
    expect(m26Back[0].isRemoved).toBe(false)
  })

  it('keeps the slug stable when the display name changes upstream', async () => {
    await syncCatalog(t.db, snapshot([vehicle()]), relaxed)
    await syncCatalog(
      t.db,
      snapshot([vehicle({ name: 'M1 Abrams (105)' })]),
      relaxed,
    )

    const [row] = await t.db.select().from(vehicles)
    expect(row.name).toBe('M1 Abrams (105)')
    expect(row.slug).toBe('m1-abrams')

    // A rename fully replaces the search terms — no stale variants linger.
    const terms = (await t.db.select().from(vehicleSearchTerms)).map(
      (r) => r.term,
    )
    expect(terms).toContain('m1abrams105')
    expect(terms).not.toContain('m1abrams')
  })

  it('never touches the manual isDifficult overlay', async () => {
    await syncCatalog(t.db, snapshot([vehicle()]), relaxed)
    await t.db
      .update(vehicles)
      .set({ isDifficult: true })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))

    await syncCatalog(t.db, snapshot([vehicle({ era: 7 })]), relaxed)

    const [row] = await t.db.select().from(vehicles)
    expect(row.isDifficult).toBe(true)
    expect(row.rank).toBe(7)
  })

  it('disambiguates same-name vehicles across nations with a nation-suffixed slug', async () => {
    await syncCatalog(
      t.db,
      snapshot([
        vehicle({
          externalId: 'ussr_t_34_1941',
          name: 'T-34 (1941)',
          country: 'ussr',
        }),
        vehicle({
          externalId: 'sw_t_34_1941',
          name: 'T-34 (1941)',
          country: 'sweden',
        }),
      ]),
      relaxed,
    )

    // externalId order decides who keeps the base slug — deterministic across runs
    const slugs = (await t.db.select().from(vehicles)).map((v) => v.slug).sort()
    expect(slugs).toEqual(['t-34-1941', 't-34-1941-ussr'])
  })

  it('skips branches no mode plays (naval today) without warning noise', async () => {
    const summary = await syncCatalog(
      t.db,
      snapshot([
        vehicle(),
        vehicle({
          externalId: 'us_destroyer_somers',
          name: 'USS Somers',
          vehicleType: 'destroyer',
        }),
      ]),
      relaxed,
    )

    expect(summary).toMatchObject({
      inserted: 1,
      skippedNoMode: 1,
      warnings: [],
    })
    expect(await t.db.select().from(vehicles)).toHaveLength(1)
  })

  it('warns and skips unknown vehicle types and countries instead of guessing', async () => {
    const summary = await syncCatalog(
      t.db,
      snapshot([
        vehicle(),
        vehicle({ externalId: 'x_exo', vehicleType: 'exoskeleton' }),
        vehicle({ externalId: 'x_atlantis', country: 'atlantis' }),
      ]),
      relaxed,
    )

    expect(summary.inserted).toBe(1)
    expect(summary.warnings).toHaveLength(2)
    expect(summary.warnings.join('\n')).toMatch(/exoskeleton/)
    expect(summary.warnings.join('\n')).toMatch(/atlantis/)
  })

  it('refuses a snapshot below the safety floor, leaving the catalog untouched', async () => {
    await syncCatalog(t.db, snapshot([vehicle()]), relaxed)

    await expect(
      syncCatalog(t.db, snapshot([]), { minVehicles: 1000 }),
    ).rejects.toThrow(/safety floor/)

    const [row] = await t.db.select().from(vehicles)
    expect(row.isRemoved).toBe(false)
  })

  it('dry run reports the summary but writes nothing', async () => {
    const summary = await syncCatalog(t.db, snapshot([vehicle()]), {
      ...relaxed,
      dryRun: true,
    })

    expect(summary).toMatchObject({ inserted: 1, patch: '2.57' })
    expect(await t.db.select().from(vehicles)).toHaveLength(0)
    expect(await t.db.select().from(patches)).toHaveLength(0)
  })

  it('preserves manually curated patch metadata and nation backgrounds', async () => {
    await t.db.insert(patches).values({
      version: '2.57',
      name: 'Hornets Nest',
      releasedAt: new Date('2026-06-10T00:00:00Z'),
    })
    await syncCatalog(t.db, snapshot([vehicle()]), relaxed)
    const [patchRow] = await t.db.select().from(patches)
    expect(patchRow.name).toBe('Hornets Nest')
    expect(patchRow.releasedAt).not.toBeNull()

    await t.db
      .update(nations)
      .set({ backgroundUrl: 'https://cdn.test/usa.jpg' })
      .where(eq(nations.slug, 'usa'))
    await syncCatalog(t.db, snapshot([vehicle({ era: 5 })]), relaxed)
    const usa = await t.db.select().from(nations).where(eq(nations.slug, 'usa'))
    expect(usa[0].backgroundUrl).toBe('https://cdn.test/usa.jpg')
  })

  it('keeps the first occurrence when the snapshot has duplicate externalIds', async () => {
    const summary = await syncCatalog(
      t.db,
      snapshot([vehicle({ era: 6 }), vehicle({ era: 7 })]),
      relaxed,
    )

    expect(summary.inserted).toBe(1)
    expect(summary.warnings.join('\n')).toMatch(/duplicate externalIds/)
    const [row] = await t.db.select().from(vehicles)
    expect(row.rank).toBe(6)
  })

  it('aborts when a run would flag more removals than the cap', async () => {
    await syncCatalog(
      t.db,
      snapshot([
        vehicle(),
        vehicle({ externalId: 'us_m26' }),
        vehicle({ externalId: 'us_m18' }),
      ]),
      relaxed,
    )

    await expect(
      syncCatalog(t.db, snapshot([vehicle()]), { ...relaxed, maxRemoved: 1 }),
    ).rejects.toThrow(/vehicles removed/)

    // the abort rolled the whole run back
    const rows = await t.db.select().from(vehicles)
    expect(rows.filter((v) => v.isRemoved)).toHaveLength(0)
  })

  it('warns when a vehicle with records changes branch', async () => {
    await syncCatalog(t.db, snapshot([vehicle()]), relaxed)
    const [row] = await t.db.select().from(vehicles)
    const [player] = await t.db
      .insert(players)
      .values({ slug: 'ace', displayName: 'Ace' })
      .returning()
    await t.db.insert(records).values({
      vehicleId: row.id,
      mode: 'grb',
      playerId: player.id,
      ignSnapshot: 'Ace',
      kills: 12,
      patch: '2.57',
      status: 'verified',
      isCurrent: true,
    })

    const summary = await syncCatalog(
      t.db,
      snapshot([vehicle({ vehicleType: 'fighter' })]),
      relaxed,
    )

    expect(summary.warnings.join('\n')).toMatch(
      /branch changed ground → air for us_m1_abrams which holds 1 record/,
    )
  })

  it('skips a vehicle when neither name nor externalId slugifies, with a warning', async () => {
    const summary = await syncCatalog(
      t.db,
      snapshot([vehicle(), vehicle({ externalId: '→→', name: '···' })]),
      relaxed,
    )

    expect(summary.inserted).toBe(1)
    expect(summary.warnings.join('\n')).toMatch(/nothing slugifiable/)
  })

  it('skips out-of-range BRs (numeric overflow, NaN) as warnings, not aborts', async () => {
    const summary = await syncCatalog(
      t.db,
      snapshot([
        vehicle({ realisticBr: 1417 }),
        vehicle({ externalId: 'us_m26', arcadeBr: Number.NaN }),
      ]),
      relaxed,
    )

    expect(summary.inserted).toBe(2)
    const warned = summary.warnings.join('\n')
    expect(warned).toMatch(/invalid realisticBr 1417/)
    expect(warned).toMatch(/invalid arcadeBr/)
    const brRows = await t.db.select().from(vehicleBr)
    expect(brRows).toHaveLength(2) // gab for the first, grb for the second
  })

  it('updates BR in place and clears stale BR rows when a vehicle changes branch', async () => {
    await syncCatalog(t.db, snapshot([vehicle({ realisticBr: 10.3 })]), relaxed)
    await syncCatalog(t.db, snapshot([vehicle({ realisticBr: 10.7 })]), relaxed)

    const [row] = await t.db.select().from(vehicles)
    const grbRow = await t.db
      .select()
      .from(vehicleBr)
      .where(and(eq(vehicleBr.vehicleId, row.id), eq(vehicleBr.mode, 'grb')))
    expect(grbRow[0].br).toBe(10.7)

    // upstream reclassifies the unit to an air type → ground BR rows must go
    await syncCatalog(
      t.db,
      snapshot([vehicle({ vehicleType: 'fighter' })]),
      relaxed,
    )
    const brModes = (
      await t.db.select().from(vehicleBr).where(eq(vehicleBr.vehicleId, row.id))
    )
      .map((r) => r.mode)
      .sort()
    expect(brModes).toEqual(['aab', 'arb'])
  })
})
