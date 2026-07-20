import { describe, expect, it } from 'vitest'
import { toStorageState } from './storage-state'

const NOW = 1_800_000_000_000
const ORIGIN = 'http://localhost:3000'

describe('toStorageState', () => {
  it('maps a Supabase auth cookie onto the Playwright cookie shape', () => {
    const state = toStorageState(
      [{ name: 'sb-127-auth-token', value: 'base64-abc', options: {} }],
      ORIGIN,
      NOW,
    )
    expect(state.cookies).toEqual([
      {
        name: 'sb-127-auth-token',
        value: 'base64-abc',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])
  })

  it('turns maxAge into an absolute expiry in seconds', () => {
    const [cookie] = toStorageState(
      [{ name: 'sb-127-auth-token', value: 'v', options: { maxAge: 3600 } }],
      ORIGIN,
      NOW,
    ).cookies
    expect(cookie.expires).toBe(NOW / 1000 + 3600)
  })

  it('marks cookies secure on an https origin', () => {
    const [cookie] = toStorageState(
      [{ name: 'sb-x-auth-token', value: 'v' }],
      'https://preview.example.com',
      NOW,
    ).cookies
    expect(cookie).toMatchObject({
      domain: 'preview.example.com',
      secure: true,
    })
  })

  it('honours an explicit path and sameSite', () => {
    const [cookie] = toStorageState(
      [
        {
          name: 'c',
          value: 'v',
          options: { path: '/admin', sameSite: 'strict' },
        },
      ],
      ORIGIN,
      NOW,
    ).cookies
    expect(cookie).toMatchObject({ path: '/admin', sameSite: 'Strict' })
  })

  it('keeps the last write when a cookie is set more than once', () => {
    const state = toStorageState(
      [
        { name: 'sb-127-auth-token', value: 'first' },
        { name: 'sb-127-auth-token', value: 'second' },
      ],
      ORIGIN,
      NOW,
    )
    expect(state.cookies).toHaveLength(1)
    expect(state.cookies[0].value).toBe('second')
  })

  // A sign-in that rewrites a chunked session clears the stale chunk by
  // writing it empty; carrying that into the state would send a junk cookie.
  it('drops cookies cleared during the exchange', () => {
    const state = toStorageState(
      [
        { name: 'sb-127-auth-token.1', value: 'stale' },
        { name: 'sb-127-auth-token.1', value: '', options: { maxAge: 0 } },
      ],
      ORIGIN,
      NOW,
    )
    expect(state.cookies).toEqual([])
  })

  it('pre-grants analytics consent so the banner never overlays the page', () => {
    const state = toStorageState([], ORIGIN, NOW)
    expect(state.origins).toEqual([
      {
        origin: ORIGIN,
        localStorage: [{ name: 'wt-consent', value: 'granted' }],
      },
    ])
  })
})
