import { describe, expect, it } from 'vitest'
import { WtVehiclesApiSource } from '#/catalog/wt-vehicles-api'

interface ApiVehicle {
  identifier: string
  country: string
  vehicle_type: string
  era: number
  arcade_br: number
  realistic_br: number
  simulator_br: number
  event: string | null
  is_premium: 0 | 1 | boolean
  squadron_vehicle: 0 | 1 | boolean
  images: { image: string | null }
}

function apiVehicle(overrides: Partial<ApiVehicle> = {}): ApiVehicle {
  return {
    identifier: 'us_m1_abrams',
    country: 'usa',
    vehicle_type: 'medium_tank',
    era: 6,
    arcade_br: 10.3,
    realistic_br: 10.3,
    simulator_br: 10.3,
    event: null,
    is_premium: 0,
    squadron_vehicle: 0,
    images: { image: 'https://api.test/assets/images/us_m1_abrams.png' },
    ...overrides,
  }
}

const UNITS_CSV = [
  '"<ID|readonly|noverify>";"<English>";"<French>"',
  '"us_m1_abrams_shop";"M1 Abrams";"M1 Abrams"',
  '"us_m1_abrams_0";"Tank, Combat, Full Tracked";"..."',
  '"germ_flakpanzer_IV_Wirbelwind_shop";"Wirbelwind";"Wirbelwind"',
].join('\n')

interface StubRoute {
  pattern: RegExp
  reply: (url: string) => { status?: number; body: string }
}

function stubFetch(routes: Array<StubRoute>): {
  fetchImpl: typeof fetch
  requests: Array<string>
} {
  const requests: Array<string> = []
  const fetchImpl = (async (input: URL | RequestInfo) => {
    const url = String(input)
    requests.push(url)
    const route = routes.find((r) => r.pattern.test(url))
    if (!route) return new Response('{"error":"Route not found"}', { status: 404 })
    const { status = 200, body } = route.reply(url)
    return new Response(body, { status })
  }) as typeof fetch
  return { fetchImpl, requests }
}

function source(routes: Array<StubRoute>) {
  const { fetchImpl, requests } = stubFetch(routes)
  return {
    requests,
    source: new WtVehiclesApiSource({
      apiBaseUrl: 'https://api.test/api',
      unitsCsvUrl: 'https://locale.test/units.csv',
      fetchImpl,
      pageDelayMs: 0,
      retryDelayMs: 0,
    }),
  }
}

const statsRoute: StubRoute = {
  pattern: /\/vehicles\/stats/,
  reply: () => ({
    body: JSON.stringify({ versions: ['2.55.1.153', '2.57.0.8', '2.47.0.134'] }),
  }),
}
const csvRoute: StubRoute = {
  pattern: /units\.csv/,
  reply: () => ({ body: UNITS_CSV }),
}

describe('WtVehiclesApiSource', () => {
  it('assembles a snapshot: paginated vehicles, locale names, latest game version', async () => {
    const pageSize = 200
    const page0 = Array.from({ length: pageSize }, (_, i) =>
      apiVehicle({ identifier: `filler_${String(i).padStart(3, '0')}` }),
    )
    page0[0] = apiVehicle()
    const page1 = [
      apiVehicle({
        identifier: 'germ_flakpanzer_IV_Wirbelwind',
        country: 'germany',
        vehicle_type: 'spaa',
        era: 3,
        event: 'summer_2020',
        is_premium: 1,
      }),
    ]
    const csvWithFillers =
      UNITS_CSV +
      '\n' +
      page0
        .slice(1)
        .map((v) => `"${v.identifier}_shop";"Filler";"Filler"`)
        .join('\n')

    const { source: s, requests } = source([
      statsRoute,
      { pattern: /units\.csv/, reply: () => ({ body: csvWithFillers }) },
      {
        pattern: /\/vehicles\?/,
        reply: (url) => {
          const page = Number(new URL(url).searchParams.get('page'))
          return { body: JSON.stringify(page === 0 ? page0 : page === 1 ? page1 : []) }
        },
      },
    ])

    const snapshot = await s.fetchSnapshot()

    expect(snapshot.gameVersion).toBe('2.57.0.8')
    expect(snapshot.vehicles).toHaveLength(201)
    expect(snapshot.warnings ?? []).toEqual([])

    const abrams = snapshot.vehicles.find((v) => v.externalId === 'us_m1_abrams')!
    expect(abrams).toMatchObject({
      name: 'M1 Abrams',
      country: 'usa',
      vehicleType: 'medium_tank',
      era: 6,
      realisticBr: 10.3,
      isPremium: false,
      isSquadron: false,
      event: null,
      imageUrl: 'https://api.test/assets/images/us_m1_abrams.png',
    })
    const wirbel = snapshot.vehicles.find(
      (v) => v.externalId === 'germ_flakpanzer_IV_Wirbelwind',
    )!
    expect(wirbel.name).toBe('Wirbelwind')
    expect(wirbel.isPremium).toBe(true)
    expect(wirbel.event).toBe('summer_2020')

    // hidden/event vehicles must be included; killstreak units excluded upstream
    const listCalls = requests.filter((u) => u.includes('/vehicles?'))
    for (const u of listCalls) {
      expect(u).toContain('excludeEventVehicles=false')
      expect(u).toContain('excludeKillstreak=true')
    }
  })

  it('skips units without a shop name (scripted/killstreak) with one aggregate warning', async () => {
    const { source: s } = source([
      statsRoute,
      csvRoute,
      {
        pattern: /\/vehicles\?/,
        reply: () => ({
          body: JSON.stringify([
            apiVehicle(),
            apiVehicle({ identifier: 'atomic_pchela_usa' }),
            apiVehicle({ identifier: 'md_bosvark' }),
          ]),
        }),
      },
    ])

    const snapshot = await s.fetchSnapshot()

    expect(snapshot.vehicles.map((v) => v.externalId)).toEqual(['us_m1_abrams'])
    expect(snapshot.warnings).toHaveLength(1)
    expect(snapshot.warnings![0]).toMatch(/2 units without a shop-name/)
    expect(snapshot.warnings![0]).toMatch(/atomic_pchela_usa/)
  })

  it('retries transient upstream failures before giving up', async () => {
    let statsAttempts = 0
    const { source: s } = source([
      {
        pattern: /\/vehicles\/stats/,
        reply: () =>
          ++statsAttempts < 3
            ? { status: 503, body: 'brownout' }
            : { body: JSON.stringify({ versions: ['2.57.0.8'] }) },
      },
      csvRoute,
      {
        pattern: /\/vehicles\?/,
        reply: () => ({ body: JSON.stringify([apiVehicle()]) }),
      },
    ])

    const snapshot = await s.fetchSnapshot()
    expect(statsAttempts).toBe(3)
    expect(snapshot.gameVersion).toBe('2.57.0.8')
  })

  it('drops killstreak units locally even when the upstream filter misses them', async () => {
    const { source: s } = source([
      statsRoute,
      csvRoute,
      {
        pattern: /\/vehicles\?/,
        reply: () => ({
          body: JSON.stringify([
            apiVehicle(),
            apiVehicle({ identifier: 'b-29_killstreak' }),
          ]),
        }),
      },
    ])

    const snapshot = await s.fetchSnapshot()

    expect(snapshot.vehicles.map((v) => v.externalId)).toEqual(['us_m1_abrams'])
    expect(snapshot.warnings!.join('\n')).toMatch(/killstreak/)
  })

  it('accepts boolean flags from the API, not just 0/1', async () => {
    const { source: s } = source([
      statsRoute,
      csvRoute,
      {
        pattern: /\/vehicles\?/,
        reply: () => ({
          body: JSON.stringify([
            apiVehicle({ is_premium: true, squadron_vehicle: false }),
          ]),
        }),
      },
    ])

    const [v] = (await s.fetchSnapshot()).vehicles
    expect(v.isPremium).toBe(true)
    expect(v.isSquadron).toBe(false)
  })

  it('does not retry a non-transient 4xx', async () => {
    let attempts = 0
    const { source: s } = source([
      {
        pattern: /\/vehicles\/stats/,
        reply: () => {
          attempts++
          return { status: 404, body: 'nope' }
        },
      },
      csvRoute,
      {
        pattern: /\/vehicles\?/,
        reply: () => ({ body: JSON.stringify([apiVehicle()]) }),
      },
    ])

    await expect(s.fetchSnapshot()).rejects.toThrow(/404/)
    expect(attempts).toBe(1)
  })

  it('aborts a pagination loop the upstream refuses to terminate', async () => {
    const fullPage = JSON.stringify(
      Array.from({ length: 200 }, () => apiVehicle()),
    )
    const { source: s } = source([
      statsRoute,
      csvRoute,
      { pattern: /\/vehicles\?/, reply: () => ({ body: fullPage }) },
    ])

    await expect(s.fetchSnapshot()).rejects.toThrow(/did not terminate/)
  })

  it('throws once retries are exhausted', async () => {
    const { source: s } = source([
      { pattern: /\/vehicles\/stats/, reply: () => ({ status: 500, body: 'down' }) },
      csvRoute,
      {
        pattern: /\/vehicles\?/,
        reply: () => ({ body: JSON.stringify([apiVehicle()]) }),
      },
    ])

    await expect(s.fetchSnapshot()).rejects.toThrow(/500/)
  })
})
