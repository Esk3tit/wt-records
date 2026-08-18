const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK = 0xffffffffffffffffn

// Content version for the `?v=` cache bust. Hashing every rendered field (not
// just the record time) means any edit — a holder rename, a BR change, a nation's
// most-held player — yields a new URL, so the edge/social cache can't serve a
// stale card. FNV-1a over a stable JSON of the fields; pure, runs in head().
//
// 64-bit, not 32: at 32 a collision pair is cheap to find, and two states of one
// card that collide share a URL — the one case where a stale unfurl survives.
export function contentVersion(fields: unknown): string {
  const str = JSON.stringify(fields)
  let hash = FNV_OFFSET
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i))
    hash = (hash * FNV_PRIME) & MASK
  }
  return hash.toString(36)
}
