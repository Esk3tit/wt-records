import { describe, expect, it } from 'vitest'
import { buildCountries } from '../../scripts/generate-countries'
import { COUNTRY_FLAGS } from '#/lib/country-flags.generated'
import { COUNTRIES, countryName, normalizeCountryCode } from '#/lib/countries'

/* The check the whole feature rests on. Steam ships 250 countries with 11
   having no flag image, start.gg lists Kosovo with no xk.svg, and FACEIT falls
   through to a fallback for 13 of its 250 — every one of those is a list that
   drifted from its assets. Here the list, the names and the marks come from one
   generator, and this fails the build the moment they stop agreeing. */

const marks = new Map(Object.entries(COUNTRY_FLAGS))

describe('the selectable country list', () => {
  it('offers ISO 3166-1 alpha-2 plus XK, 250 of them', () => {
    expect(COUNTRIES).toHaveLength(250)
    expect(COUNTRIES.map((c) => c.code)).toContain('XK')
  })

  it('resolves every selectable code to a real name and a real mark', () => {
    const unresolved = COUNTRIES.filter(
      (c) => !c.name.trim() || !marks.get(c.code)?.body.trim(),
    )
    expect(unresolved).toEqual([])
  })

  it('carries no mark for anything it does not offer', () => {
    const offered = new Set(COUNTRIES.map((c) => c.code))
    expect(Object.keys(COUNTRY_FLAGS).filter((c) => !offered.has(c))).toEqual(
      [],
    )
  })

  it('has not drifted from the generator', () => {
    const built = buildCountries()
    expect(COUNTRIES).toEqual(built.map(({ code, name }) => ({ code, name })))
    expect(COUNTRY_FLAGS).toEqual(
      Object.fromEntries(
        built.map(({ code, viewBox, body }) => [code, { viewBox, body }]),
      ),
    )
  })
})

describe('what the list refuses', () => {
  // Every one of these ships in country-flag-icons; none may leak in.
  it.each([
    'ES-CT',
    'EU',
    'AC',
    'TA',
    'IC',
    'GB-ENG',
    'GB-SCT',
    'GB-WLS',
    'GB-NIR',
  ])('does not offer %s', (code) => {
    expect(normalizeCountryCode(code)).toBeNull()
  })

  // The rule, not a carve-out: there is no English or Scottish citizenship.
  it('answers the home nations with the United Kingdom, or nothing', () => {
    expect(countryName('GB')).toBe('United Kingdom')
    expect(COUNTRIES.map((c) => c.name)).not.toContain('England')
    expect(COUNTRIES.map((c) => c.name)).not.toContain('Scotland')
  })

  it('refuses codes off the list without inventing a name', () => {
    expect(normalizeCountryCode('ZZ')).toBeNull()
    expect(normalizeCountryCode('')).toBeNull()
    expect(countryName('ZZ')).toBeNull()
  })
})

describe('what the list keeps', () => {
  // Removing these would be an argument we then own, and "why is my territory
  // missing" is a worse complaint than a joke flag.
  it.each(['AQ', 'BV', 'HM', 'TF', 'UM', 'GS'])(
    'keeps the uninhabited %s',
    (code) => {
      expect(normalizeCountryCode(code)).toBe(code)
    },
  )
})

describe('codes', () => {
  it('are uppercase alpha-2, stored and read that way', () => {
    for (const { code } of COUNTRIES) expect(code).toMatch(/^[A-Z]{2}$/)
  })

  // FACEIT's index holds "GB" for a player whose user record says "gb", and
  // that player does not appear in their own country's results.
  it('normalize a lowercase code to the stored form', () => {
    expect(normalizeCountryCode('gb')).toBe('GB')
    expect(normalizeCountryCode('Xk')).toBe('XK')
  })
})

describe('names', () => {
  // Türkiye, Eswatini, North Macedonia and Czechia all rotted hardcoded lists,
  // and shipping packages still disagree today — these come from CLDR.
  it.each([
    ['TR', 'Türkiye'],
    ['SZ', 'Eswatini'],
    ['MK', 'North Macedonia'],
    ['CZ', 'Czechia'],
    ['XK', 'Kosovo'],
  ])('names %s the way CLDR does today', (code, name) => {
    expect(countryName(code)).toBe(name)
  })
})

describe('the marks', () => {
  // Masks are precisely what the OG renderer is fragile about, and <use>
  // outside a sprite draws nothing at all.
  it.each(['<mask', 'clipPath', '<use', 'Gradient'])(
    'contain no %s',
    (construct) => {
      const offenders = Object.entries(COUNTRY_FLAGS)
        .filter(([, art]) => art.body.includes(construct))
        .map(([code]) => code)
      expect(offenders).toEqual([])
    },
  )

  it('are wrapper-free, so the component owns the accessibility attributes', () => {
    for (const [code, art] of Object.entries(COUNTRY_FLAGS)) {
      expect(art.body, code).not.toContain('<svg')
      expect(art.viewBox, code).toMatch(/^[\d.\s]+$/)
    }
  })
})
