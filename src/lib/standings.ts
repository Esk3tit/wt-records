export interface RankableNation {
  name: string
  coveredVehicles: number
  eligibleVehicles: number
  openBounties: number
}

/** Places nations by Completion %, tie-broken by titles held then name. A Mode
    nobody has scored in has no places at all — it orders by the size of the
    unclaimed prize instead — and holding nothing is never a place. */
export function rankNations<T extends RankableNation>(
  nations: T[],
  contested: boolean,
): (T & { rank: number | null })[] {
  const ordered = [...nations].sort((a, b) =>
    contested
      ? // The stored percentage is rounded for display; ordering on it would
        // tie nations that aren't tied and let the next key invert them.
        b.coveredVehicles / b.eligibleVehicles -
          a.coveredVehicles / a.eligibleVehicles ||
        b.coveredVehicles - a.coveredVehicles ||
        a.name.localeCompare(b.name)
      : b.openBounties - a.openBounties || a.name.localeCompare(b.name),
  )
  let place = 0
  return ordered.map((n) => ({
    ...n,
    rank: contested && n.coveredVehicles > 0 ? ++place : null,
  }))
}
