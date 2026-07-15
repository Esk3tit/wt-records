// Rightful-holder rule for the auto-title recompute (issue-driven, pure):
// highest kills wins; a kills tie goes to the earliest verifiedAt
// (first-to-achieve); id is the final deterministic tiebreak.

export interface TitleCandidate {
  id: number
  kills: number
  verifiedAt: Date | null
}

export function rightfulHolder(candidates: TitleCandidate[]): number | null {
  let best: TitleCandidate | null = null
  for (const c of candidates) {
    if (!best || beats(c, best)) best = c
  }
  return best?.id ?? null
}

function beats(a: TitleCandidate, b: TitleCandidate): boolean {
  if (a.kills !== b.kills) return a.kills > b.kills
  const aAt = a.verifiedAt?.getTime() ?? Infinity
  const bAt = b.verifiedAt?.getTime() ?? Infinity
  if (aAt !== bAt) return aAt < bAt
  return a.id < b.id
}
