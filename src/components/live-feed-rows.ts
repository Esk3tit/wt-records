export type FeedRowPhase = 'settled' | 'entering' | 'exiting'

export interface FeedRow<T extends { id: number }> {
  entry: T
  phase: FeedRowPhase
}

// Reconciles displayed rows against a refetched feed (oldest first): the fresh
// order is the spine, dropped rows hold their position as 'exiting'.
export function mergeFeedRows<T extends { id: number }>(
  prev: FeedRow<T>[],
  next: T[],
): FeedRow<T>[] {
  if (
    prev.length === next.length &&
    prev.every((row, i) => row.entry === next[i] && row.phase === 'settled')
  ) {
    return prev
  }

  const prevById = new Map(prev.map((row) => [row.entry.id, row]))
  const nextIds = new Set(next.map((entry) => entry.id))

  // A new id is a live arrival only when it extends the newest end of the
  // feed; one surfacing mid-list (or in a wholesale swap) is backfill that
  // never deserves the just-in fanfare.
  let lastKnownIdx = -1
  for (let i = next.length - 1; i >= 0 && lastKnownIdx === -1; i--) {
    if (prevById.has(next[i].id)) lastKnownIdx = i
  }
  const spine = next.map((entry, i): FeedRow<T> => {
    const old = prevById.get(entry.id)
    if (old) {
      return { entry, phase: old.phase === 'exiting' ? 'settled' : old.phase }
    }
    const arriving = lastKnownIdx !== -1 && i > lastKnownIdx
    return { entry, phase: arriving ? 'entering' : 'settled' }
  })

  // An exiting row fades out anchored after its nearest surviving upstream
  // neighbor, so the log stays chronological while it leaves.
  const merged: FeedRow<T>[] = [...spine]
  prev.forEach((row, prevIdx) => {
    if (nextIds.has(row.entry.id)) return
    let anchor = -1
    for (let i = prevIdx - 1; i >= 0 && anchor === -1; i--) {
      anchor = merged.findIndex((m) => m.entry.id === prev[i].entry.id)
    }
    merged.splice(anchor + 1, 0, { entry: row.entry, phase: 'exiting' })
  })
  return merged
}
