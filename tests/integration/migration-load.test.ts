import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '#/db/schema'
import { seed } from '#/db/seed'
import { loadMigration } from '#/migration/load'
import type { LoadDeps } from '#/migration/load'
import type { MigrationResolution, ResolvedRow } from '#/migration/resolve'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'

const RULES: MigrationRules = {
  minKills: { light: 12, medium: 12, heavy: 12, spg: 10, spaa: 6 },
  difficultMinKills: 6,
  difficultVehicles: [{ name: 'FV4005', nation: 'britain' }],
}

const PATCHES: Array<PatchBackfillEntry> = [
  { version: '2.53', name: 'Line of Contact', releasedAt: '2025-12-16' },
  { version: '2.57', name: 'Heavy Cavalry', releasedAt: '2026-06-24' },
]

function resolvedRow(partial: Partial<ResolvedRow>): ResolvedRow {
  return {
    rowKey: 'USA:2',
    tab: 'USA',
    rowNumber: 2,
    nation: 'usa',
    vehicleName: 'M1A2 SEPv3',
    playerName: '_LOPE_',
    kills: 20,
    br: 12.7,
    vehicleExternalId: 'us_m1a2_sep_v3',
    vehicleMatch: 'exact',
    patch: '2.57',
    isCurrent: true,
    submittedAt: '2026-06-25T10:00:00Z',
    verifiedAt: '2026-06-25T10:00:00Z',
    proofs: [],
    problems: [],
    ...partial,
  }
}

function resolution(rows: Array<ResolvedRow>): MigrationResolution {
  const names = [...new Set(rows.map((r) => r.playerName))]
  return {
    mode: 'grb',
    snapshotExtractedAt: '2026-07-11T00:00:00Z',
    resolvedAt: '2026-07-11T01:00:00Z',
    players: names.map((name) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'player',
    })),
    difficultVehicles: [{ name: 'FV4005', externalId: 'uk_fv4005' }],
    unresolvedDifficult: [],
    rows,
    unresolvedRows: rows.filter((r) => r.problems.length > 0).length,
  }
}

async function seedCatalog(db: TestDb['db']) {
  const [usa, britain] = await db
    .insert(schema.nations)
    .values([
      { slug: 'usa', name: 'USA', sort: 1 },
      { slug: 'britain', name: 'Great Britain', sort: 4 },
    ])
    .returning()
  await db.insert(schema.vehicles).values([
    {
      externalId: 'us_m1a2_sep_v3',
      name: 'M1A2 SEPv3',
      slug: 'm1a2-sepv3',
      nationId: usa.id,
      branch: 'ground',
      class: 'medium',
    },
    {
      externalId: 'uk_sherman_2',
      name: 'Sherman II',
      slug: 'sherman-ii',
      nationId: britain.id,
      branch: 'ground',
      class: 'medium',
    },
    {
      externalId: 'uk_fv4005',
      name: 'FV4005',
      slug: 'fv4005',
      nationId: britain.id,
      branch: 'ground',
      class: 'spg',
    },
  ])
}

interface FakeStore {
  puts: Array<{ role: string; key: string; contentType: string }>
  put: NonNullable<LoadDeps['store']>['put']
}

function fakeStore(): FakeStore {
  const puts: FakeStore['puts'] = []
  return {
    puts,
    put: async (role, key, _body, contentType) => {
      puts.push({ role, key, contentType })
    },
  }
}

const imageFetch = (async (url: string) =>
  new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: {
      'content-type': url.endsWith('.png') ? 'image/png' : 'image/jpeg',
    },
  })) as typeof fetch

describe('loadMigration', () => {
  let t: TestDb
  let dir: string

  beforeEach(async () => {
    t = await freshDb()
    dir = mkdtempSync(join(tmpdir(), 'load-'))
    await seedCatalog(t.db)
  })
  afterEach(async () => {
    rmSync(dir, { recursive: true, force: true })
    await t.client.close()
  })

  function deps(store: LoadDeps['store'] = null): LoadDeps {
    return {
      store,
      fetchImpl: imageFetch,
      manifestPath: join(dir, 'manifest.json'),
      throttleMs: 0,
      sleepImpl: () => Promise.resolve(),
    }
  }

  const proofRows = () => [
    resolvedRow({
      proofs: [
        {
          kind: 'scoreboard',
          originalUrl: 'https://i.imgur.com/img1.png',
          mirror: { imgurId: 'alive01', mediaId: 'img1', ext: 'png' },
        },
        { kind: 'video', originalUrl: 'https://youtu.be/xyz' },
      ],
    }),
    resolvedRow({
      rowKey: 'Britain:10',
      tab: 'Britain',
      rowNumber: 10,
      nation: 'britain',
      vehicleName: 'Sherman II',
      vehicleExternalId: 'uk_sherman_2',
      playerName: 'Cavenub',
      kills: 16,
      br: 3.7,
      patch: '2.53',
      submittedAt: '2026-07-11T00:00:00Z',
      verifiedAt: null,
      proofs: [
        {
          kind: 'scoreboard',
          originalUrl: 'https://imgur.com/a/dead01',
          dead: true,
        },
      ],
    }),
  ]

  it('loads players, records, and proofs with rules-sync and patch backfill', async () => {
    const store = fakeStore()
    const summary = await loadMigration(
      t.db,
      resolution(proofRows()),
      RULES,
      PATCHES,
      deps(store),
    )

    expect(summary).toMatchObject({
      players: 2,
      records: 2,
      proofs: 3,
      mirrored: 1,
      mirrorReused: 0,
      patchesUpserted: 2,
      difficultFlagged: 1,
      wipedRecords: 0,
      wipedPlayers: 0,
    })
    expect(store.puts).toEqual([
      {
        role: 'proofs',
        key: 'migration/grb/img1.png',
        contentType: 'image/png',
      },
    ])

    const players = await t.db.select().from(schema.players)
    expect(players.map((p) => [p.slug, p.displayName, p.userId])).toEqual([
      ['lope', '_LOPE_', null],
      ['cavenub', 'Cavenub', null],
    ])
    const aliases = await t.db.select().from(schema.playerAliases)
    expect(aliases.map((a) => [a.name, a.kind, a.source])).toEqual([
      ['_LOPE_', 'ign', 'migration'],
      ['Cavenub', 'ign', 'migration'],
    ])

    const records = await t.db.select().from(schema.records)
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      mode: 'grb',
      ignSnapshot: '_LOPE_',
      displayNameSnapshot: '_LOPE_',
      kills: 20,
      runBr: 12.7,
      patch: '2.57',
      status: 'verified',
      isCurrent: true,
      importedFrom: 'sheet',
      submittedById: null,
      verifiedAt: new Date('2026-06-25T10:00:00Z'),
    })
    expect(records[1].verifiedAt).toBeNull()

    const proofs = await t.db.select().from(schema.recordProof)
    expect(proofs.map((p) => [p.kind, p.storagePath, p.originalUrl])).toEqual([
      ['scoreboard', 'migration/grb/img1.png', 'https://i.imgur.com/img1.png'],
      ['video', null, 'https://youtu.be/xyz'],
      ['scoreboard', null, 'https://imgur.com/a/dead01'],
    ])

    const modes = await t.db.select().from(schema.modes)
    expect(modes).toHaveLength(4)
    expect(modes.find((m) => m.mode === 'grb')).toMatchObject({
      isLive: true,
      difficultMinKills: 6,
    })
    const minKills = await t.db.select().from(schema.modeMinKills)
    expect(minKills.find((k) => k.class === 'light')?.minKills).toBe(12)
    expect(minKills.find((k) => k.class === 'spg')?.minKills).toBe(10)

    const patches = await t.db.select().from(schema.patches)
    expect(patches.find((p) => p.version === '2.53')).toMatchObject({
      name: 'Line of Contact',
      releasedAt: new Date('2025-12-16'),
    })

    const fv4005 = await t.db.query.vehicles.findFirst({
      where: (v, { eq }) => eq(v.externalId, 'uk_fv4005'),
    })
    expect(fv4005?.isDifficult).toBe(true)

    const manifest = JSON.parse(
      readFileSync(join(dir, 'manifest.json'), 'utf8'),
    )
    expect(manifest.uploaded).toEqual({ img1: 'migration/grb/img1.png' })
  })

  it('replaces the seeded demo fixture wholesale', async () => {
    await t.db.execute(
      sql`truncate table modes, nations, players, patches restart identity cascade`,
    )
    await seed(t.db)
    // seed() already owns usa/germany; add the catalog rows the load expects
    const usa = await t.db.query.nations.findFirst({
      where: (n, { eq }) => eq(n.slug, 'usa'),
    })
    const [britain] = await t.db
      .insert(schema.nations)
      .values({ slug: 'britain', name: 'Great Britain', sort: 4 })
      .returning()
    await t.db.insert(schema.vehicles).values([
      {
        externalId: 'us_m1a2_sep_v3',
        name: 'M1A2 SEPv3',
        slug: 'm1a2-sepv3',
        nationId: usa!.id,
        branch: 'ground',
        class: 'medium',
      },
      {
        externalId: 'uk_fv4005',
        name: 'FV4005',
        slug: 'fv4005',
        nationId: britain.id,
        branch: 'ground',
        class: 'spg',
      },
    ])

    const summary = await loadMigration(
      t.db,
      resolution([resolvedRow({})]),
      RULES,
      PATCHES,
      deps(),
    )
    expect(summary.wipedPlayers).toBeGreaterThan(0)
    expect(summary.wipedRecords).toBeGreaterThan(0)

    const players = await t.db.select().from(schema.players)
    expect(players.map((p) => p.slug)).toEqual(['lope'])
    const modes = await t.db.select().from(schema.modes)
    expect(modes.find((m) => m.mode === 'grb')?.difficultMinKills).toBe(6)
  })

  it('reuses previously mirrored images via the manifest', async () => {
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({ uploaded: { img1: 'migration/grb/img1.png' } }),
    )
    const store = fakeStore()
    const summary = await loadMigration(
      t.db,
      resolution(proofRows()),
      RULES,
      PATCHES,
      deps(store),
    )
    expect(summary.mirrorReused).toBe(1)
    expect(summary.mirrored).toBe(0)
    expect(store.puts).toEqual([])
    const proofs = await t.db.select().from(schema.recordProof)
    expect(proofs[0].storagePath).toBe('migration/grb/img1.png')
  })

  it('aborts before touching the DB when mirroring fails', async () => {
    const store = fakeStore()
    const failingFetch = (async () =>
      new Response('', { status: 404 })) as typeof fetch
    await expect(
      loadMigration(t.db, resolution(proofRows()), RULES, PATCHES, {
        ...deps(store),
        fetchImpl: failingFetch,
      }),
    ).rejects.toThrow('Mirroring failed for 1 image(s)')
    expect(await t.db.select().from(schema.players)).toEqual([])
    expect(await t.db.select().from(schema.modes)).toEqual([])
  })

  it('dry run applies everything, then rolls back', async () => {
    const store = fakeStore()
    const summary = await loadMigration(
      t.db,
      resolution(proofRows()),
      RULES,
      PATCHES,
      deps(store),
      { dryRun: true },
    )
    expect(summary.records).toBe(2)
    expect(summary.mirrorSkipped).toBe(1)
    expect(store.puts).toEqual([])
    expect(await t.db.select().from(schema.players)).toEqual([])
    expect(await t.db.select().from(schema.records)).toEqual([])
    expect(await t.db.select().from(schema.modes)).toEqual([])
  })

  it('refuses an unresolved resolution', async () => {
    const blocked = resolution([
      resolvedRow({ vehicleExternalId: null, problems: ['vehicle unmatched'] }),
    ])
    await expect(
      loadMigration(t.db, blocked, RULES, PATCHES, deps()),
    ).rejects.toThrow('Refusing to load: 1 unresolved row(s)')
  })

  it('refuses when unresolved difficult vehicles remain', async () => {
    const blocked = {
      ...resolution([resolvedRow({})]),
      unresolvedDifficult: ['Zachlam Tager: unmatched'],
    }
    await expect(
      loadMigration(t.db, blocked, RULES, PATCHES, deps()),
    ).rejects.toThrow('1 unresolved difficult vehicle(s)')
  })

  it('refuses once user-submitted records exist', async () => {
    await t.db.execute(
      sql`insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001')`,
    )
    await t.db.insert(schema.patches).values({ version: '2.57' })
    const [player] = await t.db
      .insert(schema.players)
      .values({ slug: 'real-user', displayName: 'Real User' })
      .returning()
    const vehicle = await t.db.query.vehicles.findFirst()
    await t.db.insert(schema.modes).values({
      mode: 'grb',
      name: 'Ground Realistic Battles',
      branch: 'ground',
    })
    await t.db.insert(schema.records).values({
      vehicleId: vehicle!.id,
      mode: 'grb',
      playerId: player.id,
      ignSnapshot: 'Real User',
      kills: 15,
      patch: '2.57',
      status: 'pending',
      submittedById: '00000000-0000-0000-0000-000000000001',
    })

    await expect(
      loadMigration(
        t.db,
        resolution([resolvedRow({})]),
        RULES,
        PATCHES,
        deps(),
      ),
    ).rejects.toThrow('user-submitted records exist')
  })

  it('refuses when the catalog lacks a resolved vehicle', async () => {
    const res = resolution([
      resolvedRow({ vehicleExternalId: 'us_never_synced' }),
    ])
    await expect(
      loadMigration(t.db, res, RULES, PATCHES, deps()),
    ).rejects.toThrow('Vehicles missing from this database')
  })
})
