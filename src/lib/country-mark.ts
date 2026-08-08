import { COUNTRY_FLAGS } from '#/lib/country-flags.generated'
import { countryName } from '#/lib/countries'

/* Server-only — import this from a server-fn handler, never from a component:
   it pulls all 250 marks in, and the client only ever needs the one the Player
   actually set. Loaders hand the resolved mark down instead. */

// A Map, so a lookup miss is typed as one — an index signature would claim
// every one of the 250 codes is present.
const MARKS = new Map(Object.entries(COUNTRY_FLAGS))

export interface CountryMark {
  code: string
  name: string
  viewBox: string
  /** The flag's drawing instructions, without the <svg> wrapper. */
  flag: string
}

/** Everything the profile needs to render a stored country code, or null —
    for no country, and for a code the list no longer offers. */
export function resolveCountryMark(code: string | null): CountryMark | null {
  if (!code) return null
  const name = countryName(code)
  const art = MARKS.get(code)
  if (!name || !art) return null
  return { code, name, viewBox: art.viewBox, flag: art.body }
}
