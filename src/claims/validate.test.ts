import { describe, expect, it } from 'vitest'
import {
  optionalNote,
  positiveInt,
  selectableCountryCode,
} from '#/claims/validate'
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

describe('selectableCountryCode', () => {
  it('clears on null and stores uppercase whatever case it arrives in', () => {
    expect(selectableCountryCode(null)).toBeNull()
    expect(selectableCountryCode('gb')).toBe('GB')
    expect(selectableCountryCode('JP')).toBe('JP')
  })

  it('refuses what ships in the flag package but is not selectable', () => {
    for (const bad of ['GB-SCT', 'ES-CT', 'EU', 'AC', 'TA', 'IC']) {
      expect(() => selectableCountryCode(bad)).toThrow(/from the list/)
    }
  })

  it('refuses a non-string and an unknown code', () => {
    expect(() => selectableCountryCode(42)).toThrow(/code/)
    expect(() => selectableCountryCode('ZZ')).toThrow(/from the list/)
  })

  // An omitted field is a malformed payload, not an instruction to clear.
  it('refuses an absent value rather than reading it as a clear', () => {
    expect(() => selectableCountryCode(undefined)).toThrow(/code/)
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
