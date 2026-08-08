import { COUNTRIES } from '#/lib/countries.generated'

/* A Country is a citizenship a claimed Player states, distinct from a Nation
   (the in-game tree). The list is ISO 3166-1 alpha-2 plus XK — home nations
   are not on it, because there is no English or Scottish citizenship, only
   British. Codes are uppercase everywhere: a mixed-case store is how a player
   drops out of their own country's results. */

export { COUNTRIES }

const NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]))

/** Uppercases first, so a lowercase code from an old client is still readable
    rather than silently unselectable. Anything off the list is refused. */
export function normalizeCountryCode(value: string): string | null {
  const code = value.toUpperCase()
  return NAMES.has(code) ? code : null
}

export function countryName(code: string): string | null {
  return NAMES.get(code) ?? null
}
