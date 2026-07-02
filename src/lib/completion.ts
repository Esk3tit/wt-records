export function completionPct(covered: number, eligible: number): number {
  return eligible > 0 ? Math.round((covered / eligible) * 100) : 0
}
