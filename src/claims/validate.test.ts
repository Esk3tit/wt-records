import { describe, expect, it } from 'vitest'
import {
  linkValue,
  optionalNote,
  positiveInt,
  selectableCountryCode,
  storablePlatform,
} from '#/claims/validate'
import { MAX_LINK_INPUT, MAX_NOTE_LENGTH } from '#/claims/limits'

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

/* The link boundary. These take untrusted network payloads on a field that
   publishes instantly with nobody reviewing it, so what they refuse is the
   whole of what the write path never has to think about. */

describe('storablePlatform', () => {
  it('accepts a configured platform and the personal site', () => {
    expect(storablePlatform('youtube')).toBe('youtube')
    expect(storablePlatform('website')).toBe('website')
  })

  it('refuses one that is admissible but not shipped', () => {
    expect(() => storablePlatform('kick')).toThrow(/cannot add that one here/)
  })

  it('refuses one refused by a clause, and one nobody has heard of', () => {
    for (const bad of ['steam', 'mastodon', 'lemmy', 'matrix', 'myspace']) {
      expect(() => storablePlatform(bad)).toThrow(/cannot add that one here/)
    }
  })

  // The payload is untrusted, so the shape is checked before the value.
  it('refuses a non-string, and a key it might inherit rather than own', () => {
    for (const bad of [42, null, undefined, {}, ['youtube']]) {
      expect(() => storablePlatform(bad)).toThrow(/must be a name/)
    }
    for (const inherited of ['constructor', 'toString', '__proto__']) {
      expect(() => storablePlatform(inherited)).toThrow(
        /cannot add that one here/,
      )
    }
  })
})

describe('linkValue', () => {
  it('passes text through for the platform parser to judge', () => {
    expect(linkValue('PhlyDaily')).toBe('PhlyDaily')
    // Bounded here, meant here: what it has to LOOK like is the config's call.
    expect(linkValue('https://www.youtube.com/@PhlyDaily')).toBe(
      'https://www.youtube.com/@PhlyDaily',
    )
    expect(linkValue('')).toBe('')
  })

  it('refuses a non-string and anything past the ceiling', () => {
    for (const bad of [42, null, undefined, {}]) {
      expect(() => linkValue(bad)).toThrow(/must be text/)
    }
    expect(linkValue('x'.repeat(MAX_LINK_INPUT))).toHaveLength(MAX_LINK_INPUT)
    expect(() => linkValue('x'.repeat(MAX_LINK_INPUT + 1))).toThrow(/too long/)
  })
})
