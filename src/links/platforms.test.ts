import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMarks } from '../../scripts/generate-brand-marks'
import { BRAND_MARKS } from '#/links/brand-marks.generated'
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

/* The marks ship inlined, so nothing at runtime would notice simple-icons
   changing a path or a brand colour under them. Steam, start.gg and FACEIT each
   shipped a list that outran its assets; this fails the build instead. */
describe('the brand marks', () => {
  it('have not drifted from the generator', () => {
    expect(BRAND_MARKS).toEqual(
      Object.fromEntries(
        buildMarks().map(({ id, title, hex, path }) => [
          id,
          { title, hex, path },
        ]),
      ),
    )
  })

  it('fill every glyph with an official form of the mark', () => {
    for (const mark of Object.values(BRAND_MARKS)) {
      expect(mark?.hex).toMatch(/^#[0-9a-f]{6}$/i)
      expect(mark?.path.length).toBeGreaterThan(0)
    }
  })

  /* The map is partial, so an id nobody configured reads as undefined rather
     than as a typed entry — and an inherited Object.prototype key is not an
     entry at all. `brandMark('constructor')` returning `Object` would render
     a <path> with no `d`. */
  it('answer for an id nobody configured, inherited keys included', () => {
    expect(brandMark('kick')).toBeNull()
    expect(brandMark('constructor')).toBeNull()
    expect(brandMark('toString')).toBeNull()
  })
})

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
    // The whole welded prefix, host included. `endsWith(pathPrefix.slice(1))`
    // is `endsWith('')` for every platform whose path is '/', so it passed for
    // a fieldPrefix naming any host at all — and this field is what makes a
    // pasted URL look wrong before it is submitted.
    expect(p.fieldPrefix).toBe(p.host.replace(/^www\./, '') + p.pathPrefix)
    expect(p.pattern.source.startsWith('^')).toBe(true)
    expect(p.pattern.source.endsWith('$')).toBe(true)
    expect(['lower', 'none']).toContain(p.fold)
    expect(p.kind).toBe('handle')
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

  /* Where a platform does not publish its grammar, the config says so rather
     than a regex being guessed into it — and the entry is then narrower than
     the platform accepts, so a legitimate handle is a bug report rather than a
     hole. Named here, so admitting a platform on a guess fails CI. */
  it('names exactly the platforms whose grammar could not be read', () => {
    expect(
      PLATFORMS.filter((p) => !p.grammarVerified).map((p) => p.id),
    ).toEqual(['twitch', 'tiktok'])
  })

  /* `plink_handle_uq` carves the personal site out by literal, in a migration
     that has already been applied — so this constant is not free to change.
     Read from the committed SQL rather than restated, or the pin is just a
     second copy of the same string. */
  it('names the personal site exactly as the applied migration does', () => {
    // Read from the repo root: the unit project rewrites import.meta.url to a
    // scheme node:fs will not open.
    const migration = readFileSync('drizzle/0018_player_links.sql', 'utf8')
    expect(WEBSITE_PLATFORM).toBe('website')
    expect(migration).toContain(`<> '${WEBSITE_PLATFORM}'`)
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

  /* Clause 1 is not "the string we concatenated" — it is what a browser
     resolves. `.` and `..` are path segments the URL parser REMOVES, so a
     grammar admitting either publishes a link to the platform's homepage (or
     above it) under somebody's asserted handle. Asserted for every platform,
     because it is the config that decides: a prefix of `/` plus a grammar with
     dots is all it takes to reopen this. */
  it('a URL a browser still resolves to the handle it names', () => {
    const survives = (handle: string) =>
      new URL(buildLinkUrl(p, handle)).pathname.includes(handle)
    expect(survives(SAMPLE[p.id])).toBe(true)
    for (const dots of ['.', '..', '...', '.a', 'a.', 'a..b']) {
      if (p.pattern.test(dots)) expect(survives(dots)).toBe(true)
    }
  })
})

describe('the cap', () => {
  it('sits above what Twitch measures its own creators using', () => {
    expect(MAX_NAMED_LINKS).toBe(5)
    expect(MAX_NAMED_LINKS).toBeLessThan(PLATFORMS.length)
  })
})
