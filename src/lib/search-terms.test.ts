import { describe, expect, it } from 'vitest'
import { searchKey, nameSearchTerms } from '#/lib/search-terms'

describe('searchKey', () => {
  it('collapses separators so t34, t-34, and t 34 unify', () => {
    expect(searchKey('T-34 (1941)')).toBe('t341941')
    expect(searchKey('t 34')).toBe('t34')
    expect(searchKey('t34')).toBe('t34')
  })

  it('drops tree-marker glyphs', () => {
    expect(searchKey('␗Type 59')).toBe('type59')
    expect(searchKey('▄Merkava Mk.2B')).toBe('merkavamk2b')
  })

  it('strips diacritics', () => {
    expect(searchKey('Köln F220')).toBe('kolnf220')
  })

  it('collapses punctuation-heavy designations', () => {
    expect(searchKey('Pz.Kpfw. VI Tiger II (H)')).toBe('pzkpfwvitigeriih')
    expect(searchKey('Bf 109 F-4')).toBe('bf109f4')
  })

  it('returns empty for glyph-only input', () => {
    expect(searchKey('␗▄▀')).toBe('')
  })
})

describe('nameSearchTerms', () => {
  it('always includes the plain search key first', () => {
    expect(nameSearchTerms('Bf 109 F-4')[0]).toBe('bf109f4')
  })

  it('expands roman numerals to arabic (Tiger II → tiger 2)', () => {
    expect(nameSearchTerms('Tiger II (H)')).toContain('tiger2h')
    expect(nameSearchTerms('Churchill VII')).toContain('churchill7')
    expect(nameSearchTerms('Mark V')).toContain('mark5')
  })

  it('expands arabic numerals to roman (Leopard 2 → leopard ii)', () => {
    expect(nameSearchTerms('Leopard 2')).toContain('leopardii')
  })

  it('cross-products multiple numeral tokens', () => {
    expect(nameSearchTerms('Pz.Kpfw. VI Tiger II')).toEqual(
      expect.arrayContaining([
        'pzkpfwvitigerii',
        'pzkpfw6tigerii',
        'pzkpfwvitiger2',
        'pzkpfw6tiger2',
      ]),
    )
  })

  it('never treats out-of-range letters as numerals', () => {
    const kfir = nameSearchTerms('Kfir C.7')
    expect(kfir).toContain('kfirc7')
    expect(kfir.some((t) => t.includes('100'))).toBe(false)
    const mustang = nameSearchTerms('P-51D-30')
    expect(mustang).toContain('p51d30')
    expect(mustang.some((t) => t.includes('500'))).toBe(false)
  })

  it('ignores mixed alphanumeric tokens (2A4 is a designation)', () => {
    expect(nameSearchTerms('Leopard 2A4')).toEqual(['leopard2a4'])
  })

  it('rejects non-canonical roman strings (IS-2 stays a designation)', () => {
    expect(nameSearchTerms('IS-2')).toEqual(
      expect.arrayContaining(['is2', 'isii']),
    )
    expect(nameSearchTerms('IS-2')).not.toContain('1s2')
  })

  it('caps numeral-heavy names instead of exploding', () => {
    const terms = nameSearchTerms('I II III IV V VI')
    expect(terms.length).toBeLessThanOrEqual(16)
    expect(terms[0]).toBe('iiiiiiivvvi')
  })

  it('returns nothing for glyph-only names', () => {
    expect(nameSearchTerms('␗▄▀')).toEqual([])
  })
})
