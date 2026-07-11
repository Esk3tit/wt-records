/* Glue test: the three stages compose — a fake sheet + fake imgur through
   extract → resolve (against a PGlite catalog) → load, end to end. */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '#/db/schema'
import { nameSearchTerms } from '#/lib/search-terms'
import type { MigrationModeConfig } from '#/migration/config'
import { extract } from '#/migration/extract'
import { ImgurResolver } from '#/migration/imgur'
import { loadCatalogVehicles } from '#/migration/catalog'
import { resolve } from '#/migration/resolve'
import { loadMigration } from '#/migration/load'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'

const CONFIG: MigrationModeConfig = {
  mode: 'grb',
  spreadsheetId: 'sheet-id',
  nationTabs: { USA: 'usa' },
  leaderboardTab: 'Leaderboard',
  dataSheetTab: 'DataSheet',
}

const RULES: MigrationRules = {
  minKills: { light: 12, medium: 12, heavy: 12, spg: 10, spaa: 6 },
  difficultMinKills: 6,
  difficultVehicles: [],
}

const PATCHES: Array<PatchBackfillEntry> = [
  { version: '2.57', name: 'Heavy Cavalry', releasedAt: '2026-06-24' },
]

type Cell = { formattedValue?: string; hyperlink?: string }
const grid = (rows: Array<Array<Cell>>) => ({
  sheets: [{ data: [{ rowData: rows.map((values) => ({ values })) }] }],
})

const SHEET_TABS: Record<string, unknown> = {
  USA: grid([
    [
      { formattedValue: 'Kills' },
      { formattedValue: 'Tank' },
      { formattedValue: 'Player' },
      { formattedValue: 'BR' },
      { formattedValue: 'Patch Version' },
      { formattedValue: 'Screenshot' },
      { formattedValue: 'Screenshot 2' },
      { formattedValue: 'Video' },
    ],
    [
      { formattedValue: '20' },
      { formattedValue: 'M1A2 SEPv3' },
      { formattedValue: '_LOPE_' },
      { formattedValue: '12.7' },
      { formattedValue: '2.57' },
      { formattedValue: '1', hyperlink: 'https://imgur.com/a/alive01' },
    ],
  ]),
  Leaderboard: grid([
    [{ formattedValue: 'Number of Records:' }, { formattedValue: '1' }],
  ]),
  DataSheet: grid([[], [], [], [], [{ formattedValue: '_LOPE_' }]]),
}

const fetchImpl = (async (url: string) => {
  if (url.startsWith('https://sheets.googleapis.com/')) {
    const tab = /ranges='([^']+)'/.exec(decodeURIComponent(url))?.[1]
    return new Response(JSON.stringify(SHEET_TABS[tab!]), { status: 200 })
  }
  if (url.includes('/post/v1/albums/alive01')) {
    return new Response(
      JSON.stringify({
        id: 'alive01',
        created_at: '2026-06-25T10:00:00Z',
        media: [
          {
            id: 'img1',
            url: 'https://i.imgur.com/img1.png',
            ext: 'png',
            created_at: '2026-06-25T10:00:00Z',
          },
        ],
      }),
      { status: 200 },
    )
  }
  if (url === 'https://i.imgur.com/img1.png') {
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
  }
  return new Response('', { status: 404 })
}) as typeof fetch

describe('migration pipeline', () => {
  let t: TestDb
  let dir: string

  beforeEach(async () => {
    t = await freshDb()
    dir = mkdtempSync(join(tmpdir(), 'pipeline-'))
    const [usa] = await t.db
      .insert(schema.nations)
      .values({ slug: 'usa', name: 'USA', sort: 1 })
      .returning()
    const [vehicle] = await t.db
      .insert(schema.vehicles)
      .values({
        externalId: 'us_m1a2_sep_v3',
        name: 'M1A2 SEPv3',
        slug: 'm1a2-sepv3',
        nationId: usa.id,
        branch: 'ground',
        class: 'medium',
      })
      .returning()
    await t.db.insert(schema.vehicleSearchTerms).values(
      nameSearchTerms('M1A2 SEPv3').map((term) => ({
        vehicleId: vehicle.id,
        term,
      })),
    )
  })
  afterEach(async () => {
    rmSync(dir, { recursive: true, force: true })
    await t.client.close()
  })

  it('flows a row from the sheet into records with a mirrored proof', async () => {
    const resolver = new ImgurResolver({
      cacheDir: join(dir, 'imgur'),
      fetchImpl,
      throttleMs: 0,
    })
    const extracted = await extract(CONFIG, {
      sheets: { apiKey: 'k', fetchImpl },
      resolver,
    })
    expect(extracted.problems).toEqual([])

    const vehicles = await loadCatalogVehicles(t.db, 'ground')
    expect(vehicles).toEqual([
      expect.objectContaining({
        externalId: 'us_m1a2_sep_v3',
        nation: 'usa',
        terms: expect.arrayContaining(['m1a2sepv3']),
      }),
    ])

    const { resolution } = resolve({
      snapshot: extracted.snapshot,
      vehicles,
      patches: PATCHES,
      rules: RULES,
      overrides: {},
    })
    expect(resolution.unresolvedRows).toBe(0)

    const puts: Array<string> = []
    const summary = await loadMigration(t.db, resolution, RULES, PATCHES, {
      store: {
        put: async (_role, key) => {
          puts.push(key)
        },
      },
      fetchImpl,
      manifestPath: join(dir, 'manifest.json'),
      throttleMs: 0,
      sleepImpl: () => Promise.resolve(),
    })

    expect(summary).toMatchObject({
      players: 1,
      records: 1,
      proofs: 1,
      mirrored: 1,
    })
    expect(puts).toEqual(['migration/grb/img1.png'])

    const records = await t.db.select().from(schema.records)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      kills: 20,
      patch: '2.57',
      status: 'verified',
      isCurrent: true,
      importedFrom: 'sheet',
      verifiedAt: new Date('2026-06-25T10:00:00Z'),
    })
    const proofs = await t.db.select().from(schema.recordProof)
    expect(proofs[0]).toMatchObject({
      kind: 'scoreboard',
      storagePath: 'migration/grb/img1.png',
      originalUrl: 'https://i.imgur.com/img1.png',
    })
  })
})
