import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MigrationModeConfig } from '#/migration/config'
import { ImgurResolver } from '#/migration/imgur'
import { extract } from '#/migration/extract'

const CONFIG: MigrationModeConfig = {
  mode: 'grb',
  spreadsheetId: 'sheet-id',
  nationTabs: { USA: 'usa', Germany: 'germany' },
  leaderboardTab: 'Leaderboard',
  dataSheetTab: 'DataSheet',
}

type Cell = { formattedValue?: string; hyperlink?: string }

function gridResponse(rows: Array<Array<Cell>>) {
  return {
    sheets: [{ data: [{ rowData: rows.map((values) => ({ values })) }] }],
  }
}

const HEADER: Array<Cell> = [
  { formattedValue: 'Kills' },
  { formattedValue: 'Tank' },
  { formattedValue: 'Player' },
  { formattedValue: 'BR' },
  { formattedValue: 'Patch Version' },
  { formattedValue: 'Screenshot' },
  { formattedValue: 'Screenshot 2' },
  { formattedValue: 'Video' },
]

const TABS: Record<string, ReturnType<typeof gridResponse>> = {
  USA: gridResponse([
    HEADER,
    [
      { formattedValue: '20' },
      { formattedValue: 'M1A2 SEPv3' },
      { formattedValue: '_LOPE_' },
      { formattedValue: '12.7' },
      { formattedValue: '2.57' },
      { formattedValue: '1', hyperlink: 'https://imgur.com/a/alive01' },
    ],
    [
      { formattedValue: '16' },
      { formattedValue: 'HSTV-L' },
      { formattedValue: '_AxiE' },
      { formattedValue: '12.0' },
      { formattedValue: '2.53' },
      { formattedValue: '1', hyperlink: 'https://imgur.com/a/dead001' },
      {},
      { formattedValue: 'Video', hyperlink: 'https://youtu.be/xyz' },
    ],
  ]),
  Germany: gridResponse([
    HEADER,
    [
      { formattedValue: '14' },
      { formattedValue: 'Leopard 2A7V' },
      { formattedValue: '_LOPE_' },
      { formattedValue: '12.0' },
      { formattedValue: '2.55' },
      { formattedValue: '1', hyperlink: 'https://imgur.com/a/alive01' },
    ],
  ]),
  Leaderboard: gridResponse([
    [
      { formattedValue: 'Player Name' },
      { formattedValue: 'Number of Records:' },
      { formattedValue: '3' },
    ],
  ]),
  DataSheet: gridResponse([
    [{ formattedValue: '' }, { formattedValue: 'Countries' }],
    [{ formattedValue: '' }, { formattedValue: 'Total' }],
    [{ formattedValue: '' }, { formattedValue: 'Out Of' }],
    [{ formattedValue: '' }, { formattedValue: 'Avg Kills' }],
    [{ formattedValue: '_LOPE_' }],
    [{ formattedValue: '_AxiE' }],
  ]),
}

function fakeFetch(url: string): Response {
  if (url.startsWith('https://sheets.googleapis.com/')) {
    const tab = /ranges='([^']+)'/.exec(decodeURIComponent(url))?.[1]
    const body = tab ? TABS[tab] : undefined
    if (!body) return new Response('', { status: 400 })
    return new Response(JSON.stringify(body), { status: 200 })
  }
  if (url.includes('/post/v1/albums/alive01')) {
    return new Response(
      JSON.stringify({
        id: 'alive01',
        created_at: '2025-06-01T00:00:00Z',
        media: [
          {
            id: 'imgA',
            url: 'https://i.imgur.com/imgA.png',
            ext: 'png',
            created_at: '2025-06-01T00:00:00Z',
          },
        ],
      }),
      { status: 200 },
    )
  }
  return new Response('', { status: 404 })
}

describe('extract', () => {
  let dir: string
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('builds a snapshot with resolved imgur posts, cross-checks, and findings', async () => {
    dir = mkdtempSync(join(tmpdir(), 'extract-'))
    const fetchImpl = (async (url: string) => fakeFetch(url)) as typeof fetch
    const resolver = new ImgurResolver({
      cacheDir: dir,
      fetchImpl,
      throttleMs: 0,
      sleepImpl: () => Promise.resolve(),
    })

    const result = await extract(CONFIG, {
      sheets: { apiKey: 'k', fetchImpl },
      resolver,
      now: () => new Date('2026-07-11T00:00:00Z'),
    })

    expect(result.problems).toEqual([])
    expect(result.snapshot.rows).toHaveLength(3)
    expect(result.snapshot.crossChecks).toEqual({
      leaderboardTotal: 3,
      dataSheetDistinctPlayers: 2,
    })
    expect(result.snapshot.imgur.alive01).toMatchObject({
      status: 'ok',
      createdAt: '2025-06-01T00:00:00Z',
    })
    expect(result.snapshot.imgur.dead001).toMatchObject({ status: 'dead' })
    expect(result.findings).toContain('Rows: **3** (Leaderboard declares 3)')
    expect(result.findings).toContain('- 2.53: 1')
    expect(result.findings).toContain('Dead imgur posts')
    expect(result.findings).toContain('None — extraction was clean.')
  })

  it('reports cross-check mismatches as problems', async () => {
    dir = mkdtempSync(join(tmpdir(), 'extract-'))
    const tabs = {
      ...TABS,
      Leaderboard: gridResponse([
        [{ formattedValue: 'Number of Records:' }, { formattedValue: '99' }],
      ]),
    }
    const fetchImpl = (async (url: string) => {
      if (url.startsWith('https://sheets.googleapis.com/')) {
        const tab = /ranges='([^']+)'/.exec(decodeURIComponent(url))?.[1]
        return new Response(JSON.stringify(tabs[tab as keyof typeof tabs]), {
          status: 200,
        })
      }
      return fakeFetch(url)
    }) as typeof fetch
    const resolver = new ImgurResolver({
      cacheDir: dir,
      fetchImpl,
      throttleMs: 0,
      sleepImpl: () => Promise.resolve(),
    })

    const result = await extract(CONFIG, {
      sheets: { apiKey: 'k', fetchImpl },
      resolver,
    })
    expect(result.problems).toEqual([
      expect.stringContaining(
        'extracted 3 rows but the Leaderboard declares 99',
      ),
    ])
    expect(result.findings).toContain(
      'extracted 3 rows but the Leaderboard declares 99',
    )
  })
})
