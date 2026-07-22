import { describe, expect, it } from 'vitest'
import { asParam } from '#/lib/search-param'

describe('asParam', () => {
  it('canonicalizes JSON-parsed scalars back to strings', () => {
    expect(asParam(4)).toBe('4')
    expect(asParam(8.3)).toBe('8.3')
    expect(asParam(true)).toBe('true')
    expect(asParam(null)).toBe('null')
  })

  it('passes strings and non-finite values through untouched', () => {
    expect(asParam('tiger')).toBe('tiger')
    expect(asParam('4')).toBe('4')
    expect(asParam(undefined)).toBeUndefined()
    expect(asParam(Number.NaN)).toBeNaN()
  })
})
