import type { Platform } from '#/links/platforms'
import { MAX_LINK_INPUT } from '#/claims/limits'

/* Handles in, URLs out. Storing a bare handle and constructing the URL
   server-side is not a preference: with no human in the loop it is the only
   safety mechanism the feature has, and it removes the open-redirect class
   rather than defending against it. OWASP names this exact shape — "have the
   user provide short name, ID or token which is mapped server-side to a full
   target URL" — as the highest degree of protection.

   Extraction is therefore a courtesy, not a load-bearing parser: the field
   welds the constructed prefix to it, so a pasted URL looks wrong on screen
   before it is ever submitted. Whatever extraction returns goes through the
   platform's grammar exactly as a typed handle does. */

/** What is stored: the handle as it will be echoed back, and the folded form
    the cross-Player uniqueness index is built on. */
export interface StoredHandle {
  handle: string
  normalized: string
}

export function buildLinkUrl(p: Platform, handle: string): string {
  return `https://${p.host}${p.pathPrefix}${handle}`
}

/** The handle a raw field value names, or a thrown refusal. Accepts a bare
    handle, a handle wearing its sigil, or a pasted URL. */
export function parseHandle(p: Platform, raw: string): StoredHandle {
  const input = raw.trim()
  if (!input) throw new Error(`Enter your ${p.name} handle`)
  if (input.length > MAX_LINK_INPUT) throw new Error(refusal(p))
  const handle = extractFromUrl(p, input) ?? input.replace(/^@/, '')
  // The grammar describes the folded form, so a platform whose handles are
  // canonically lower-case does not refuse the same handle typed in caps. What
  // is STORED is the original, so it has to be checked too: `U+212A` (the
  // Kelvin sign) lower-cases to a plain `k`, which would pass the grammar and
  // then be stored as a K-lookalike — squatting the real handle's slot on the
  // uniqueness index while rendering as somebody else's name. Every grammar
  // here is ASCII, so requiring the stored form to be ASCII costs nothing and
  // closes the whole fold-collision class.
  const normalized = fold(p, handle)
  if (!ASCII.test(handle) || !p.pattern.test(normalized)) {
    throw new Error(refusal(p))
  }
  return { handle, normalized }
}

const ASCII = /^[\x20-\x7e]+$/

export function fold(p: Platform, handle: string): string {
  return p.fold === 'lower' ? handle.toLowerCase() : handle
}

/** Names the grammar rather than the input: echoing back what someone typed is
    how a refusal message becomes a reflected-content surface. */
function refusal(p: Platform): string {
  return `That is not a valid handle for ${p.name} — check it and try again.`
}

/** The handle inside a pasted URL, or null when the input is not one this
    platform would have produced. Null is not a refusal: the caller falls back
    to reading the input as a bare handle, and the grammar decides. */
function extractFromUrl(p: Platform, input: string): string | null {
  const url = asUrl(p, input)
  if (!url) return null
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!p.pasteHosts.includes(url.hostname.toLowerCase())) return null
  // Longest prefix first, or "/user/foo" matches Reddit's bare "/" — which is
  // not a prefix Reddit has, but the same shape bites any platform that grows
  // one. The query and fragment are simply dropped: nothing built from a
  // handle can carry them, which is the whole of clause 1.
  for (const prefix of [...p.pastePathPrefixes].sort(
    (a, b) => b.length - a.length,
  )) {
    if (!url.pathname.startsWith(prefix)) continue
    // A profile URL is the prefix and EXACTLY ONE segment. Anything deeper is
    // one of the platform's own routes, and reading its first segment as a
    // handle is how `discord.com/channels/1/2` becomes `discord.gg/channels`
    // and `instagram.com/p/ABC` becomes a link to `/p`. Stated as a shape
    // rather than a list of reserved words, which would rot the first time a
    // platform added a route — and it refuses deep links for free, which the
    // spec wants anyway.
    const rest = url.pathname.slice(prefix.length).replace(/\/$/, '')
    if (rest === '' || rest.includes('/')) continue
    const decoded = decodeSegment(rest)
    if (decoded) return decoded.replace(/^@/, '')
  }
  return null
}

/** A URL if the input is one, including the scheme-less `youtube.com/@ace`
    shape a paste often loses its scheme to. */
function asUrl(p: Platform, input: string): URL | null {
  const schemed = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(input)
  const hostish =
    !schemed &&
    p.pasteHosts.some(
      (host) =>
        input.toLowerCase().startsWith(`${host}/`) ||
        input.toLowerCase() === host,
    )
  if (!schemed && !hostish) return null
  try {
    return new URL(schemed ? input : `https://${input}`)
  } catch {
    return null
  }
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment) || null
  } catch {
    return null
  }
}
