import { describe, expect, it } from 'vitest'
import { portraitObjectKey } from '#/catalog/portrait-key'

const SHA = 'f6931d7db2e7c1f3a45908c7de1b2f04a9c3e5d1'
const OTHER = 'b2e7c1f3f6931d7d08c7de1b2f04a9c3e5d14590'
const URL = 'https://raw.example/repo/abc123/tex/tanks/us_m1_abrams.png'

describe('portraitObjectKey', () => {
  it('derives a stable key from external id and content id', () => {
    const key = portraitObjectKey('us_m1_abrams', SHA, URL)
    expect(key).toMatch(/^vehicles\/us_m1_abrams-[0-9a-f]{8}\.png$/)
    expect(portraitObjectKey('us_m1_abrams', SHA, URL)).toBe(key)
  })

  // The source URL is pinned to the run's revision, so it changes every night
  // while the artwork does not — keying on it would re-mirror the catalog daily.
  it('ignores a changed source URL when the content is the same', () => {
    expect(portraitObjectKey('us_m1_abrams', SHA, URL)).toBe(
      portraitObjectKey(
        'us_m1_abrams',
        SHA,
        'https://raw.example/repo/def456/tex/tanks/us_m1_abrams.png',
      ),
    )
  })

  it('changes when the content changes', () => {
    expect(portraitObjectKey('us_m1_abrams', SHA, URL)).not.toBe(
      portraitObjectKey('us_m1_abrams', OTHER, URL),
    )
  })

  it('keeps only known image extensions', () => {
    expect(portraitObjectKey('x', SHA, 'https://a.example/img.webp')).toMatch(
      /\.webp$/,
    )
    expect(
      portraitObjectKey('x', SHA, 'https://a.example/download?id=7'),
    ).toMatch(/^vehicles\/x-[0-9a-f]{8}$/)
  })

  it('rejects a content id that is not a usable hash', () => {
    expect(() => portraitObjectKey('x', '', URL)).toThrow(/content id/i)
    expect(() => portraitObjectKey('x', 'short', URL)).toThrow(/content id/i)
    expect(() => portraitObjectKey('x', 'zzzzzzzzzzzz', URL)).toThrow(
      /content id/i,
    )
  })

  it('rejects an external id that would produce a traversal key', () => {
    expect(() => portraitObjectKey('a/../b', SHA, URL)).toThrow(/object key/i)
  })
})
