import { describe, expect, it } from 'vitest'
import { assertValidObjectKey, publicObjectUrl } from '#/storage/urls'

describe('publicObjectUrl', () => {
  it('joins the base URL and key with a single slash', () => {
    expect(
      publicObjectUrl(
        'https://proofs.wtrecords.gg',
        'proofs/123/scoreboard.webp',
      ),
    ).toBe('https://proofs.wtrecords.gg/proofs/123/scoreboard.webp')
  })

  it('tolerates a trailing slash on the base URL', () => {
    expect(publicObjectUrl('https://proofs.wtrecords.gg/', 'a.webp')).toBe(
      'https://proofs.wtrecords.gg/a.webp',
    )
  })

  it('percent-encodes key segments but keeps slash separators', () => {
    expect(
      publicObjectUrl(
        'https://proofs.wtrecords.gg',
        'proofs/12 3/shot #1?.webp',
      ),
    ).toBe('https://proofs.wtrecords.gg/proofs/12%203/shot%20%231%3F.webp')
  })
})

describe('assertValidObjectKey', () => {
  it('accepts a normal nested key', () => {
    expect(() =>
      assertValidObjectKey('proofs/123/scoreboard.webp'),
    ).not.toThrow()
  })

  it.each([
    ['empty', ''],
    ['leading slash', '/proofs/a.webp'],
    ['trailing slash', 'proofs/a.webp/'],
    ['empty segment', 'proofs//a.webp'],
    ['dot segment', 'proofs/./a.webp'],
    ['traversal segment', 'proofs/../a.webp'],
  ])('rejects %s', (_label, key) => {
    expect(() => assertValidObjectKey(key)).toThrow(/object key/i)
  })
})
