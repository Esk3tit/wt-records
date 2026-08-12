import {
  WEBSITE_PLATFORM,
  brandMark,
  platform,
  platformOrder,
  slot,
} from '#/links/platforms'
import { buildLinkUrl } from '#/links/handles'

/* What a stored row becomes on screen. Resolved server-side, so a platform the
   config has since dropped renders as nothing at all rather than as a link to
   a host nobody configured any more. */

export interface RenderedLink {
  platform: string
  /** The platform's own name, for the accessible name. A glyph is not a
      message: a row of marks says which platforms, only the handle says whose. */
  name: string
  /** The link's visible text — the anti-impersonation signal, and the reason
      hover is not a mitigation on a phone. */
  display: string
  url: string
  mark: { title: string; hex: string; path: string } | null
  /** Set for a platform that ships as a wordmark, which takes a pill sized to
      itself rather than the square glyph plate. */
  wordmark: string | null
}

export function renderLink(row: {
  platform: string
  handle: string
}): RenderedLink | null {
  if (row.platform === WEBSITE_PLATFORM) {
    // The stored value IS the canonical URL; the scheme is noise to read.
    return {
      platform: WEBSITE_PLATFORM,
      name: slot(WEBSITE_PLATFORM)!.name,
      display: row.handle.replace(/^https:\/\//, ''),
      url: row.handle,
      mark: null,
      wordmark: null,
    }
  }
  const p = platform(row.platform)
  if (!p) return null
  return {
    platform: p.id,
    name: p.name,
    display: `${p.sigil}${row.handle}`,
    url: buildLinkUrl(p, row.handle),
    mark: p.mark === 'glyph' ? brandMark(p.id) : null,
    wordmark: p.mark === 'wordmark' ? p.name : null,
  }
}

/** Every renderable link, in the fixed order the config defines. No position
    column and no drag affordance: every profile on the site scans identically. */
export function renderLinks(
  rows: ReadonlyArray<{ platform: string; handle: string }>,
): RenderedLink[] {
  return rows
    .map(renderLink)
    .filter((link): link is RenderedLink => link != null)
    .sort((a, b) => platformOrder(a.platform) - platformOrder(b.platform))
}

/** What a screen reader is given: the platform and the handle, never the
    glyph — and that the link leaves the page, which the arrow only says to
    someone who can see it. */
export function linkAccessibleName(link: RenderedLink): string {
  return `${link.name}: ${link.display} (opens in a new tab)`
}
