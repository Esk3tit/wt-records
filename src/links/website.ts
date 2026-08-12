import { PLATFORMS } from '#/links/platforms'

/* The free-text personal site. Every named platform is a handle the site turns
   into a URL it constructed; this is an arbitrary URL to anywhere on the
   internet, published instantly with no review — so these rules are the only
   thing behind it, and they are decided here rather than left to a call site.

   Parsed with WHATWG `URL`, never string-matched. The repo learned that once
   already (`src/admin/api.ts`: a prefix regex admits host-less values like
   `https://?x`), and it cuts the other way too — `javascript:`, `data:` and
   `vbscript:` all parse perfectly well with an empty host, so a host-shaped
   check passes them. The scheme is therefore read off the raw text before
   anything is parsed at all. */

/** Long enough for a real personal URL, short enough that the field is not a
    place to store something else. */
export const MAX_WEBSITE_LENGTH = 200

/** Hosts the named list already covers, as registrable label pairs. A personal
    site pointing at one of these is either impersonation or a slot the Player
    should be using instead. */
const COVERED_HOSTS: ReadonlyArray<ReadonlyArray<string>> = [
  ...new Set(
    PLATFORMS.flatMap((p) => [...p.pasteHosts, p.host]).map((host) =>
      host.split('.').slice(-2).join('.'),
    ),
  ),
].map((host) => host.split('.'))

export function normalizeWebsite(raw: string): string {
  const input = raw.trim()
  if (!input) throw new Error('Enter the address of your site')
  if (input.length > MAX_WEBSITE_LENGTH) {
    throw new Error(`Keep the address to ${MAX_WEBSITE_LENGTH} characters`)
  }
  // A space or a control character in a URL is either an encoding the browser
  // would guess at or an attempt to smuggle one past a later reader.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(input)) {
    throw new Error('An address cannot contain spaces or control characters')
  }

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(input)
  // Read before parsing, and matched on the whole scheme rather than a prefix:
  // this is what refuses javascript:, data:, vbscript: and plain http:.
  if (scheme && scheme[1].toLowerCase() !== 'https') {
    throw new Error('A personal site must be an https:// address')
  }
  const schemed = scheme ? input : `https://${input}`
  if (!/^https:\/\//i.test(schemed)) {
    throw new Error('A personal site must be an https:// address')
  }

  const afterScheme = schemed.slice(schemed.indexOf('//') + 2)
  const typed = afterScheme.split(/[/?#]/)[0]
  // One trailing dot, stripped before anything else looks at the host: it is a
  // valid FQDN that resolves identically and silently defeats any comparison.
  const authority = typed.replace(/\.$/, '')
  if (!authority) throw new Error('That address names no site')

  let url: URL
  try {
    url = new URL(`https://${authority}${afterScheme.slice(typed.length)}`)
  } catch {
    throw new Error('That is not an address a browser could open')
  }
  if (url.protocol !== 'https:') {
    throw new Error('A personal site must be an https:// address')
  }
  // `https://youtube.com@evil.com/x` parses to evil.com but reads as YouTube.
  if (url.username !== '' || url.password !== '') {
    throw new Error('An address cannot carry a username or password')
  }
  if (url.port !== '') throw new Error('An address cannot name a port')
  // Every measured open redirector carries its payload in the query, so the
  // one field that is not built from a handle refuses one outright.
  if (url.search !== '' || url.hash !== '') {
    throw new Error('An address cannot carry a query string or a #fragment')
  }
  // The parser punycodes an internationalised host, so a form that differs
  // from what was typed is a homograph — `уoutube.com` with a Cyrillic у
  // becomes `xn--outube-vrf.com`. This catches the whole class for free.
  if (authority.toLowerCase() !== url.hostname) {
    throw new Error('That address does not name the site it appears to')
  }
  assertRealDomain(url.hostname)
  assertNotCovered(url.hostname)

  // Canonical on store, echoed back exactly as stored: `url.pathname` is
  // already percent-encoded canonically, and a lone "/" says nothing.
  const path = url.pathname === '/' ? '' : url.pathname
  const canonical = `https://${url.hostname}${path}`
  if (canonical.length > MAX_WEBSITE_LENGTH) {
    throw new Error(`Keep the address to ${MAX_WEBSITE_LENGTH} characters`)
  }
  return canonical
}

/** An IP literal or a bare name is not a personal site, and both are ways to
    reach somewhere a reader cannot judge from the text. */
function assertRealDomain(hostname: string): void {
  if (hostname.startsWith('[')) {
    throw new Error('Link a domain, not an address')
  }
  const labels = hostname.split('.')
  if (labels.length < 2 || labels.some((label) => label === '')) {
    throw new Error('Link a domain, not an address')
  }
  if (labels.every((label) => /^\d+$/.test(label))) {
    throw new Error('Link a domain, not an address')
  }
}

/** A personal site may not name a platform the list already covers, wherever
    in the host it appears: `youtube.com.evil.com` is the shape that defeats an
    `endsWith` check, and it reads as YouTube to everyone but a parser. The cost
    is a domain that legitimately contains one of these pairs — `x.com.br` — and
    it is worth paying on the one field nobody reviews. */
function assertNotCovered(hostname: string): void {
  const labels = hostname.split('.')
  const covered = COVERED_HOSTS.some((host) =>
    labels.some((_, i) => host.every((label, j) => labels[i + j] === label)),
  )
  if (covered) {
    throw new Error('That platform has its own slot — use it instead')
  }
}
