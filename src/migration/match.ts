/* Sheet-name → catalog-vehicle matching. Pure functions over an in-memory
   catalog slice; Resolve loads the slice from the DB. */

import { nameSearchTerms, searchKey } from '#/lib/search-terms'
import type { VehicleClass } from '#/lib/vehicle-classes'

export interface CatalogVehicle {
  externalId: string
  name: string
  nation: string
  class: VehicleClass
  isRemoved: boolean
  /** Precomputed nameSearchTerms(name) — same generation the catalog uses. */
  terms: Array<string>
}

export interface MatchCandidate {
  externalId: string
  name: string
  score: number
}

export interface MatchResult {
  matched: CatalogVehicle | null
  confidence: 'exact' | 'fuzzy' | null
  /** Best candidates, for review artifacts and override proposals. */
  candidates: Array<MatchCandidate>
}

/** Character-bigram Dice similarity on collapsed keys — cheap and robust to
    the sheet's abbreviations and symbol/emoji prefixes (searchKey drops
    non-alphanumerics entirely). */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = (s: string) => {
    const map = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      map.set(bg, (map.get(bg) ?? 0) + 1)
    }
    return map
  }
  const aBigrams = bigrams(a)
  let overlap = 0
  for (const [bg, count] of bigrams(b)) {
    const inA = aBigrams.get(bg) ?? 0
    overlap += Math.min(inA, count)
  }
  return (2 * overlap) / (a.length - 1 + b.length - 1)
}

function containmentScore(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return long.includes(short) ? short.length / long.length : 0
}

function pairScore(
  sheetTerms: Array<string>,
  vehicleTerms: Array<string>,
): number {
  let best = 0
  for (const s of sheetTerms) {
    for (const v of vehicleTerms) {
      if (s === v) return 1
      const score = Math.max(containmentScore(s, v), diceSimilarity(s, v))
      if (score > best) best = score
    }
  }
  return best
}

/* A fuzzy match is only trusted when it is both strong and clearly ahead of
   the runner-up; anything murkier goes to the review artifact instead. */
const FUZZY_ACCEPT = 0.72
const FUZZY_MARGIN = 0.08

export function matchVehicle(
  sheetName: string,
  nation: string | null,
  vehicles: ReadonlyArray<CatalogVehicle>,
): MatchResult {
  const pool = nation
    ? vehicles.filter((v) => v.nation === nation)
    : [...vehicles]
  const sheetTerms = nameSearchTerms(sheetName)
  if (sheetTerms.length === 0) sheetTerms.push(searchKey(sheetName))

  const scored = pool
    .map((vehicle) => ({
      vehicle,
      score: pairScore(sheetTerms, vehicle.terms),
    }))
    .sort((a, b) => b.score - a.score)

  const candidates = scored.slice(0, 3).map(({ vehicle, score }) => ({
    externalId: vehicle.externalId,
    name: vehicle.name,
    score: Math.round(score * 1000) / 1000,
  }))

  const exact = scored.filter((s) => s.score === 1)
  if (exact.length === 1) {
    return { matched: exact[0].vehicle, confidence: 'exact', candidates }
  }
  if (exact.length > 1) {
    // Two catalog vehicles share a matching term — a human must pick.
    return { matched: null, confidence: null, candidates }
  }

  const best = scored.at(0)
  const second = scored.at(1)
  if (
    best !== undefined &&
    best.score >= FUZZY_ACCEPT &&
    best.score - (second?.score ?? 0) >= FUZZY_MARGIN
  ) {
    return { matched: best.vehicle, confidence: 'fuzzy', candidates }
  }
  return { matched: null, confidence: null, candidates }
}

/** Difficult-list entries match name-first across the whole catalog; the
    nation hint only disambiguates when several nations share the name. */
export function matchDifficultVehicle(
  name: string,
  nation: string | undefined,
  vehicles: ReadonlyArray<CatalogVehicle>,
): MatchResult {
  const global = matchVehicle(name, null, vehicles)
  if (global.matched) return global
  if (nation) {
    const scoped = matchVehicle(name, nation, vehicles)
    if (scoped.matched) return scoped
    return global.candidates.length >= scoped.candidates.length
      ? global
      : scoped
  }
  return global
}
