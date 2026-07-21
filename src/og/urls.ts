import { absoluteUrl } from '#/lib/canonical'

/* Share-card image URLs. The `?v=` version bust is what makes a Supersede show
   a fresh unfurl: Discord caches by URL, so a changed content version → new URL
   → re-scrape on next paste, while old messages keep their historical card. The
   OG route itself ignores `v`; only the value's change matters. */

function withParams(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const qs = q.toString()
  return absoluteUrl(qs ? `${path}?${qs}` : path)
}

export function vehicleCardPath(mode: string, slug: string): string {
  return `/og/${mode}/vehicle/${encodeURIComponent(slug)}.png`
}

export function nationCardPath(mode: string, slug: string): string {
  return `/og/${mode}/nation/${encodeURIComponent(slug)}.png`
}

export function playerCardPath(slug: string): string {
  return `/og/player/${encodeURIComponent(slug)}.png`
}

export function vehicleCardUrl(
  mode: string,
  slug: string,
  version?: string,
): string {
  return withParams(vehicleCardPath(mode, slug), { v: version })
}

export function nationCardUrl(
  mode: string,
  slug: string,
  version?: string,
): string {
  return withParams(nationCardPath(mode, slug), { v: version })
}

export function playerCardUrl(
  slug: string,
  opts: { version?: string; from?: string } = {},
): string {
  return withParams(playerCardPath(slug), { v: opts.version, from: opts.from })
}
