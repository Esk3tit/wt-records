import { describe, expect, it } from 'vitest'
import { linkAccessibleName, renderLink, renderLinks } from '#/links/render'
import { PLATFORMS, platformOrder } from '#/links/platforms'

/* What a stored row becomes on screen, resolved before it reaches a component.
   The list is open by design, so a row can outlive the config entry that
   explained it — and the one thing this must never do is turn such a row into
   a link to a host nobody configures any more. */

const row = (platform: string, handle: string) => ({ platform, handle })

describe('a stored row becomes a link', () => {
  it('carries the platform, the handle and the constructed URL', () => {
    expect(renderLink(row('youtube', 'PhlyDaily'))).toMatchObject({
      platform: 'youtube',
      name: 'YouTube',
      display: '@PhlyDaily',
      url: 'https://www.youtube.com/@PhlyDaily',
    })
  })

  it('wears the sigil the config gives it, not a hardcoded one', () => {
    expect(renderLink(row('reddit', 'phlydaily'))!.display).toBe('u/phlydaily')
    // The one identifier that is not a name, so it carries its host instead.
    expect(renderLink(row('discord', 'wtrecords'))!.display).toBe(
      'discord.gg/wtrecords',
    )
  })

  it('shows the personal site as its address, with the scheme dropped', () => {
    expect(
      renderLink(row('website', 'https://phlydaily.example/shop')),
    ).toMatchObject({
      display: 'phlydaily.example/shop',
      url: 'https://phlydaily.example/shop',
    })
  })

  it('gives a glyph platform its mark and a wordmark platform its word', () => {
    const yt = renderLink(row('youtube', 'PhlyDaily'))!
    expect(yt.mark?.path.length).toBeGreaterThan(0)
    expect(yt.wordmark).toBeNull()

    const tiktok = renderLink(row('tiktok', 'phlydaily'))!
    expect(tiktok.mark).toBeNull()
    expect(tiktok.wordmark).toBe('TikTok')
  })

  /* The list is open, so a platform can leave it. A row for one nobody
     configures any more must render as nothing at all — never as a link built
     from a host the config no longer names. */
  it('renders nothing for a platform the config no longer names', () => {
    expect(renderLink(row('kick', 'phlydaily'))).toBeNull()
    expect(renderLink(row('myspace', 'phlydaily'))).toBeNull()
    // Nor for a key an object literal would answer for by inheritance.
    expect(renderLink(row('constructor', 'phlydaily'))).toBeNull()
    expect(
      renderLinks([row('kick', 'x'), row('youtube', 'PhlyDaily')]),
    ).toHaveLength(1)
  })
})

describe('the order the rail scans in', () => {
  it('is the config’s, whatever order the rows arrive in', () => {
    const shuffled = [
      row('website', 'https://phlydaily.example'),
      row('reddit', 'phlydaily'),
      row('youtube', 'PhlyDaily'),
      row('discord', 'wtrecords'),
    ]
    expect(renderLinks(shuffled).map((l) => l.platform)).toEqual([
      'youtube',
      'discord',
      'reddit',
      'website',
    ])
  })

  // Fixed from the config: no position column, no drag affordance, and every
  // profile on the site scans identically.
  it('puts every named platform ahead of the personal site', () => {
    const all = [...PLATFORMS.map((p) => row(p.id, 'phlydaily1'))]
    all.push(row('website', 'https://phlydaily.example'))
    const rendered = renderLinks(all).map((l) => l.platform)
    expect(rendered[rendered.length - 1]).toBe('website')
    expect(rendered.map(platformOrder)).toEqual(
      [...rendered.map(platformOrder)].sort((a, b) => a - b),
    )
  })
})

describe('what a screen reader is given', () => {
  it('names the platform and the handle, and that the link leaves the page', () => {
    expect(linkAccessibleName(renderLink(row('youtube', 'PhlyDaily'))!)).toBe(
      'YouTube: @PhlyDaily (opens in a new tab)',
    )
  })

  /* A row of glyphs says which platforms; only the handle says whose. The mark
     is decorative, so if the name did not carry the handle nothing would. */
  it('never leaves the handle out, for any platform', () => {
    for (const p of PLATFORMS) {
      const link = renderLink(row(p.id, 'phlydaily1'))!
      const name = linkAccessibleName(link)
      expect(name).toContain(p.name)
      expect(name).toContain('phlydaily1')
    }
  })
})
