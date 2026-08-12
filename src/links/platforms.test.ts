import { describe, expect, it } from 'vitest'
import {
  DEFERRED_PLATFORMS,
  MAX_NAMED_LINKS,
  PLATFORMS,
  WEBSITE_PLATFORM,
  brandMark,
  isStorablePlatform,
  platform,
  platformOrder,
} from '#/links/platforms'
import { buildLinkUrl, parseHandle } from '#/links/handles'

/* The config is the safety mechanism, so this asserts the mechanism rather
   than the list: every entry complete, and every builder honouring the two
   clauses that delete the open-redirect class. A platform admitted later
   passes these or fails CI. */

/** One handle per platform that its own grammar accepts, so the clause checks
    below run on a validated handle rather than on a literal. */
const SAMPLE: Record<string, string> = {
  youtube: 'PhlyDaily',
  discord: 'wtrecords',
  twitch: 'phlydaily',
  tiktok: 'phlydaily',
  x: 'phlydaily',
  instagram: 'phly.daily',
  bluesky: 'phly.bsky.social',
  telegram: 'phlydaily',
  reddit: 'phlydaily',
}

describe('the platform config', () => {
  it('covers every shippable platform with a sample handle', () => {
    expect(Object.keys(SAMPLE).sort()).toEqual(
      PLATFORMS.map((p) => p.id).sort(),
    )
  })

  it.each(PLATFORMS)('$id has a complete entry', (p) => {
    expect(p.name).not.toBe('')
    expect(p.host).toMatch(/^[a-z0-9.-]+$/)
    expect(p.pasteHosts[0]).toBe(p.host)
    expect(p.pathPrefix.startsWith('/')).toBe(true)
    expect(p.pastePathPrefixes[0]).toBe(p.pathPrefix)
    expect(p.fieldPrefix.endsWith(p.pathPrefix.slice(1))).toBe(true)
    expect(p.pattern.source.startsWith('^')).toBe(true)
    expect(p.pattern.source.endsWith('$')).toBe(true)
    expect(['lower', 'none']).toContain(p.fold)
    expect(typeof p.grammarVerified).toBe('boolean')
    expect(p.plate).toBe('white')
    // A glyph platform carries a brand asset; a wordmark platform must not,
    // because it ships as a wordmark precisely for want of a usable one.
    expect(brandMark(p.id) != null).toBe(p.mark === 'glyph')
  })

  it('gives every platform a distinct id and display position', () => {
    const ids = PLATFORMS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const orders = ids.map(platformOrder)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    // The personal site sits after every named platform, and is not one.
    expect(platformOrder(WEBSITE_PLATFORM)).toBeGreaterThan(Math.max(...orders))
    expect(platform(WEBSITE_PLATFORM)).toBeNull()
    expect(isStorablePlatform(WEBSITE_PLATFORM)).toBe(true)
  })

  it('ships the admissible list minus Kick', () => {
    const shippable = PLATFORMS.map((p) => p.id)
    expect(shippable).not.toContain('kick')
    expect(DEFERRED_PLATFORMS.map((p) => p.id)).toEqual(['kick'])
    // Deferred means recorded as ruled out, not merely absent.
    expect(DEFERRED_PLATFORMS[0].reason).toMatch(/40px/)
    for (const deferred of DEFERRED_PLATFORMS) {
      expect(shippable).not.toContain(deferred.id)
      expect(isStorablePlatform(deferred.id)).toBe(false)
    }
  })

  it('refuses a platform nobody configured', () => {
    expect(platform('steam')).toBeNull()
    expect(isStorablePlatform('steam')).toBe(false)
    expect(isStorablePlatform('mastodon')).toBe(false)
  })
})

/* Clauses 1 and 2, asserted per platform because the guarantee is per
   platform: one host, no query, and a path the handle cannot escape. */
describe.each(PLATFORMS)('$name builds', (p) => {
  const built = () =>
    new URL(buildLinkUrl(p, parseHandle(p, SAMPLE[p.id]).handle))

  it('a query-free URL', () => {
    expect(built().search).toBe('')
    expect(built().hash).toBe('')
  })

  it('on a single fixed host, over https', () => {
    expect(built().hostname).toBe(p.host)
    expect(built().protocol).toBe('https:')
    expect(built().username).toBe('')
    expect(built().port).toBe('')
  })

  it('under the path the config names', () => {
    expect(built().pathname.startsWith(p.pathPrefix)).toBe(true)
  })

  // The measured redirectors all carry their payload in the query; a handle
  // that cannot contain one is what makes the class unreachable.
  it('from a grammar that admits no URL punctuation', () => {
    for (const hostile of ['?q=https://evil.com', '/../evil', '#x', '@evil']) {
      expect(p.pattern.test(SAMPLE[p.id] + hostile)).toBe(false)
    }
  })
})

describe('the cap', () => {
  it('sits above what Twitch measures its own creators using', () => {
    expect(MAX_NAMED_LINKS).toBe(5)
    expect(MAX_NAMED_LINKS).toBeLessThan(PLATFORMS.length)
  })
})
