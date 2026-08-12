import { describe, expect, it } from 'vitest'
import { buildLinkUrl, parseHandle } from '#/links/handles'
import { platform } from '#/links/platforms'

function p(id: string) {
  const found = platform(id)
  if (!found) throw new Error(`no such platform ${id}`)
  return found
}

const stored = (id: string, raw: string) => parseHandle(p(id), raw)
const url = (id: string, raw: string) =>
  buildLinkUrl(p(id), parseHandle(p(id), raw).handle)

describe('a typed handle', () => {
  it('is stored bare, whether or not it wore its sigil', () => {
    expect(stored('youtube', 'PhlyDaily').handle).toBe('PhlyDaily')
    expect(stored('youtube', '@PhlyDaily').handle).toBe('PhlyDaily')
    expect(stored('youtube', '  @PhlyDaily  ').handle).toBe('PhlyDaily')
  })

  it('keeps the case it was typed in, and folds separately for the index', () => {
    const it_ = stored('youtube', 'PhlyDaily')
    expect(it_.handle).toBe('PhlyDaily')
    expect(it_.normalized).toBe('phlydaily')
  })

  // A Discord invite code is case-sensitive: folding it would collide two
  // genuinely different servers.
  it('is not folded where the platform is case-sensitive', () => {
    expect(stored('discord', 'aBcDeF').normalized).toBe('aBcDeF')
  })

  /* A Bluesky handle is a domain, so its grammar is written lower-case — and
     someone typing their own handle in caps must not be told it is not one.
     The grammar describes the folded form. */
  it('is accepted in whatever case it was typed, where the platform folds', () => {
    expect(stored('bluesky', 'Phly.Bsky.Social')).toEqual({
      handle: 'Phly.Bsky.Social',
      normalized: 'phly.bsky.social',
    })
    expect(
      stored('bluesky', 'https://bsky.app/profile/Phly.Bsky.Social').handle,
    ).toBe('Phly.Bsky.Social')
  })

  it('is refused when it does not fit the platform grammar', () => {
    expect(() => stored('x', 'sixteen_chars_xx')).toThrow(
      /not a valid handle for X/,
    )
    expect(() => stored('telegram', '1starts_with_digit')).toThrow()
    expect(() => stored('youtube', 'ab')).toThrow()
    expect(() => stored('bluesky', 'notadomain')).toThrow()
    expect(() => stored('reddit', 'sp ace')).toThrow()
  })

  it('is refused without echoing what was typed back into the message', () => {
    expect(() => stored('x', '<script>alert(1)</script>')).toThrow(
      'That is not a valid handle for X — check it and try again.',
    )
  })

  it('is refused when it is empty', () => {
    expect(() => stored('twitch', '   ')).toThrow(/Enter your Twitch handle/)
  })
})

describe('a pasted URL', () => {
  it('is normalised to a handle and echoed back as stored', () => {
    expect(stored('youtube', 'https://www.youtube.com/@PhlyDaily').handle).toBe(
      'PhlyDaily',
    )
    expect(stored('twitch', 'https://twitch.tv/phlydaily').handle).toBe(
      'phlydaily',
    )
    expect(
      stored('reddit', 'https://www.reddit.com/user/phlydaily').handle,
    ).toBe('phlydaily')
    expect(
      stored('bluesky', 'https://bsky.app/profile/phly.bsky.social').handle,
    ).toBe('phly.bsky.social')
  })

  it('is accepted with the scheme a paste often loses', () => {
    expect(stored('youtube', 'youtube.com/@PhlyDaily').handle).toBe('PhlyDaily')
    expect(stored('x', 'x.com/phlydaily').handle).toBe('phlydaily')
  })

  it('is accepted on the platform’s other own hosts and path shapes', () => {
    expect(stored('x', 'https://twitter.com/phlydaily').handle).toBe(
      'phlydaily',
    )
    expect(stored('reddit', 'https://old.reddit.com/u/phlydaily').handle).toBe(
      'phlydaily',
    )
    expect(
      stored('discord', 'https://discord.com/invite/wtrecords').handle,
    ).toBe('wtrecords')
  })

  it('loses its query and fragment, because nothing built from a handle carries one', () => {
    expect(url('twitch', 'https://twitch.tv/phlydaily?referrer=x#live')).toBe(
      'https://www.twitch.tv/phlydaily',
    )
  })

  it('lands on the canonical host, whatever host it arrived on', () => {
    expect(url('x', 'https://twitter.com/phlydaily')).toBe(
      'https://x.com/phlydaily',
    )
    expect(url('youtube', 'https://m.youtube.com/@PhlyDaily')).toBe(
      'https://www.youtube.com/@PhlyDaily',
    )
  })

  /* The three measured open redirectors, offered as a paste. Each falls
     through extraction — the path is not one the platform builds — and is then
     read as a bare handle, which the grammar refuses. */
  it('is refused when it is one of the measured redirectors', () => {
    expect(() =>
      stored('youtube', 'https://youtube.com/redirect?q=https://evil.example'),
    ).toThrow()
    expect(() =>
      stored(
        'tiktok',
        'https://www.tiktok.com/link/v2?target=https://evil.example',
      ),
    ).toThrow()
  })

  it('is refused when it points at another site entirely', () => {
    expect(() => stored('youtube', 'https://evil.example/@PhlyDaily')).toThrow()
    expect(() =>
      stored('twitch', 'https://twitch.tv.evil.example/phly'),
    ).toThrow()
  })

  it('is refused when the scheme is not one a browser would open', () => {
    expect(() => stored('x', 'javascript:alert(1)')).toThrow()
    expect(() =>
      stored('x', 'data:text/html,<script>alert(1)</script>'),
    ).toThrow()
  })
})

describe('the constructed URL', () => {
  it('is what a visitor is sent to, per platform', () => {
    expect(url('youtube', 'PhlyDaily')).toBe(
      'https://www.youtube.com/@PhlyDaily',
    )
    expect(url('discord', 'wtrecords')).toBe('https://discord.gg/wtrecords')
    expect(url('twitch', 'phlydaily')).toBe('https://www.twitch.tv/phlydaily')
    expect(url('tiktok', 'phlydaily')).toBe('https://www.tiktok.com/@phlydaily')
    expect(url('x', 'phlydaily')).toBe('https://x.com/phlydaily')
    expect(url('instagram', 'phly.daily')).toBe(
      'https://www.instagram.com/phly.daily',
    )
    expect(url('bluesky', 'phly.bsky.social')).toBe(
      'https://bsky.app/profile/phly.bsky.social',
    )
    expect(url('telegram', 'phlydaily')).toBe('https://t.me/phlydaily')
    expect(url('reddit', 'phlydaily')).toBe(
      'https://www.reddit.com/user/phlydaily',
    )
  })
})
