import { createServerClient } from '@supabase/ssr'
import { baseUrl, requireEnv } from './env'
import { toStorageState } from './storage-state'
import type { StorageState, WrittenCookie } from './storage-state'

/** Signs in through the SDK and captures the session as browser cookies. The
    session lives in httpOnly cookies, so rather than reproduce Supabase's
    cookie naming/chunking, let `@supabase/ssr` write into a recording jar. */
export async function mintStorageState(
  email: string,
  password: string,
): Promise<StorageState> {
  const jar = new Map<string, string>()
  const written: WrittenCookie[] = []

  const client = createServerClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const cookie of cookies) {
            jar.set(cookie.name, cookie.value)
            written.push(cookie)
          }
        },
      },
    },
  )

  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error)
    throw new Error(`test sign-in failed for ${email}: ${error.message}`)
  if (written.length === 0) {
    throw new Error(`sign-in for ${email} produced no session cookies`)
  }
  return toStorageState(written, baseUrl(), Date.now())
}

/** A signed-out state — no session, but consent already granted so the
    banner doesn't sit on top of the page under test. */
export function anonymousStorageState(): StorageState {
  return toStorageState([], baseUrl(), Date.now())
}
