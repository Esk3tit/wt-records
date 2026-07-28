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

export interface TitleTimeline<T> {
  reigns: Array<TitleReign<T>>
  /** False once a moderator has handed the title to a record the kill frontier
      does not end on (makeCurrentRecord permits it, and does not retire the
      record it displaces). These rows then cannot say who held what when, so
      callers must drop every tenure claim rather than invent one. */
  chronologyKnown: boolean
}

/** Each verified record paired with the reign it had, oldest first. A losing
    record neither gets a reign nor closes anybody else's. */
export function titleReigns<
  T extends { kills: number; verifiedAt: Date | null; isCurrent?: boolean },
>(oldestFirst: T[]): TitleTimeline<T> {
  const holders = titleFrontier(oldestFirst)
  const rank = new Map(holders.map((row, i) => [row, i]))
  const reigns = oldestFirst.map((row) => {
    const i = rank.get(row)
    return {
      row,
      heldTitle: i != null,
      // The title left a holder when the NEXT holder took it — the next
      // frontier entry, never simply the next row.
      endedAt: i == null ? null : (holders[i + 1]?.verifiedAt ?? null),
    }
  })
  const current = oldestFirst.find((row) => row.isCurrent)
  return {
    reigns,
    chronologyKnown: current == null || holders.at(-1) === current,
  }
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
