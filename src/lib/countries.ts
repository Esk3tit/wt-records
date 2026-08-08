import { COUNTRIES } from '#/lib/countries.generated'

/* ISO 3166-1 alpha-2 plus XK: no home nations, because there is no English
   citizenship, only British. Uppercase everywhere — a mixed-case store is how
   a player drops out of their own country's results. */

export { COUNTRIES }

const NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]))

/** Uppercases first, so a lowercase code is corrected rather than refused. */
export function normalizeCountryCode(value: string): string | null {
  const code = value.toUpperCase()
  return NAMES.has(code) ? code : null
}

export function countryName(code: string): string | null {
  return NAMES.get(code) ?? null
}
