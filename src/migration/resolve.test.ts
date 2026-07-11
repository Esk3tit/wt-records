import { describe, expect, it } from 'vitest'
import { nameSearchTerms } from '#/lib/search-terms'
import type { MigrationSnapshot } from '#/migration/extract'
import type { ResolvedImgurPost } from '#/migration/imgur'
import type { CatalogVehicle } from '#/migration/match'
import type { RawRow } from '#/migration/sheets'
import type { MigrationOverrides } from '#/migration/resolve'
import { resolve } from '#/migration/resolve'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'

function vehicle(
  externalId: string,
  name: string,
  nation: string,
  cls: CatalogVehicle['class'] = 'medium',
): CatalogVehicle {
  return {
    externalId,
    name,
    nation,
    class: cls,
    isRemoved: false,
    terms: nameSearchTerms(name),
  }
}

const VEHICLES = [
  vehicle('us_m1a2_sep_v3', 'M1A2 SEPv3', 'usa'),
  vehicle('uk_sherman_2', 'Sherman II', 'britain'),
  vehicle('uk_fv4005', 'FV4005', 'britain', 'spg'),
]

const PATCHES: Array<PatchBackfillEntry> = [
  { version: '2.53', name: null, releasedAt: '2026-01-15' },
  { version: '2.57', name: null, releasedAt: '2026-06-10' },
]

const RULES: MigrationRules = {
  minKills: { light: 12, medium: 12, heavy: 12, spg: 10, spaa: 6 },
  difficultMinKills: 6,
  difficultVehicles: [{ name: 'FV4005', nation: 'britain' }],
}

function row(partial: Partial<RawRow> & Pick<RawRow, 'rowNumber'>): RawRow {
  return {
    tab: 'USA',
    nation: 'usa',
    kills: 20,
    vehicleName: 'M1A2 SEPv3',
    playerName: '_LOPE_',
    br: 12.7,
    patch: '2.57',
    proofs: [{ column: 'screenshot', url: 'https://imgur.com/a/alive01' }],
    ...partial,
  }
}

const ALIVE: ResolvedImgurPost = {
  id: 'alive01',
  status: 'ok',
  createdAt: '2026-06-20T10:00:00Z',
  media: [
    {
      id: 'img1',
      url: 'https://i.imgur.com/img1.png',
      ext: 'png',
      createdAt: '2026-06-20T10:00:00Z',
    },
    {
      id: 'img2',
      url: 'https://i.imgur.com/img2.mp4',
      ext: 'mp4',
      createdAt: '2026-06-20T10:00:01Z',
    },
  ],
}

const DEAD: ResolvedImgurPost = {
  id: 'dead01',
  status: 'dead',
  httpStatus: 404,
  createdAt: null,
  media: [],
}

function snapshot(
  rows: Array<RawRow>,
  imgur: Record<string, ResolvedImgurPost> = { alive01: ALIVE, dead01: DEAD },
): MigrationSnapshot {
  return {
    mode: 'grb',
    spreadsheetId: 'sheet-id',
    extractedAt: '2026-07-11T00:00:00Z',
    rows,
    placeholderRows: 0,
    imgur,
    crossChecks: { leaderboardTotal: rows.length, dataSheetDistinctPlayers: 1 },
  }
}

function run(
  rows: Array<RawRow>,
  overrides: MigrationOverrides = {},
  imgur?: Record<string, ResolvedImgurPost>,
) {
  return resolve({
    snapshot: snapshot(rows, imgur),
    vehicles: VEHICLES,
    patches: PATCHES,
    rules: RULES,
    overrides,
    now: () => new Date('2026-07-11T01:00:00Z'),
  })
}

describe('resolve', () => {
  it('resolves a clean row end to end', () => {
    const { resolution, review } = run([row({ rowNumber: 2 })])
    expect(resolution.unresolvedRows).toBe(0)
    expect(resolution.unresolvedDifficult).toEqual([])
    const resolved = resolution.rows[0]
    expect(resolved).toMatchObject({
      rowKey: 'USA:2',
      vehicleExternalId: 'us_m1a2_sep_v3',
      vehicleMatch: 'exact',
      patch: '2.57',
      isCurrent: true,
      submittedAt: '2026-06-20T10:00:00Z',
      verifiedAt: '2026-06-20T10:00:00Z',
    })
    expect(resolved.proofs).toEqual([
      {
        kind: 'scoreboard',
        originalUrl: 'https://i.imgur.com/img1.png',
        mirror: { imgurId: 'alive01', mediaId: 'img1', ext: 'png' },
        sort: 0,
      },
      { kind: 'video', originalUrl: 'https://i.imgur.com/img2.mp4', sort: 1 },
    ])
    expect(resolution.difficultVehicles).toEqual([
      { name: 'FV4005', externalId: 'uk_fv4005' },
    ])
    expect(review).toContain('Everything is resolved')
  })

  it('degrades dead albums: sheet-import date, null verifiedAt, proof kept as original URL', () => {
    const { resolution, review } = run([
      row({
        rowNumber: 2,
        proofs: [{ column: 'screenshot', url: 'https://imgur.com/a/dead01' }],
      }),
    ])
    const resolved = resolution.rows[0]
    expect(resolved.problems).toEqual([])
    expect(resolved.submittedAt).toBe('2026-07-11T00:00:00Z')
    expect(resolved.verifiedAt).toBeNull()
    expect(resolved.proofs).toEqual([
      {
        kind: 'scoreboard',
        originalUrl: 'https://imgur.com/a/dead01',
        dead: true,
        sort: 0,
      },
    ])
    expect(review).toContain('Proof gaps')
    expect(review).toContain('all proof links dead')
  })

  it('keeps an alive-but-empty album as an original-URL proof and flags the gap', () => {
    const imgur = {
      empty01: {
        id: 'empty01',
        status: 'ok' as const,
        createdAt: '2026-06-25T00:00:00Z',
        media: [],
      },
    }
    const { resolution, review } = run(
      [
        row({
          rowNumber: 2,
          proofs: [
            { column: 'screenshot', url: 'https://imgur.com/a/empty01' },
          ],
        }),
      ],
      {},
      imgur,
    )
    const resolved = resolution.rows[0]
    expect(resolved.problems).toEqual([])
    expect(resolved.verifiedAt).toBe('2026-06-25T00:00:00Z')
    expect(resolved.proofs).toEqual([
      {
        kind: 'scoreboard',
        originalUrl: 'https://imgur.com/a/empty01',
        sort: 0,
      },
    ])
    expect(review).toContain('no usable image behind the proof links')
  })

  it('blocks unmatched vehicles and missing patches', () => {
    const { resolution, review } = run([
      row({ rowNumber: 2, vehicleName: 'Object 279', patch: '9.99' }),
    ])
    expect(resolution.unresolvedRows).toBe(1)
    expect(resolution.rows[0].problems).toEqual([
      'vehicle unmatched',
      'patch "9.99" is not in the patches backfill',
    ])
    expect(review).toContain('Unmatched vehicles')
    expect(review).toContain('`"usa:Object 279"`')
  })

  it('blocks date contradictions unless overridden', () => {
    const contradiction = row({
      rowNumber: 2,
      patch: '2.57',
      proofs: [{ column: 'screenshot', url: 'https://imgur.com/a/early1' }],
    })
    const imgur = {
      early1: { ...ALIVE, id: 'early1', createdAt: '2026-05-01T00:00:00Z' },
    }
    const blocked = run([contradiction], {}, imgur)
    expect(blocked.resolution.rows[0].problems).toEqual([
      expect.stringContaining('date contradiction'),
    ])
    expect(blocked.review).toContain('Date contradictions')

    const accepted = run(
      [contradiction],
      { rows: { 'USA:2': { acceptDateContradiction: true } } },
      imgur,
    )
    expect(accepted.resolution.rows[0].problems).toEqual([])
    expect(accepted.review).toContain('Accepted date contradictions')
  })

  it('re-resolves a row patch via row override', () => {
    const { resolution } = run([row({ rowNumber: 2, patch: '9.99' })], {
      rows: { 'USA:2': { patch: '2.57' } },
    })
    expect(resolution.rows[0].patch).toBe('2.57')
    expect(resolution.rows[0].problems).toEqual([])
  })

  it('adjudicates duplicates by kills, then upload date, then override', () => {
    const shermanRows = [
      row({
        rowNumber: 10,
        tab: 'Britain',
        nation: 'britain',
        vehicleName: 'Sherman II',
        kills: 14,
        patch: '2.53',
      }),
      row({
        rowNumber: 11,
        tab: 'Britain',
        nation: 'britain',
        vehicleName: 'Sherman II',
        kills: 16,
        patch: '2.53',
      }),
    ]
    const { resolution, review } = run(shermanRows)
    expect(resolution.unresolvedRows).toBe(0)
    expect(resolution.rows.map((r) => r.isCurrent)).toEqual([false, true])
    expect(review).toContain('Duplicate rows for one vehicle')

    const tied = run([{ ...shermanRows[0] }, { ...shermanRows[1], kills: 14 }])
    expect(tied.resolution.unresolvedRows).toBe(2)
    expect(tied.resolution.rows[0].problems[0]).toContain('duplicate tie')

    const overridden = run(
      [{ ...shermanRows[0] }, { ...shermanRows[1], kills: 14 }],
      { duplicates: { uk_sherman_2: 'Britain:10' } },
    )
    expect(overridden.resolution.unresolvedRows).toBe(0)
    expect(overridden.resolution.rows.map((r) => r.isCurrent)).toEqual([
      true,
      false,
    ])
  })

  it('plans player slugs with collision suffixes and non-latin fallbacks', () => {
    const { resolution, review } = run([
      row({ rowNumber: 2, playerName: '_LOPE_' }),
      row({ rowNumber: 3, playerName: 'LOPE', kills: 21 }),
      row({ rowNumber: 4, playerName: 'МОРИАРТИ', kills: 22 }),
    ])
    expect(resolution.players).toEqual([
      { name: '_LOPE_', slug: 'lope' },
      { name: 'LOPE', slug: 'lope-2' },
      { name: 'МОРИАРТИ', slug: 'player' },
    ])
    expect(review).toContain('Player slug notes')
    const overridden = run([row({ rowNumber: 4, playerName: 'МОРИАРТИ' })], {
      players: { МОРИАРТИ: { slug: 'moriarty' } },
    })
    expect(overridden.resolution.players).toEqual([
      { name: 'МОРИАРТИ', slug: 'moriarty' },
    ])
  })

  it('applies vehicle overrides and blocks bad ones', () => {
    const good = run([row({ rowNumber: 2, vehicleName: 'Mystery Tank' })], {
      vehicles: { 'usa:Mystery Tank': 'us_m1a2_sep_v3' },
    })
    expect(good.resolution.rows[0]).toMatchObject({
      vehicleExternalId: 'us_m1a2_sep_v3',
      vehicleMatch: 'override',
    })

    const bad = run([row({ rowNumber: 2, vehicleName: 'Mystery Tank' })], {
      vehicles: { 'usa:Mystery Tank': 'not_a_vehicle' },
    })
    expect(bad.resolution.rows[0].problems[0]).toContain('vehicle override')
  })

  it('blocks unresolved difficult-list vehicles', () => {
    const result = resolve({
      snapshot: snapshot([row({ rowNumber: 2 })]),
      vehicles: VEHICLES,
      patches: PATCHES,
      rules: {
        ...RULES,
        difficultVehicles: [{ name: 'Zachlam Tager', nation: 'israel' }],
      },
      overrides: {},
    })
    expect(result.resolution.unresolvedDifficult).toEqual([
      expect.stringContaining('Zachlam Tager: unmatched'),
    ])
    expect(result.review).toContain('Unresolved difficult-list vehicles')
  })
})
