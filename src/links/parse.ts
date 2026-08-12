import {
  WEBSITE_PLATFORM,
  isStorablePlatform,
  platform,
} from '#/links/platforms'
import { buildLinkUrl, parseHandle } from '#/links/handles'
import { normalizeWebsite } from '#/links/website'

/* One entry point for "what does this field value mean for this platform",
   shared by the write path and by the field that shows the constructed URL as
   it is typed. Pure — no database, no session — so the owner's own field runs
   the same parser the server will. */

export interface StoredLink {
  platform: string
  /** What is echoed back, in the case it was typed. */
  handle: string
  /** The same value folded by the platform's rule, for the uniqueness index. */
  normalized: string
}

export function parseLinkValue(platformId: string, raw: string): StoredLink {
  if (!isStorablePlatform(platformId)) {
    throw new Error('That platform is not one this site links')
  }
  if (platformId === WEBSITE_PLATFORM) {
    // The one field that stores a URL rather than a handle, and the reason it
    // carries its own rules.
    const url = normalizeWebsite(raw)
    return { platform: WEBSITE_PLATFORM, handle: url, normalized: url }
  }
  const p = platform(platformId)!
  const { handle, normalized } = parseHandle(p, raw)
  return { platform: p.id, handle, normalized }
}

/** The URL this field value would publish, or null while it is not yet one.
    Shown beneath the field as it is typed, so the owner is never guessing what
    a visitor will get — and so a pasted URL looks wrong before it is sent. */
export function previewLinkUrl(platformId: string, raw: string): string | null {
  let stored: StoredLink
  try {
    stored = parseLinkValue(platformId, raw)
  } catch {
    return null
  }
  if (stored.platform === WEBSITE_PLATFORM) return stored.handle
  return buildLinkUrl(platform(stored.platform)!, stored.handle)
}

/** The static text welded to the field. A pasted URL then looks wrong on
    screen before it is ever submitted, which is what makes the extraction
    below it a courtesy rather than a load-bearing parser. */
export function fieldPrefix(platformId: string): string {
  return platformId === WEBSITE_PLATFORM
    ? 'https://'
    : (platform(platformId)?.fieldPrefix ?? '')
}

/** What the field is asking for, in the platform's own words. */
export function platformName(platformId: string): string {
  return platformId === WEBSITE_PLATFORM
    ? 'Personal site'
    : (platform(platformId)?.name ?? platformId)
}
