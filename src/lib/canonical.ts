// The origin every absolute URL is built from — never the request host, since
// the wtrecords.gg DNS cutover is pending. Override with VITE_CANONICAL_ORIGIN.
const DEFAULT_ORIGIN = 'https://wtrecords.gg'

export const CANONICAL_ORIGIN: string =
  (import.meta.env.VITE_CANONICAL_ORIGIN as string | undefined)?.replace(
    /\/+$/,
    '',
  ) || DEFAULT_ORIGIN

export function absoluteUrl(path: string): string {
  return `${CANONICAL_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
