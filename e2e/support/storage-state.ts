/** Translation between what `@supabase/ssr` writes and what Playwright reads.
    Pure — no network, no clock — so the cookie shape is unit-testable. */

export interface WrittenCookie {
  name: string
  value: string
  options?: {
    path?: string
    maxAge?: number
    sameSite?: string | boolean
  }
}

export interface StorageState {
  cookies: {
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: 'Strict' | 'Lax' | 'None'
  }[]
  origins: { origin: string; localStorage: { name: string; value: string }[] }[]
}

const CONSENT_KEY = 'wt-consent'

export function toStorageState(
  written: WrittenCookie[],
  origin: string,
  now: number,
): StorageState {
  const { hostname, protocol } = new URL(origin)
  const latest = new Map<string, WrittenCookie>()
  for (const cookie of written) latest.set(cookie.name, cookie)

  return {
    cookies: [...latest.values()]
      .filter((cookie) => cookie.value !== '' && cookie.options?.maxAge !== 0)
      .map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: hostname,
        path: cookie.options?.path ?? '/',
        expires:
          cookie.options?.maxAge != null
            ? now / 1000 + cookie.options.maxAge
            : -1,
        // The app forces httpOnly on every auth cookie (src/auth/supabase-server.ts),
        // so the browser must receive them the same way or the server sees a mismatch.
        httpOnly: true,
        secure: protocol === 'https:',
        sameSite: normalizeSameSite(cookie.options?.sameSite),
      })),
    // Granting consent up front keeps the fixed-position banner from covering
    // bottom-of-page targets in every single test.
    origins: [
      { origin, localStorage: [{ name: CONSENT_KEY, value: 'granted' }] },
    ],
  }
}

function normalizeSameSite(value: unknown): 'Strict' | 'Lax' | 'None' {
  const text = String(value).toLowerCase()
  if (text === 'strict') return 'Strict'
  if (text === 'none') return 'None'
  return 'Lax'
}
