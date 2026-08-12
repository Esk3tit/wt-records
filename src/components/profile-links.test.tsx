import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ProfileLinks } from './profile-links'
import { renderLinks } from '#/links/render'

const rail = (rows: Array<{ platform: string; handle: string }>) =>
  render(<ProfileLinks links={renderLinks(rows)} />).container

const one = (platform: string, handle: string) =>
  rail([{ platform, handle }]).querySelector('a')!

describe('the outbound markup', () => {
  const anchor = () => one('youtube', 'PhlyDaily')

  it('carries rel="me ugc nofollow noopener"', () => {
    // noopener written explicitly even though target="_blank" implies it:
    // Steam's in-client CEF browser and Discord's webview lag desktop Chrome.
    expect(anchor().getAttribute('rel')).toBe('me ugc nofollow noopener')
  })

  it('passes the creator their attribution, without naming the page', () => {
    // The repo's noreferrer default would strip it, which is the whole social
    // contract here; `origin` sends the site and not the player.
    expect(anchor().getAttribute('referrerpolicy')).toBe('origin')
    expect(anchor().getAttribute('rel')).not.toMatch(/noreferrer/)
  })

  it('opens in a new tab, with an affordance that says so', () => {
    expect(anchor().getAttribute('target')).toBe('_blank')
    expect(anchor().querySelector('svg.lucide-arrow-up-right')).not.toBeNull()
  })

  it('sends the visitor to the URL the site constructed', () => {
    expect(anchor().getAttribute('href')).toBe(
      'https://www.youtube.com/@PhlyDaily',
    )
    expect(new URL(anchor().getAttribute('href')!).search).toBe('')
  })
})

describe('what a visitor is shown', () => {
  it('shows the platform mark AND the handle, so they can judge it themselves', () => {
    const anchor = one('twitch', 'PhlyDaily')
    expect(anchor.textContent).toContain('PhlyDaily')
    expect(anchor.firstElementChild!.querySelector('svg path')).not.toBeNull()
  })

  it('names the platform and the handle to a screen reader, not the glyph', () => {
    expect(one('youtube', 'PhlyDaily').getAttribute('aria-label')).toBe(
      'YouTube: @PhlyDaily (opens in a new tab)',
    )
    expect(one('discord', 'wtrecords').getAttribute('aria-label')).toBe(
      'Discord: wtrecords (opens in a new tab)',
    )
  })

  it('hides the mark itself from assistive tech', () => {
    const svg = one('youtube', 'PhlyDaily').querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
  })

  // The plate colour becomes part of the mark for the knockout platforms, so
  // white is load-bearing rather than decorative — and opaque, because our
  // signature frost violates three separate guidelines as a backdrop.
  it('puts every mark on an opaque white plate', () => {
    for (const [platform, handle] of [
      ['youtube', 'PhlyDaily'],
      ['tiktok', 'phlydaily'],
      ['website', 'https://phlydaily.example'],
    ] as const) {
      const plate = one(platform, handle).firstElementChild!
      expect(plate.className).toContain('bg-white')
      expect(plate.className).not.toMatch(/bg-white\/\d/)
    }
  })

  // TikTok's logo is forbidden outright without written permission.
  it('draws TikTok as a wordmark and never as its logo', () => {
    const plate = one('tiktok', 'phlydaily').firstElementChild!
    expect(plate.querySelector('svg')).toBeNull()
    expect(plate.textContent).toBe('TikTok')
  })

  it('renders every link in the config’s fixed order, whatever order they arrive in', () => {
    const container = rail([
      { platform: 'website', handle: 'https://phlydaily.example' },
      { platform: 'twitch', handle: 'phlydaily' },
      { platform: 'youtube', handle: 'PhlyDaily' },
    ])
    expect(
      [...container.querySelectorAll('a')].map(
        (a) => a.getAttribute('aria-label')!.split(':')[0],
      ),
    ).toEqual(['YouTube', 'Twitch', 'Personal site'])
  })

  it('shows the personal site as its address, without the scheme', () => {
    const anchor = one('website', 'https://phlydaily.example/links')
    expect(anchor.textContent).toContain('phlydaily.example/links')
    expect(anchor.getAttribute('href')).toBe('https://phlydaily.example/links')
  })

  it('renders nothing at all when a Player has no links', () => {
    expect(rail([]).querySelector('a')).toBeNull()
    expect(rail([]).textContent).toBe('')
  })

  // The list is open, so a platform can leave it — and a stored row for one
  // nobody configures any more must not become a link to an unowned host.
  it('drops a row for a platform the config no longer names', () => {
    expect(
      rail([{ platform: 'kick', handle: 'phlydaily' }]).querySelector('a'),
    ).toBeNull()
  })
})
