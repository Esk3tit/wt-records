import { describe, expect, it } from 'vitest'
import {
  assignVehicleSlug,
  branchAndClassForType,
  latestGameVersion,
  modeBrField,
  nationForCountry,
  patchFromGameVersion,
} from '#/catalog/mapping'

describe('branchAndClassForType', () => {
  it('maps ground datamine types to the ground branch and rule classes', () => {
    expect(branchAndClassForType('light_tank')).toEqual({
      branch: 'ground',
      class: 'light',
    })
    expect(branchAndClassForType('medium_tank')).toEqual({
      branch: 'ground',
      class: 'medium',
    })
    expect(branchAndClassForType('heavy_tank')).toEqual({
      branch: 'ground',
      class: 'heavy',
    })
    expect(branchAndClassForType('tank_destroyer')).toEqual({
      branch: 'ground',
      class: 'spg',
    })
    expect(branchAndClassForType('spaa')).toEqual({
      branch: 'ground',
      class: 'spaa',
    })
  })

  it('maps aircraft and helicopters to the air branch — heli is an air class', () => {
    expect(branchAndClassForType('fighter')).toEqual({
      branch: 'air',
      class: 'fighter',
    })
    expect(branchAndClassForType('assault')).toEqual({
      branch: 'air',
      class: 'attacker',
    })
    expect(branchAndClassForType('bomber')).toEqual({
      branch: 'air',
      class: 'bomber',
    })
    expect(branchAndClassForType('attack_helicopter')).toEqual({
      branch: 'air',
      class: 'heli',
    })
    expect(branchAndClassForType('utility_helicopter')).toEqual({
      branch: 'air',
      class: 'heli',
    })
  })

  it('maps every naval datamine type to naval/other', () => {
    for (const t of [
      'boat',
      'heavy_boat',
      'barge',
      'frigate',
      'destroyer',
      'light_cruiser',
      'heavy_cruiser',
      'battlecruiser',
      'battleship',
      'submarine',
      'ship',
    ]) {
      expect(branchAndClassForType(t)).toEqual({
        branch: 'naval',
        class: 'other',
      })
    }
  })

  it('returns null for unknown datamine types so the sync can warn, not guess', () => {
    expect(branchAndClassForType('exoskeleton')).toBeNull()
    expect(branchAndClassForType('')).toBeNull()
  })
})

describe('patchFromGameVersion', () => {
  it('keeps the community-facing major.minor of a full game version', () => {
    expect(patchFromGameVersion('2.57.0.8')).toBe('2.57')
    expect(patchFromGameVersion('2.53.0.109')).toBe('2.53')
  })

  it('rejects strings that are not a dotted game version', () => {
    expect(() => patchFromGameVersion('latest')).toThrow(/game version/i)
    expect(() => patchFromGameVersion('2')).toThrow(/game version/i)
    expect(() => patchFromGameVersion('')).toThrow(/game version/i)
  })
})

describe('latestGameVersion', () => {
  it('picks the numerically greatest version, not the last element', () => {
    expect(latestGameVersion(['2.55.1.153', '2.57.0.8', '2.47.0.134'])).toBe(
      '2.57.0.8',
    )
    // numeric compare: 2.9 < 2.55
    expect(latestGameVersion(['2.9.0.1', '2.55.0.1'])).toBe('2.55.0.1')
  })

  it('throws on an empty list — a snapshot must know its game version', () => {
    expect(() => latestGameVersion([])).toThrow(/version/i)
  })

  it('ignores versions with non-numeric segments instead of mis-ordering them', () => {
    expect(latestGameVersion(['2.55.0.1', '2.57.0.8-rc1'])).toBe('2.55.0.1')
    expect(() => latestGameVersion(['latest', '2.57_hotfix'])).toThrow(
      /version/i,
    )
  })
})

describe('assignVehicleSlug', () => {
  it('walks base → nation suffix → counter to dodge collisions', () => {
    const taken = new Set<string>()
    expect(assignVehicleSlug('T-34 (1941)', 'ussr_t_34', 'ussr', taken)).toBe(
      't-34-1941',
    )
    taken.add('t-34-1941')
    expect(assignVehicleSlug('T-34 (1941)', 'sw_t_34', 'sweden', taken)).toBe(
      't-34-1941-sweden',
    )
    taken.add('t-34-1941-sweden')
    expect(assignVehicleSlug('T-34 (1941)', 'sw_t_34b', 'sweden', taken)).toBe(
      't-34-1941-sweden-2',
    )
  })

  it('falls back to the externalId, and to null when nothing slugifies', () => {
    expect(assignVehicleSlug('武器', 'cn_type_59', 'china', new Set())).toBe(
      'cn-type-59',
    )
    expect(assignVehicleSlug('···', '→→', 'china', new Set())).toBeNull()
  })
})

describe('nationForCountry', () => {
  it('covers every datamine country with a unique in-game sort', () => {
    const countries = [
      'usa',
      'germany',
      'ussr',
      'britain',
      'japan',
      'china',
      'italy',
      'france',
      'sweden',
      'israel',
    ]
    const nations = countries.map((c) => nationForCountry(c))
    for (const n of nations) expect(n).not.toBeNull()
    const sorts = nations.map((n) => n!.sort)
    expect(new Set(sorts).size).toBe(countries.length)
    expect(nationForCountry('usa')).toEqual({
      slug: 'usa',
      name: 'USA',
      sort: 1,
    })
    expect(nationForCountry('britain')!.name).toBe('Great Britain')
  })

  it('returns null for a country it does not know', () => {
    expect(nationForCountry('atlantis')).toBeNull()
  })
})

describe('modeBrField', () => {
  it('routes realistic modes to realistic BR and arcade modes to arcade BR', () => {
    expect(modeBrField('grb')).toBe('realisticBr')
    expect(modeBrField('arb')).toBe('realisticBr')
    expect(modeBrField('gab')).toBe('arcadeBr')
    expect(modeBrField('aab')).toBe('arcadeBr')
  })

  it('returns null for a mode with no configured BR source', () => {
    expect(modeBrField('nrb')).toBeNull()
  })
})
