import { describe, expect, it } from 'vitest'
import { optionalNote, positiveInt } from '#/claims/validate'
import { MAX_NOTE_LENGTH } from '#/claims/limits'

describe('positiveInt', () => {
  it('accepts a positive integer', () => {
    expect(positiveInt(42, 'playerId')).toBe(42)
  })

  it('rejects non-numbers, non-integers, non-positive, and unsafe integers', () => {
    for (const bad of [
      '5',
      1.5,
      0,
      -1,
      NaN,
      null,
      undefined,
      {},
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => positiveInt(bad, 'playerId')).toThrow(/playerId/)
    }
  })
})

describe('optionalNote', () => {
  it('passes through an absent note or a valid string', () => {
    expect(optionalNote(undefined)).toBeUndefined()
    expect(optionalNote(null)).toBeUndefined()
    expect(optionalNote('hi')).toBe('hi')
  })

  it('rejects a non-string note and one over the length cap', () => {
    expect(() => optionalNote(123)).toThrow(/text/)
    expect(() => optionalNote('x'.repeat(MAX_NOTE_LENGTH + 1))).toThrow(
      /at most/,
    )
  })
})
