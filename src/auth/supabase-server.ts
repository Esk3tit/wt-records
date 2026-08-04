import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import {
  getCookies,
  setCookie,
  setResponseHeader,
} from '@tanstack/react-start/server'

// Cookie-session Supabase Auth for the current request. Auth only —
// all data reads/writes stay on the service-role Drizzle connection.
if (typeof window !== 'undefined') {
  throw new Error('#/auth/supabase-server must not be imported in the browser')
}

export function supabaseServer() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY not set')
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }))
      },
      setAll(cookies, headers) {
        for (const cookie of cookies) {
          // All auth happens server-side — no browser client ever needs to
          // read these, so keep the session out of reach of any XSS.
          setCookie(cookie.name, cookie.value, {
            ...cookie.options,
            httpOnly: true,
          })
        }
        // The library's no-cache headers: a response that writes auth
        // cookies must never be CDN/proxy cached.
        for (const [name, value] of Object.entries(headers)) {
          setResponseHeader(name, value)
        }
      },
    },
  })
}

/** Whether the request carries a Supabase SESSION cookie — lets visitor
    requests skip the token validation round-trip entirely. The PKCE
    code-verifier cookie of an abandoned sign-in must not count. */
export function hasAuthCookie(): boolean {
  return Object.keys(getCookies()).some(
    (name) =>
      name.startsWith('sb-') &&
      name.includes('-auth-token') &&
      !name.includes('code-verifier'),
  )
}

/** The validated signed-in user, or null. Validates the JWT with Supabase
    (auth.getUser, not the unverified session claims). */
export async function getSessionUser(): Promise<User | null> {
  if (!hasAuthCookie()) return null
  const { data, error } = await supabaseServer().auth.getUser()
  if (error) {
    // An expired or revoked session is routine; no status at all, or a 5xx,
    // means auth is failing and every visitor silently loses their role.
    // An unreachable auth server reports status 0, which must stay loud.
    const routine =
      typeof error.status === 'number' &&
      error.status >= 400 &&
      error.status < 500
    const report = `[auth] session validation failed: ${error.name} ${error.status ?? 'no status'} ${error.message}`
    if (routine) console.warn(report)
    else console.error(report)
    return null
  }
  return data.user
}
