import { describe, expect, it } from 'vitest'
import { MAX_WEBSITE_LENGTH, normalizeWebsite } from '#/links/website'
import { fieldPrefix, fieldValue } from '#/links/parse'
import { WEBSITE_PLATFORM } from '#/links/platforms'

/* The personal site is the one field the handle rule does not cover: an
   arbitrary URL to anywhere, published instantly with nobody reviewing it. The
   table below is the measured hostile-input set, written verbatim — each row is
   a real failure somebody has already shipped, and paraphrasing it loses the
   point. */

const HOSTILE: ReadonlyArray<[input: string, because: string]> = [
  ['https://youtube.com@evil.com/x', 'parses to evil.com, reads as YouTube'],
  ['https://youtube.com.evil.com/', 'defeats endsWith("youtube.com")'],
  ['https://уoutube.com/', 'punycodes to xn--outube-vrf.com (Cyrillic у)'],
  [
    'http://youtube.com./',
    'a trailing dot is a valid FQDN and breaks Set.has()',
  ],
  ['javascript:alert(1)', 'parses fine with an empty host'],
  [
    'data:text/html,<script>alert(1)</script>',
    'parses fine with an empty host',
  ],
  ['vbscript:msgbox(1)', 'parses fine with an empty host'],
  [
    'https://example.com/?next=https://evil.com',
    'every measured redirector carries its payload in the query',
  ],
  ['http://example.com/', 'https: only'],
  ['https://example.com:8443/', 'a non-default port'],
]

describe('the hostile-input table', () => {
  it.each(HOSTILE)('refuses %s — %s', (input) => {
    expect(() => normalizeWebsite(input)).toThrow()
  })

  /* The table's trailing-dot row arrives over http, so the scheme refuses it
     before the dot rule is ever reached. This is that row with the scheme it
     would need to get that far: the dot has to come off BEFORE the host is
     judged, or `youtube.com.` reads as some site nobody has heard of. */
  it('strips the trailing dot before anything else judges the host', () => {
    expect(() => normalizeWebsite('https://youtube.com./')).toThrow(
      /its own field/,
    )
  })
})

describe('what the personal site accepts', () => {
  it('takes an ordinary https address', () => {
    expect(normalizeWebsite('https://phlydaily.example')).toBe(
      'https://phlydaily.example',
    )
    expect(normalizeWebsite('https://phlydaily.example/links/')).toBe(
      'https://phlydaily.example/links/',
    )
  })

  it('supplies the scheme the field already welds to the input', () => {
    expect(normalizeWebsite('phlydaily.example')).toBe(
      'https://phlydaily.example',
    )
  })

  it('canonicalises on store, and echoes back exactly what was stored', () => {
    // A lone trailing slash says nothing, an uppercase host is the same host,
    // and one trailing dot is stripped before anything else looks at it.
    expect(normalizeWebsite('https://PhlyDaily.Example/')).toBe(
      'https://phlydaily.example',
    )
    expect(normalizeWebsite('https://phlydaily.example./shop')).toBe(
      'https://phlydaily.example/shop',
    )
    const canonical = normalizeWebsite(' https://phlydaily.example/shop ')
    expect(normalizeWebsite(canonical)).toBe(canonical)
  })

  // Its whole job: absorbing the fragmented tail the named list refuses.
  it('takes the tail the named list deliberately does not name', () => {
    for (const site of [
      'https://ko-fi.com/phlydaily',
      'https://www.patreon.com/phlydaily',
      'https://linktr.ee/phlydaily',
      'https://phlydaily.myspreadshop.example',
    ]) {
      expect(normalizeWebsite(site)).toBe(site)
    }
  })
})

describe('what the personal site refuses beyond the table', () => {
  it('refuses a platform that already has its own field', () => {
    for (const covered of [
      'https://www.youtube.com/@phlydaily',
      'https://twitch.tv/phlydaily',
      'https://discord.gg/wtrecords',
      'https://bsky.app/profile/phly.bsky.social',
      'https://t.me/phlydaily',
    ]) {
      expect(() => normalizeWebsite(covered)).toThrow(/its own field/)
    }
  })

  /* `:443` is https's own default, so the parser drops it and the address is
     identical to one without it — but the host comparison saw the whole typed
     authority and refused it, with the homograph message of all things. The
     port comes off before the host is compared now. */
  it('takes https’s own default port, and drops it', () => {
    expect(normalizeWebsite('https://phlydaily.example:443/shop')).toBe(
      'https://phlydaily.example/shop',
    )
    expect(normalizeWebsite('https://phlydaily.example.:443/')).toBe(
      'https://phlydaily.example',
    )
  })

  // The reason that split is safe: nothing else keys off the port, so every
  // check the host comparison was doing still fires with one present.
  it('keeps refusing everything else when a port is written out', () => {
    expect(() => normalizeWebsite('https://example.com:8443/')).toThrow(
      /Remove the port/,
    )
    expect(() => normalizeWebsite('https://уoutube.com:443/')).toThrow(
      /does not go where it looks like/,
    )
    expect(() => normalizeWebsite('https://youtube.com:443/')).toThrow(
      /its own field/,
    )
  })

  it('refuses a host that is not a domain', () => {
    expect(() => normalizeWebsite('https://localhost/')).toThrow()
    expect(() => normalizeWebsite('https://127.0.0.1/')).toThrow()
    expect(() => normalizeWebsite('https://[::1]/')).toThrow()
  })

  // The lesson the repo learned once already, at src/admin/api.ts.
  it('refuses host-less values a prefix regex would admit', () => {
    expect(() => normalizeWebsite('https://?x')).toThrow()
    expect(() => normalizeWebsite('https://')).toThrow()
    expect(() => normalizeWebsite('https:example.example')).toThrow()
  })

  it('refuses whitespace and control characters', () => {
    expect(() => normalizeWebsite('https://phly daily.example')).toThrow()
    expect(() => normalizeWebsite('https://phly\ndaily.example')).toThrow()
  })

  it('caps the length', () => {
    const long = `https://${'a'.repeat(MAX_WEBSITE_LENGTH)}.example`
    expect(() => normalizeWebsite(long)).toThrow(/characters/)
  })

  it('refuses an empty field', () => {
    expect(() => normalizeWebsite('  ')).toThrow(/Enter the address/)
  })
})

/* The field welds `https://` on as static text, so what belongs IN it is the
   rest — but the personal site is the one slot whose stored value is a whole
   canonical URL, scheme and all. Seeding the field with it raw read
   `https://https://example.com` the instant a first save round-tripped. */
describe('what belongs in the field, given what is stored', () => {
  it('drops the scheme the welded prefix is already drawing', () => {
    expect(fieldValue(WEBSITE_PLATFORM, 'https://phlydaily.example/shop')).toBe(
      'phlydaily.example/shop',
    )
    expect(fieldPrefix(WEBSITE_PLATFORM)).toBe('https://')
  })

  it('leaves a named platform’s handle alone — it sits under its prefix already', () => {
    expect(fieldValue('youtube', 'PhlyDaily')).toBe('PhlyDaily')
    expect(fieldValue('reddit', 'phlydaily')).toBe('phlydaily')
  })

  it('round-trips: what the field shows re-parses to what was stored', () => {
    const stored = normalizeWebsite('https://phlydaily.example/shop')
    expect(normalizeWebsite(fieldValue(WEBSITE_PLATFORM, stored))).toBe(stored)
  })

  it('is empty for a slot with nothing on it', () => {
    expect(fieldValue(WEBSITE_PLATFORM, '')).toBe('')
  })
})
