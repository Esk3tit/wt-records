// The record rules, as pure functions (PRD §7). The DB stores only the
// parameters (mode_min_kills + modes.difficultMinKills); evaluation lives here.
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

/** Whether a run's kills meet the qualifying threshold (PRD §7). */
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

/** Completion percentage for a mode: held / eligible, 0 when nothing eligible. */
export function completionPercent(held: number, eligible: number): number {
  if (eligible <= 0) return 0
  return (held / eligible) * 100
}
