export type FeedRowPhase = 'settled' | 'entering' | 'exiting'

export interface FeedRow<T extends { id: number }> {
  entry: T
  phase: FeedRowPhase
}

// Reconciles the displayed rows against a freshly refetched feed (oldest
// first). Retained rows keep their position and take the fresh entry data;
// dropped rows are held in place as 'exiting' until their exit animation ends;
// new rows append at the bottom as 'entering'.
export function mergeFeedRows<T extends { id: number }>(
  prev: FeedRow<T>[],
  next: T[],
): FeedRow<T>[] {
  const nextById = new Map(next.map((entry) => [entry.id, entry]))
  const prevIds = new Set(prev.map((row) => row.entry.id))
  const retained = prev.map((row): FeedRow<T> => {
    const fresh = nextById.get(row.entry.id)
    return fresh
      ? { entry: fresh, phase: 'settled' }
      : { entry: row.entry, phase: 'exiting' }
  })
  const entering = next
    .filter((entry) => !prevIds.has(entry.id))
    .map((entry): FeedRow<T> => ({ entry, phase: 'entering' }))
  return [...retained, ...entering]
}
