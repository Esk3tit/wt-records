/** A post-login redirect target is safe only if it's a same-origin absolute
    path: a single leading slash, no scheme, no protocol-relative "//" or "/\"
    that a browser would resolve to another host. Anything else → the fallback. */
export function safeNextPath(value: unknown, fallback = '/admin'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Reject control characters (CR/LF included): this value lands in a Set-Cookie
  // and then a Location header, so a raw newline would be response-splitting.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return fallback
  }
  return value
}
