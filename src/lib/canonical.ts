// The public origin every absolute URL (canonical links, share-card images) is
// built from — never the request host. The wtrecords.gg DNS cutover is pending,
// so cards must not bake in the Railway host; override with VITE_CANONICAL_ORIGIN
// before then. Trailing slash trimmed so `${origin}${path}` never doubles it.
const DEFAULT_ORIGIN = 'https://wtrecords.gg'

export const CANONICAL_ORIGIN: string =
  (import.meta.env.VITE_CANONICAL_ORIGIN as string | undefined)?.replace(
    /\/+$/,
    '',
  ) || DEFAULT_ORIGIN

export function absoluteUrl(path: string): string {
  return `${CANONICAL_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
