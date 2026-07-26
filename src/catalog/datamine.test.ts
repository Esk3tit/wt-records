import { describe, expect, it } from 'vitest'
import type { SourceVehicle } from '#/catalog/source'
import { DatamineSource, battleRating } from '#/catalog/datamine'
import {
  DATAMINE_VERSION,
  UNITS_CSV,
  UNITTAGS,
  WPCOST,
} from '#/catalog/fixtures/datamine'

const BASE = 'https://datamine.test/repo'

interface Overrides {
  wpcost?: Record<string, unknown>
  unittags?: Record<string, unknown>
  unitsCsv?: string
  version?: string
  /** Replies keyed by the file each URL ends with; overrides the fixture. */
  replies?: Partial<
    Record<
      'wpcost' | 'unittags' | 'csv' | 'version',
      () => { status?: number; body: string }
    >
  >
}

function fileOf(url: string): 'wpcost' | 'unittags' | 'csv' | 'version' {
  if (url.includes('wpcost')) return 'wpcost'
  if (url.includes('unittags')) return 'unittags'
  if (url.includes('units.csv')) return 'csv'
  return 'version'
}

function source(overrides: Overrides = {}) {
  const bodies = {
    wpcost: () => JSON.stringify(overrides.wpcost ?? WPCOST),
    unittags: () => JSON.stringify(overrides.unittags ?? UNITTAGS),
    csv: () => overrides.unitsCsv ?? UNITS_CSV,
    version: () => overrides.version ?? DATAMINE_VERSION,
  }
  const requests: Array<string> = []
  const fetchImpl = (async (input: URL | RequestInfo) => {
    const url = String(input)
    requests.push(url)
    const file = fileOf(url)
    const override = overrides.replies?.[file]
    const { status = 200, body } = override
      ? override()
      : { body: bodies[file]() }
    return new Response(body, { status })
  }) as typeof fetch
  return {
    requests,
    source: new DatamineSource({ baseUrl: BASE, fetchImpl, retryDelayMs: 0 }),
  }
}

const snapshot = (o?: Overrides) => source(o).source.fetchSnapshot()
const byId = (vehicles: Array<SourceVehicle>, id: string) =>
  vehicles.find((v) => v.externalId === id)

describe('DatamineSource', () => {
  it('assembles a snapshot from the four datamine files', async () => {
    const { source: s, requests } = source()

    const snap = await s.fetchSnapshot()

    expect(snap.gameVersion).toBe('2.57.1.49')
    expect(requests).toHaveLength(4)
    expect(requests).toEqual(
      expect.arrayContaining([
        `${BASE}/char.vromfs.bin_u/config/wpcost.blkx`,
        `${BASE}/char.vromfs.bin_u/config/unittags.blkx`,
        `${BASE}/lang.vromfs.bin_u/lang/units.csv`,
        `${BASE}/version`,
      ]),
    )

    expect(byId(snap.vehicles, 'us_m1_abrams')).toEqual({
      externalId: 'us_m1_abrams',
      name: 'M1 Abrams',
      country: 'usa',
      vehicleType: 'medium_tank',
      era: 7,
      arcadeBr: 10.7,
      realisticBr: 10.7,
      simulatorBr: 10.7,
      isPremium: false,
      isSquadron: false,
      event: null,
      imageUrl: `${BASE}/tex.vromfs.bin_u/tanks/us_m1_abrams.png`,
    })
  })

  it('excludes the economicRankMax scalar, which is not a unit', async () => {
    const snap = await snapshot()
    expect(byId(snap.vehicles, 'economicRankMax')).toBeUndefined()
  })

  it('reads BRs off the thirds table, per realism', async () => {
    const snap = await snapshot()

    // economicRank 0 / 1 / 2 — the bottom of the table
    expect(byId(snap.vehicles, 'b5n2')).toMatchObject({
      arcadeBr: 1,
      realisticBr: 1.3,
      simulatorBr: 1.7,
    })
    // arcade and realistic genuinely differ upstream
    expect(byId(snap.vehicles, 'germ_flakpanzer_IV_Wirbelwind')).toMatchObject({
      arcadeBr: 4,
      realisticBr: 3.7,
      simulatorBr: 3.7,
    })
    expect(byId(snap.vehicles, 'tiger_uht')).toMatchObject({
      arcadeBr: 10,
      realisticBr: 12.7,
      simulatorBr: 10.7,
    })
  })

  it('spans 1.0 to 15.0 in thirds across the 43 economic ranks', async () => {
    const table = Array.from({ length: 43 }, (_, i) => battleRating(i))

    expect(table[0]).toBe(1)
    expect(table.at(-1)).toBe(15)
    expect(table.slice(0, 7)).toEqual([1, 1.3, 1.7, 2, 2.3, 2.7, 3])
    // every step is a third of a BR, and nothing carries float noise
    for (const br of table) expect(Number(br.toFixed(1))).toBe(br)
  })

  it('resolves class by precedence, not by the order tags appear', async () => {
    const snap = await snapshot()

    // coarse tag leads, fine tag leads, and modifiers sort first — all resolve
    expect(byId(snap.vehicles, 'nt_mig_23mld')!.vehicleType).toBe('fighter')
    expect(byId(snap.vehicles, 'ussr_object_775')!.vehicleType).toBe(
      'tank_destroyer',
    )
    expect(byId(snap.vehicles, 'mosquito_f_mk2_norway')!.vehicleType).toBe(
      'fighter',
    )
    expect(byId(snap.vehicles, 'tu_95m')!.vehicleType).toBe('bomber')
    expect(byId(snap.vehicles, 'b5n2')!.vehicleType).toBe('bomber')
    expect(byId(snap.vehicles, 'tiger_uht')!.vehicleType).toBe(
      'attack_helicopter',
    )
    // the most specific naval tag wins over the two coarser ones it carries
    expect(byId(snap.vehicles, 'us_sc_497')!.vehicleType).toBe('heavy_boat')
  })

  it('warns once per run listing the tags it ignored as modifiers', async () => {
    const snap = await snapshot()

    const warning = snap.warnings!.find((w) => w.includes('modifier'))
    expect(warning).toBeDefined()
    // the five capability modifiers on kept units, deduplicated and sorted
    expect(warning).toContain('type_aa_fighter')
    expect(warning).toContain('type_missile_tank')
    expect(warning).toContain('type_naval_aircraft')
    expect(warning).toContain('type_torpedo')
    // tags carried only by excluded units never reach classification
    expect(warning).not.toContain('type_strike_ucav')
    expect(warning).not.toContain('type_human')
    // non-type tags are not classification input at all
    expect(warning).not.toContain('country_usa')
    expect(snap.warnings!.filter((w) => w.includes('modifier'))).toHaveLength(1)
  })

  it('skips a unit with no recognized base class tag, with a warning', async () => {
    const snap = await snapshot({
      unittags: {
        ...UNITTAGS,
        us_m1_abrams: { tags: { country_usa: true, type_hovercraft: true } },
      },
    })

    expect(byId(snap.vehicles, 'us_m1_abrams')).toBeUndefined()
    expect(snap.warnings!.join('\n')).toMatch(
      /no recognized base class tag.*us_m1_abrams/s,
    )
    // the vocabulary that caused the drop must be named, not just counted —
    // otherwise the run reports a lost vehicle and no way to find out why
    expect(snap.warnings!.find((w) => w.includes('modifier'))).toContain(
      'type_hovercraft',
    )
  })

  describe('scripted-unit exclusion', () => {
    it('drops units with no shop-name entry', async () => {
      const snap = await snapshot()

      expect(byId(snap.vehicles, 'ak_74m')).toBeUndefined()
      const warning = snap.warnings!.find((w) => w.includes('shop-name'))
      expect(warning).toContain('ak_74m')
    })

    it('drops _killstreak units, which carry shop names and full economy data', async () => {
      const snap = await snapshot()

      expect(
        byId(snap.vehicles, 'ucav_mq_1_predator_usa_killstreak'),
      ).toBeUndefined()
      expect(snap.warnings!.join('\n')).toMatch(/killstreak/)
    })

    it('drops country_invisible units that no other leg catches', async () => {
      const snap = await snapshot()

      // both are shop-named and not _killstreak — only operatorCountry closes them
      expect(byId(snap.vehicles, 'uav_quadcopter')).toBeUndefined()
      expect(byId(snap.vehicles, 'us_m8_scott_snowball')).toBeUndefined()
      const warning = snap.warnings!.find((w) => w.includes('country_invisible'))
      expect(warning).toContain('uav_quadcopter')
      expect(warning).toContain('us_m8_scott_snowball')
    })

    it('keeps every ownable unit', async () => {
      const snap = await snapshot()

      expect(snap.vehicles.map((v) => v.externalId).sort()).toEqual([
        'b5n2',
        'f-5e_fcu_thailand',
        'germ_flakpanzer_IV_Wirbelwind',
        'mosquito_f_mk2_norway',
        'nt_mig_23mld',
        'tiger_uht',
        'tu_95m',
        'us_m1_abrams',
        'us_sc_497',
        'ussr_object_775',
        'ussr_t_35',
      ])
    })
  })

  it('requires a unit in both wpcost and unittags', async () => {
    const snap = await snapshot({
      unittags: Object.fromEntries(
        Object.entries(UNITTAGS).filter(([id]) => id !== 'us_m1_abrams'),
      ),
    })

    expect(byId(snap.vehicles, 'us_m1_abrams')).toBeUndefined()
    expect(snap.warnings!.join('\n')).toMatch(/unittags.*us_m1_abrams/s)
  })

  it('reads the economy flags off wpcost', async () => {
    const snap = await snapshot()

    expect(byId(snap.vehicles, 'ussr_t_35')).toMatchObject({
      isPremium: true,
      isSquadron: false,
      event: null,
    })
    expect(byId(snap.vehicles, 'f-5e_fcu_thailand')).toMatchObject({
      isPremium: false,
      isSquadron: true,
    })
    expect(byId(snap.vehicles, 'tu_95m')).toMatchObject({
      isPremium: false,
      isSquadron: false,
      event: 'nuclear_thunder',
    })
  })

  it('builds image URLs from the lowercased identifier, foldered by branch', async () => {
    const snap = await snapshot()

    expect(byId(snap.vehicles, 'germ_flakpanzer_IV_Wirbelwind')!.imageUrl).toBe(
      `${BASE}/tex.vromfs.bin_u/tanks/germ_flakpanzer_iv_wirbelwind.png`,
    )
    // helicopters live under aircrafts, with the rest of the air branch
    expect(byId(snap.vehicles, 'tiger_uht')!.imageUrl).toBe(
      `${BASE}/tex.vromfs.bin_u/aircrafts/tiger_uht.png`,
    )
    expect(byId(snap.vehicles, 'us_sc_497')!.imageUrl).toBe(
      `${BASE}/tex.vromfs.bin_u/ships/us_sc_497.png`,
    )
  })

  it('strips the country_ prefix into the sync engine vocabulary', async () => {
    const snap = await snapshot()

    expect(byId(snap.vehicles, 'germ_flakpanzer_IV_Wirbelwind')!.country).toBe(
      'germany',
    )
    // operatorCountry is a scripted-unit signal, never the nation
    expect(byId(snap.vehicles, 'f-5e_fcu_thailand')!.country).toBe('japan')
    expect(byId(snap.vehicles, 'mosquito_f_mk2_norway')!.country).toBe('sweden')
  })

  it('keeps semicolons and quotes inside locale names intact', async () => {
    const snap = await snapshot({
      unitsCsv: [
        '"<ID|readonly|noverify>";"<English>";"<French>"',
        '"us_m1_abrams_shop";"M1; Abrams ""Semi""";"M1"',
      ].join('\n'),
    })

    expect(byId(snap.vehicles, 'us_m1_abrams')!.name).toBe('M1; Abrams "Semi"')
  })

  it('rejects a version file that is not a game version', async () => {
    await expect(snapshot({ version: '<!DOCTYPE html>' })).rejects.toThrow(
      /version/i,
    )
  })

  it('rejects a locale file that parsed to nothing', async () => {
    await expect(snapshot({ unitsCsv: '' })).rejects.toThrow(/locale/i)
  })

  it('retries transient upstream failures before giving up', async () => {
    let attempts = 0
    const snap = await snapshot({
      replies: {
        version: () =>
          ++attempts < 3
            ? { status: 503, body: 'brownout' }
            : { body: DATAMINE_VERSION },
      },
    })

    expect(attempts).toBe(3)
    expect(snap.gameVersion).toBe('2.57.1.49')
  })

  it('does not retry a non-transient 4xx', async () => {
    let attempts = 0
    const failing = snapshot({
      replies: {
        wpcost: () => {
          attempts++
          return { status: 404, body: 'nope' }
        },
      },
    })

    await expect(failing).rejects.toThrow(/404/)
    expect(attempts).toBe(1)
  })

  it('throws once retries are exhausted', async () => {
    await expect(
      snapshot({ replies: { unittags: () => ({ status: 500, body: 'down' }) } }),
    ).rejects.toThrow(/500/)
  })
})
