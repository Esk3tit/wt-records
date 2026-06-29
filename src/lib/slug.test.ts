import { describe, expect, it } from 'vitest'
import { slugify } from '#/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates spaced names', () => {
    expect(slugify('M4A1 Sherman')).toBe('m4a1-sherman')
  })

  it('strips diacritics to ASCII', () => {
    expect(slugify('Naïve')).toBe('naive')
  })

  it('collapses symbols/emoji and trims edges', () => {
    expect(slugify('★ Tiger II (H) ★')).toBe('tiger-ii-h')
  })
})
