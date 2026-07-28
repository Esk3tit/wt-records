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

/** `kills` is null only when the mode configures no bar for the class. */
export type TitleBar =
  { held: true; kills: number } | { held: false; kills: number | null }

/** A held title is taken by STRICTLY exceeding it (hence +1, per takesTitle),
    an open one by clearing the qualifying bar. A standing record below its own
    class bar — the migrated corpus has them — still only has to be exceeded. */
export function titleBar(
  currentKills: number | null,
  qualifying: number | null,
): TitleBar {
  if (currentKills != null) return { held: true, kills: currentKills + 1 }
  return { held: false, kills: qualifying }
}

/* Only strictly more kills takes a title, so the entries that actually held it
   are the ascending frontier. Migrated rows can carry a later date with fewer
   kills — verified lives, but never holders. */
export function titleFrontier<T extends { kills: number }>(rows: T[]): T[] {
  const frontier: T[] = []
  let best = 0
  for (const row of rows) {
    if (row.kills > best) {
      frontier.push(row)
      best = row.kills
    }
  }
  return frontier
}

export interface TitleReign<T> {
  row: T
  /** Whether this record ever held the title, rather than merely being a
      verified life below the standing record. */
  heldTitle: boolean
  /** When the title left it — the date of the record that actually took it,
      which is the next FRONTIER entry and not simply the next row. Null while
      it still holds, or when it never held at all. */
  endedAt: Date | null
}

/** Each verified record paired with the reign it had, oldest first. A losing
    record neither gets a reign nor closes anybody else's. */
export function titleReigns<
  T extends { kills: number; verifiedAt: Date | null },
>(oldestFirst: T[]): Array<TitleReign<T>> {
  const frontier = new Set(titleFrontier(oldestFirst))
  let previousHolder: TitleReign<T> | null = null
  return oldestFirst.map((row) => {
    const reign: TitleReign<T> = {
      row,
      heldTitle: frontier.has(row),
      endedAt: null,
    }
    if (reign.heldTitle) {
      if (previousHolder) previousHolder.endedAt = row.verifiedAt
      previousHolder = reign
    }
    return reign
  })
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
