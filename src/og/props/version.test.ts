import { describe, expect, it } from 'vitest'
import { contentVersion } from './version'

describe('contentVersion', () => {
  it('is stable for the same fields', () => {
    const fields = { a: 1, b: 'два', c: [1, 2, 3] }
    expect(contentVersion(fields)).toBe(contentVersion({ ...fields }))
  })

  it('moves for any edit to a rendered field', () => {
    const base = contentVersion({ name: 'Ace', kills: 21 })
    expect(contentVersion({ name: 'Ace', kills: 22 })).not.toBe(base)
    expect(contentVersion({ name: 'Асе', kills: 21 })).not.toBe(base)
  })

  it('separates a pair the 32-bit hash collided', () => {
    // Searched out against the old hash, which gave both `kyj9gn`: a rename
    // between them left the URL unchanged, so the card stayed stale.
    expect(contentVersion({ displayName: 'Player 4pf8' })).not.toBe(
      contentVersion({ displayName: 'Player lrj6' }),
    )
  })
})
