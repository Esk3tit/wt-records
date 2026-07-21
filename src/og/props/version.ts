// Content version for the `?v=` cache bust. Hashing every rendered field (not
// just the record time) means any edit — a holder rename, a BR change, a nation's
// most-held player — yields a new URL, so the edge/social cache can't serve a
// stale card. FNV-1a over a stable JSON of the fields; pure, runs in head().
export function contentVersion(fields: unknown): string {
  const str = JSON.stringify(fields)
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
