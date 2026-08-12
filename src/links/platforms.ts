import { BRAND_MARKS } from '#/links/brand-marks.generated'

/* The list of platforms a claimed Player may link, and everything the site
   knows about each one: the handle grammar, the canonical-URL template, the
   display order, the brand asset and the plate colour. One source of truth per
   platform — admitting one is an edit to this file, not a migration.

   A platform earns a slot when three clauses hold:
     1. the site can construct a query-free canonical URL for it,
     2. from a validated handle on a single fixed host,
     3. and the identifier stored still names the same person tomorrow.

   Nothing else is a bar. Clauses 1 and 2 are what delete the open-redirect
   class by construction: every measured redirector carries its payload in the
   query, and a URL built from a handle cannot express one. Links publish with
   no human in the loop, so this file and its validators are the whole safety
   mechanism the feature has. */

/** How a handle is folded before the cross-Player uniqueness check. `none` is
    for platforms whose identifiers are genuinely case-sensitive, where folding
    would collide two different destinations. */
export type HandleFold = 'lower' | 'none'

export interface Platform {
  id: string
  name: string
  /** The host every constructed URL sits on. Clause 2, as a value. */
  host: string
  /** Hosts a paste may arrive on, canonical first. Extraction only. */
  pasteHosts: ReadonlyArray<string>
  /** Everything before the handle in the path — `/@`, `/user/`, or `/`. */
  pathPrefix: string
  /** Path prefixes a paste may arrive under, canonical first. Extraction only:
      what is stored is always rebuilt from `pathPrefix`. */
  pastePathPrefixes: ReadonlyArray<string>
  /** The static text welded to the field, so a pasted URL looks wrong on
      screen before it is ever submitted. */
  fieldPrefix: string
  /** Anchored handle grammar. Where a platform does not publish one, this is
      deliberately narrower than the platform accepts — see `grammarVerified`. */
  pattern: RegExp
  fold: HandleFold
  /** False where the platform does not publish its grammar and this one was
      chosen conservatively rather than guessed at from observed handles. */
  grammarVerified: boolean
  /** What precedes the handle in the link's own text. */
  sigil: string
  /** `glyph` takes the square brand plate; `wordmark` takes a pill sized to
      itself, because the row aligns on plate height and never plate width. */
  mark: 'glyph' | 'wordmark'
  /** White throughout. The binding constraint is knockouts, not the sanctioned
      background lists: YouTube's, Reddit's, Telegram's and Instagram's marks
      knock their interior detail out to transparent, so a black plate would
      repaint YouTube's play triangle black — the recolouring it forbids. */
  plate: 'white'
}

/** Named platforms, in the order every profile on the site renders them. Fixed
    from here: no drag affordance, no position column, and no migration when the
    list grows. Ordered by the measured distribution among War Thunder creators,
    which is the only non-arbitrary order available. */
export const PLATFORMS: ReadonlyArray<Platform> = [
  {
    id: 'youtube',
    name: 'YouTube',
    host: 'www.youtube.com',
    pasteHosts: ['www.youtube.com', 'youtube.com', 'm.youtube.com'],
    pathPrefix: '/@',
    pastePathPrefixes: ['/@'],
    fieldPrefix: 'youtube.com/@',
    // Published: 3–30 characters, letters, numbers, underscores, hyphens, dots.
    pattern: /^[A-Za-z0-9_.-]{3,30}$/,
    fold: 'lower',
    grammarVerified: true,
    sigil: '@',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'discord',
    name: 'Discord',
    host: 'discord.gg',
    pasteHosts: ['discord.gg', 'discord.com', 'www.discord.com'],
    pathPrefix: '/',
    pastePathPrefixes: ['/', '/invite/'],
    fieldPrefix: 'discord.gg/',
    pattern: /^[A-Za-z0-9-]{2,64}$/,
    // An invite code is case-sensitive, so folding it would collide two
    // genuinely different servers on the uniqueness index.
    fold: 'none',
    grammarVerified: true,
    sigil: '',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    host: 'www.twitch.tv',
    pasteHosts: ['www.twitch.tv', 'twitch.tv', 'm.twitch.tv'],
    pathPrefix: '/',
    pastePathPrefixes: ['/'],
    fieldPrefix: 'twitch.tv/',
    // UNVERIFIED — help.twitch.tv 404s to non-browser clients, so the exact
    // charset and length ceiling are not readable. Narrower than Twitch is
    // known to accept, on purpose: a refused legitimate handle is a bug report,
    // a guessed-wide grammar is a hole.
    pattern: /^[A-Za-z0-9_]{4,25}$/,
    fold: 'lower',
    grammarVerified: false,
    sigil: '',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    host: 'www.tiktok.com',
    pasteHosts: ['www.tiktok.com', 'tiktok.com', 'm.tiktok.com'],
    pathPrefix: '/@',
    pastePathPrefixes: ['/@'],
    fieldPrefix: 'tiktok.com/@',
    // UNVERIFIED — TikTok publishes no handle grammar, and one must not be
    // guessed into a regex. Conservative on both charset and length.
    pattern: /^[A-Za-z0-9_.]{2,24}$/,
    fold: 'lower',
    grammarVerified: false,
    sigil: '@',
    // TikTok's logo is forbidden outright without written permission, and its
    // own guidelines name a plain "TikTok" call-out as permitted verbatim — so
    // the wordmark is the platform's sanctioned option, not a compromise. Set
    // in our own type, never TikTok's: no WT-Records-plus-TikTok lockup.
    mark: 'wordmark',
    plate: 'white',
  },
  {
    id: 'x',
    name: 'X',
    host: 'x.com',
    pasteHosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
    pathPrefix: '/',
    pastePathPrefixes: ['/'],
    fieldPrefix: 'x.com/',
    pattern: /^[A-Za-z0-9_]{1,15}$/,
    fold: 'lower',
    grammarVerified: true,
    sigil: '@',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    host: 'www.instagram.com',
    pasteHosts: ['www.instagram.com', 'instagram.com'],
    pathPrefix: '/',
    pastePathPrefixes: ['/'],
    fieldPrefix: 'instagram.com/',
    pattern: /^[A-Za-z0-9_.]{1,30}$/,
    fold: 'lower',
    grammarVerified: true,
    sigil: '@',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    host: 'bsky.app',
    pasteHosts: ['bsky.app', 'www.bsky.app'],
    pathPrefix: '/profile/',
    pastePathPrefixes: ['/profile/'],
    fieldPrefix: 'bsky.app/profile/',
    // A Bluesky handle IS a domain name, so the grammar is a domain's.
    pattern:
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/,
    fold: 'lower',
    grammarVerified: true,
    sigil: '@',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    host: 't.me',
    pasteHosts: ['t.me', 'telegram.me', 'www.t.me'],
    pathPrefix: '/',
    pastePathPrefixes: ['/'],
    fieldPrefix: 't.me/',
    // Published: 5–32 characters, must begin with a letter.
    pattern: /^[A-Za-z][A-Za-z0-9_]{4,31}$/,
    fold: 'lower',
    grammarVerified: true,
    sigil: '@',
    mark: 'glyph',
    plate: 'white',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    host: 'www.reddit.com',
    pasteHosts: ['www.reddit.com', 'reddit.com', 'old.reddit.com'],
    pathPrefix: '/user/',
    pastePathPrefixes: ['/user/', '/u/'],
    fieldPrefix: 'reddit.com/user/',
    pattern: /^[A-Za-z0-9_-]{3,20}$/,
    fold: 'lower',
    grammarVerified: true,
    sigil: 'u/',
    mark: 'glyph',
    plate: 'white',
  },
]

/** Admissible — it clears all three clauses — but not shippable, and recorded
    here as ruled out rather than unconsidered. A platform becomes shippable
    only once its brand terms have been read AND it can be drawn at the size the
    header can carry. */
export const DEFERRED_PLATFORMS: ReadonlyArray<{
  id: string
  name: string
  reason: string
}> = [
  {
    id: 'kick',
    name: 'Kick',
    reason:
      'Its published 40px digital floor for the Special K would size every mark ' +
      'on the site, because a row cannot mix one 40px mark with five 24px ones. ' +
      'The wordmark is not the escape — its floor is 90px, strictly worse.',
  },
]

/** Refused by a clause, and recorded so the case is not re-proposed. */
export const REFUSED_PLATFORMS: ReadonlyArray<{
  name: string
  clause: 2 | 3
  reason: string
}> = [
  {
    name: 'Steam',
    clause: 3,
    reason:
      'A vanity URL may be changed freely, and the old one then resolves to ' +
      'whoever claims it next — a stored handle does not merely rot, it can ' +
      'come to name a different person. Admissible only as a 17-digit ' +
      'steamid64, and a number is not a label.',
  },
  {
    name: 'Mastodon, Lemmy, Matrix',
    clause: 2,
    reason: 'The host is part of the identity, so there is no host to fix.',
  },
]

/** The free-text personal site: the one field the handle rule does not cover,
    which is why it carries its own validation rules and its own carve-out from
    the cross-Player uniqueness index. It absorbs the fragmented tail — tip jars
    across 8+ providers, merch, link aggregators, squadron sites — which is a
    large part of what earns it its place. */
export const WEBSITE_PLATFORM = 'website'

/** Five named platforms, plus the personal site on top. Twitch caps its own
    creators at exactly five and they still average 3.12, so this sits above
    measured behaviour and will essentially never be hit. */
export const MAX_NAMED_LINKS = 5

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]))

export function platform(id: string): Platform | null {
  return BY_ID.get(id) ?? null
}

/** True for a named platform or the personal site — everything storable. */
export function isStorablePlatform(id: string): boolean {
  return id === WEBSITE_PLATFORM || BY_ID.has(id)
}

/** Display order, the personal site last: it is the one slot that does not name
    a destination, so it reads as the tail of the row rather than part of it. */
export function platformOrder(id: string): number {
  if (id === WEBSITE_PLATFORM) return PLATFORMS.length
  const index = PLATFORMS.findIndex((p) => p.id === id)
  return index === -1 ? PLATFORMS.length + 1 : index
}

/** The brand glyph, or null for a platform that ships as a wordmark. */
export function brandMark(
  id: string,
): { title: string; hex: string; path: string } | null {
  return BRAND_MARKS[id] ?? null
}
