import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { getCookies, setCookie } from '@tanstack/react-start/server'

// Cookie-session Supabase Auth for the current request (ADR 0008). Auth only —
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
      setAll(cookies) {
        for (const cookie of cookies) {
          setCookie(cookie.name, cookie.value, cookie.options)
        }
      },
    },
  })
}

/** Whether the request carries a Supabase auth cookie at all — lets visitor
    requests skip the token validation round-trip entirely. */
export function hasAuthCookie(): boolean {
  return Object.keys(getCookies()).some(
    (name) => name.startsWith('sb-') && name.includes('-auth-token'),
  )
}

/** The validated signed-in user, or null. Validates the JWT with Supabase
    (auth.getUser, not the unverified session claims). */
export async function getSessionUser(): Promise<User | null> {
  if (!hasAuthCookie()) return null
  const { data, error } = await supabaseServer().auth.getUser()
  if (error) return null
  return data.user
}
