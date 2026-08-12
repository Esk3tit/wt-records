import { describe, expect, it } from 'vitest'
import { MAX_WEBSITE_LENGTH, normalizeWebsite } from '#/links/website'

/* The personal site is the one field the handle rule does not cover: an
   arbitrary URL to anywhere, published instantly with nobody reviewing it. The
   table below is the measured hostile-input set, written verbatim — each row is
   a real failure somebody has already shipped, and paraphrasing it loses the
   point. */

const HOSTILE: ReadonlyArray<[input: string, because: string]> = [
  [
    'https://youtube.com@evil.example/x',
    'parses to evil.example, reads as YouTube',
  ],
  ['https://youtube.com.evil.example/', 'defeats endsWith("youtube.com")'],
  ['https://уoutube.example/', 'punycodes to xn--… (Cyrillic у)'],
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
    'https://example.com/?next=https://evil.example',
    'every measured redirector carries its payload in the query',
  ],
  ['http://example.com/', 'https: only'],
  ['https://example.com:8443/', 'a non-default port'],
]

describe('the hostile-input table', () => {
  it.each(HOSTILE)('refuses %s — %s', (input) => {
    expect(() => normalizeWebsite(input)).toThrow()
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
  it('refuses a platform that already has its own slot', () => {
    for (const covered of [
      'https://www.youtube.com/@phlydaily',
      'https://twitch.tv/phlydaily',
      'https://discord.gg/wtrecords',
      'https://bsky.app/profile/phly.bsky.social',
      'https://t.me/phlydaily',
    ]) {
      expect(() => normalizeWebsite(covered)).toThrow(/its own slot/)
    }
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
