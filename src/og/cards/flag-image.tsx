import { renderToStaticMarkup } from 'react-dom/server'
import { FLAGS, FLAG_VIEWBOX } from '#/components/nation-flag'

/* The renderer doesn't flatten a React fragment nested inside inline <svg>, and
   the vendored flags are fragments — so a flag dropped straight into a card
   renders blank. Serialize each once to a standalone SVG data-URI and hand the
   card an <img> it renders reliably. Memoized: same bytes every render (goldens
   depend on it). */
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
