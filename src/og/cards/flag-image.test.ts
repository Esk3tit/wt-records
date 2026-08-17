import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveCountryMark } from '#/lib/country-mark-server'
import { countryFlagDataUri, flagDataUri } from './flag-image'

const mark = (code: string) => resolveCountryMark(code)!

/* ADR 0009's crash mode is a fetch failing mid-render, so the negative is what
   matters: resolving a mark issues no request at all. */

afterEach(() => {
  vi.unstubAllGlobals()
})

function withoutNetwork<T>(body: () => T): { result: T; calls: number } {
  const fetchSpy = vi.fn(() => {
    throw new Error('the renderer must never fetch a flag')
  })
  vi.stubGlobal('fetch', fetchSpy)
  return { result: body(), calls: fetchSpy.mock.calls.length }
}

describe('countryFlagDataUri', () => {
  it('inlines the mark as a self-contained SVG data URI, issuing no fetch', () => {
    const { result, calls } = withoutNetwork(() =>
      countryFlagDataUri(mark('JP')),
    )
    expect(calls).toBe(0)
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/)

    const svg = Buffer.from(result.split(',')[1], 'base64').toString()
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox=')
    // The xmlns is a namespace, never fetched; a reference the renderer would
    // have to resolve is the thing that must not survive into the URI.
    expect(svg).not.toMatch(/(?:href|src|url\()\s*=?\s*["'(]?https?:/)
  })

  it('returns the same bytes every call, so a card version stays stable', () => {
    expect(countryFlagDataUri(mark('DE'))).toBe(countryFlagDataUri(mark('DE')))
  })

  it('leaves the miss to the resolver, which owns the list', () => {
    expect(resolveCountryMark('ZZ')).toBeNull()
    expect(resolveCountryMark('')).toBeNull()
    // A nation slug is not a country code, and neither list answers the other's.
    expect(resolveCountryMark('ussr')).toBeNull()
  })

  it('is a second consumer of the seam, not a replacement for the nation one', () => {
    expect(flagDataUri('ussr')).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(flagDataUri('JP')).toBeNull()
  })
})
