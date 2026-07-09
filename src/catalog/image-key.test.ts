import { describe, expect, it } from 'vitest'
import { vehicleImageKey } from '#/catalog/image-key'

describe('vehicleImageKey', () => {
  it('derives a stable key from external id and source URL', () => {
    const key = vehicleImageKey(
      'us_m1_abrams',
      'https://api.example/assets/images/us_m1_abrams.png',
    )
    expect(key).toMatch(/^vehicles\/us_m1_abrams-[0-9a-f]{8}\.png$/)
    expect(
      vehicleImageKey(
        'us_m1_abrams',
        'https://api.example/assets/images/us_m1_abrams.png',
      ),
    ).toBe(key)
  })

  it('changes when the source URL changes', () => {
    const a = vehicleImageKey('us_m1_abrams', 'https://a.example/1.png')
    const b = vehicleImageKey('us_m1_abrams', 'https://a.example/2.png')
    expect(a).not.toBe(b)
  })

  it('keeps only known image extensions', () => {
    expect(vehicleImageKey('x', 'https://a.example/img.webp')).toMatch(
      /\.webp$/,
    )
    expect(vehicleImageKey('x', 'https://a.example/download?id=7')).toMatch(
      /^vehicles\/x-[0-9a-f]{8}$/,
    )
  })

  it('rejects an external id that would produce a traversal key', () => {
    expect(() =>
      vehicleImageKey('a/../b', 'https://a.example/img.png'),
    ).toThrow(/object key/i)
  })
})
