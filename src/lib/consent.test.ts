import { describe, expect, it } from 'vitest'
import { readConsent, writeConsent } from '#/lib/consent'

describe('consent store', () => {
  it('is unknown before any decision', () => {
    expect(readConsent()).toBe('unknown')
  })

  it('round-trips a granted decision', () => {
    writeConsent('granted')
    expect(readConsent()).toBe('granted')
  })

  it('round-trips a denied decision', () => {
    writeConsent('denied')
    expect(readConsent()).toBe('denied')
  })

  it('treats an unrecognized stored value as unknown', () => {
    localStorage.setItem('wt-consent', 'maybe')
    expect(readConsent()).toBe('unknown')
  })
})
