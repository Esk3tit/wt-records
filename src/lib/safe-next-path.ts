/** A post-login redirect target is safe only if it's a same-origin absolute
    path: a single leading slash, no scheme, no protocol-relative "//" or "/\"
    that a browser would resolve to another host. Anything else → the fallback. */
export function safeNextPath(value: unknown, fallback = '/admin'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
