import { renderToStaticMarkup } from 'react-dom/server'
import { FLAGS, FLAG_VIEWBOX } from '#/components/nation-flag'
import type { CountryMark } from '#/lib/country-mark-server'

// The renderer doesn't flatten a React fragment nested in inline SVG, and the
// vendored flags are fragments, so one dropped into a card renders blank.
// Serialize each once to a standalone SVG data-URI for the card to draw.
// Memoized: same bytes every render (goldens depend on it).
const cache = new Map<string, string | null>()

export function flagDataUri(slug: string): string | null {
  const cached = cache.get(slug)
  if (cached !== undefined) return cached
  const flag = FLAGS[slug]
  if (!flag) {
    cache.set(slug, null)
    return null
  }
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={FLAG_VIEWBOX}>
      {flag}
    </svg>,
  )
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  cache.set(slug, uri)
  return uri
}

const countryCache = new Map<string, string>()

/** The same seam for a Player's own country mark. Takes the resolved mark
    rather than the code: whoever has one has already paid for the lookup, and
    the bytes `countries:generate` emitted mean no fetch here either. */
export function countryFlagDataUri(mark: CountryMark): string {
  const cached = countryCache.get(mark.code)
  if (cached !== undefined) return cached
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}">${mark.body}</svg>`
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  countryCache.set(mark.code, uri)
  return uri
}
