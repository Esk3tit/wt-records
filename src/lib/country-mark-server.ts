import { COUNTRY_FLAGS } from '#/lib/country-flags.generated'
import { countryName } from '#/lib/countries'

/* Import from a server-fn handler, never a component: this pulls all 250 marks
   in, and the client only ever needs the one the Player set. */

// A Map, so a lookup miss is typed as one.
const MARKS = new Map(Object.entries(COUNTRY_FLAGS))

export interface CountryMark {
  code: string
  name: string
  viewBox: string
  /** The flag's drawing instructions, without the <svg> wrapper. */
  body: string
}

/** Null for no country, and for a code the list no longer offers. */
export function resolveCountryMark(code: string | null): CountryMark | null {
  if (!code) return null
  const name = countryName(code)
  const art = MARKS.get(code)
  if (!name || !art) return null
  return { code, name, viewBox: art.viewBox, body: art.body }
}
