import { afterEach, describe, expect, it } from 'vitest'
import { assertValidObjectKey, assetUrl, publicObjectUrl } from '#/storage/urls'

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

describe('assetUrl', () => {
  const saved = process.env.R2_ASSETS_BASE_URL
  afterEach(() => {
    if (saved === undefined) delete process.env.R2_ASSETS_BASE_URL
    else process.env.R2_ASSETS_BASE_URL = saved
  })

  it('builds a serving URL from the assets base URL alone', () => {
    process.env.R2_ASSETS_BASE_URL = 'https://assets.wtrecords.gg'
    expect(assetUrl('vehicles/us_m1_abrams-0a1b2c3d.png')).toBe(
      'https://assets.wtrecords.gg/vehicles/us_m1_abrams-0a1b2c3d.png',
    )
  })

  it('fails loudly when the base URL is not configured', () => {
    delete process.env.R2_ASSETS_BASE_URL
    expect(() => assetUrl('vehicles/a.png')).toThrow(/R2_ASSETS_BASE_URL/)
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
