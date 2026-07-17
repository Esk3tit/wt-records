// The record rules, as pure functions. The DB stores only the parameters
// (mode_min_kills + modes.difficultMinKills); evaluation lives here.
import type { VehicleClass } from '#/lib/vehicle-classes'

export type { VehicleClass } from '#/lib/vehicle-classes'

export interface ModeThresholds {
  /** Qualifying min kills per class for a mode (from `mode_min_kills`). */
  minKillsByClass: Partial<Record<VehicleClass, number>>
  /** Flat override for `isDifficult` vehicles (from `modes.difficultMinKills`). */
  difficultMinKills: number | null
}

/**
 * The qualifying kill threshold for a vehicle in a mode, or `null` if no
 * threshold is configured (treated as not-qualifiable). A difficult vehicle
 * uses the mode's difficult override; if that override is unset it falls back
 * to the class minimum.
 */
export function qualifyingThreshold(
  vehicleClass: VehicleClass,
  isDifficult: boolean,
  thresholds: ModeThresholds,
): number | null {
  if (isDifficult && thresholds.difficultMinKills != null) {
    return thresholds.difficultMinKills
  }
  return thresholds.minKillsByClass[vehicleClass] ?? null
}

/** Whether a run's kills meet the qualifying threshold. */
export function qualifies(
  kills: number,
  vehicleClass: VehicleClass,
  isDifficult: boolean,
  thresholds: ModeThresholds,
): boolean {
  const bar = qualifyingThreshold(vehicleClass, isDifficult, thresholds)
  return bar != null && kills >= bar
}

/**
 * Whether a challenger takes the title from the incumbent. A submission must
 * STRICTLY exceed the current record; an equal score does NOT supersede
 * (first-to-achieve keeps it). No incumbent → the challenger takes it.
 */
export function takesTitle(
  challengerKills: number,
  incumbentKills: number | null,
): boolean {
  if (incumbentKills == null) return true
  return challengerKills > incumbentKills
}

export interface TitleCandidate {
  id: number
  kills: number
  verifiedAt: Date | null
}

/**
 * The rightful CURRENT record among a (vehicle, mode)'s verified records:
 * highest kills wins; a kills tie goes to the earliest verifiedAt
 * (first-to-achieve, matching takesTitle); id is the deterministic tiebreak.
 */
export function rightfulHolder(candidates: TitleCandidate[]): number | null {
  let best: TitleCandidate | null = null
  for (const c of candidates) {
    if (!best || beats(c, best)) best = c
  }
  return best?.id ?? null
}

function beats(a: TitleCandidate, b: TitleCandidate): boolean {
  if (a.kills !== b.kills) return a.kills > b.kills
  // null verifiedAt = oldest, matching the public ranking's "nulls first"
  // (a migrated record predates anything the site itself verified).
  const aAt = a.verifiedAt?.getTime() ?? -Infinity
  const bAt = b.verifiedAt?.getTime() ?? -Infinity
  if (aAt !== bAt) return aAt < bAt
  return a.id < b.id
}
