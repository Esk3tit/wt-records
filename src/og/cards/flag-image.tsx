import { renderToStaticMarkup } from 'react-dom/server'
import { FLAGS, FLAG_VIEWBOX } from '#/components/nation-flag'
import { COUNTRY_FLAGS } from '#/lib/country-flags.generated'

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

// A Map, so a lookup miss is typed as one.
const COUNTRY_MARKS = new Map(Object.entries(COUNTRY_FLAGS))
const countryCache = new Map<string, string | null>()

/** The same seam for a Player's own country mark: already serialized by
    `countries:generate`, so the renderer never issues a fetch for it. */
export function countryFlagDataUri(code: string): string | null {
  const cached = countryCache.get(code)
  if (cached !== undefined) return cached
  const art = COUNTRY_MARKS.get(code)
  if (!art) {
    countryCache.set(code, null)
    return null
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}">${art.body}</svg>`
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  countryCache.set(code, uri)
  return uri
}
