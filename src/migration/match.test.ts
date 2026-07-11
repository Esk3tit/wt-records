import { describe, expect, it } from 'vitest'
import { nameSearchTerms } from '#/lib/search-terms'
import type { CatalogVehicle } from '#/migration/match'
import {
  diceSimilarity,
  matchDifficultVehicle,
  matchVehicle,
} from '#/migration/match'

function vehicle(
  externalId: string,
  name: string,
  nation: string,
): CatalogVehicle {
  return {
    externalId,
    name,
    nation,
    terms: nameSearchTerms(name),
  }
}

const CATALOG: Array<CatalogVehicle> = [
  vehicle('us_m1a2_sep_v3', 'M1A2 SEPv3', 'usa'),
  vehicle('us_m1a2', 'M1A2 Abrams', 'usa'),
  vehicle('de_tiger_2_h', '␗Tiger II (H)', 'germany'),
  vehicle('de_leopard_2a7v', 'Leopard 2A7V', 'germany'),
  vehicle('uk_sherman_2', 'Sherman II', 'britain'),
  vehicle('us_sherman_2', 'Sherman II', 'usa'),
  vehicle('uk_fv4005', 'FV4005', 'britain'),
  vehicle('il_zachlam_tager', 'Zachlam Tager', 'israel'),
  vehicle('ussr_bm_13n', 'BM-13N', 'ussr'),
]

describe('matchVehicle', () => {
  it('matches exactly through symbol prefixes and separators', () => {
    const result = matchVehicle('Tiger II (H)', 'germany', CATALOG)
    expect(result.matched?.externalId).toBe('de_tiger_2_h')
    expect(result.confidence).toBe('exact')
  })

  it('matches across roman/arabic numeral variants', () => {
    const result = matchVehicle('Tiger 2 (H)', 'germany', CATALOG)
    expect(result.matched?.externalId).toBe('de_tiger_2_h')
    expect(result.confidence).toBe('exact')
  })

  it('scopes duplicate names across nations by the tab nation', () => {
    expect(
      matchVehicle('Sherman II', 'britain', CATALOG).matched?.externalId,
    ).toBe('uk_sherman_2')
    expect(matchVehicle('Sherman II', 'usa', CATALOG).matched?.externalId).toBe(
      'us_sherman_2',
    )
  })

  it('accepts a clear fuzzy match and reports it as fuzzy', () => {
    const result = matchVehicle('Leopard 2A7', 'germany', CATALOG)
    expect(result.matched?.externalId).toBe('de_leopard_2a7v')
    expect(result.confidence).toBe('fuzzy')
  })

  it('returns candidates instead of guessing when nothing is close', () => {
    const result = matchVehicle('Object 279', 'germany', CATALOG)
    expect(result.matched).toBeNull()
    expect(result.candidates.length).toBeGreaterThan(0)
  })

  it('refuses ambiguous exact matches', () => {
    const twins = [
      vehicle('us_m4', 'M4', 'usa'),
      vehicle('us_m4_2', 'M4', 'usa'),
    ]
    const result = matchVehicle('M4', 'usa', twins)
    expect(result.matched).toBeNull()
    expect(result.candidates.map((c) => c.score)).toEqual([1, 1])
  })
})

describe('matchDifficultVehicle', () => {
  it('matches name-first across the whole catalog', () => {
    const result = matchDifficultVehicle('FV4005', undefined, CATALOG)
    expect(result.matched?.externalId).toBe('uk_fv4005')
  })

  it('uses the nation hint when the name is ambiguous globally', () => {
    const result = matchDifficultVehicle('Sherman II', 'britain', CATALOG)
    expect(result.matched?.externalId).toBe('uk_sherman_2')
  })
})

describe('diceSimilarity', () => {
  it('is 1 for equal keys and low for unrelated keys', () => {
    expect(diceSimilarity('m1a2sepv3', 'm1a2sepv3')).toBe(1)
    expect(diceSimilarity('m1a2sepv3', 'object279')).toBeLessThan(0.3)
  })
})
