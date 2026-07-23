import { createFileRoute } from '@tanstack/react-router'
import {
  getCookies,
  getRequestUrl,
  setCookie,
} from '@tanstack/react-start/server'
import { supabaseServer } from '#/auth/supabase-server'
import { profileFromUser, upsertProfileFromOAuth } from '#/auth/profile'
import { safeNextPath } from '#/lib/safe-next-path'
import { OAUTH_NEXT_COOKIE } from '#/auth/oauth-next'
import { db } from '#/db'

/* OAuth return leg: exchange the code for a cookie session, provision the
   profile (role defaults to viewer; promotion is one-off SQL), then return to
   the stashed ?next= target (default /admin). Every failure path still lands
   there — the destination's own gate renders the right signed-in/out state. */
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async () => {
        const url = getRequestUrl({
          xForwardedHost: true,
          xForwardedProto: true,
        })
        const next = safeNextPath(getCookies()[OAUTH_NEXT_COOKIE])
        // Match the login cookie's attributes so the browser reliably clears it.
        setCookie(OAUTH_NEXT_COOKIE, '', {
          path: '/',
          maxAge: 0,
          httpOnly: true,
          sameSite: 'lax',
          secure: url.protocol === 'https:',
        })
        const back = () =>
          new Response(null, { status: 302, headers: { Location: next } })

        const code = url.searchParams.get('code')
        if (!code) return back()
        const { data, error } =
          await supabaseServer().auth.exchangeCodeForSession(code)
        if (error) return back()
        try {
          await upsertProfileFromOAuth(db, profileFromUser(data.user))
        } catch (upsertError) {
          // The session cookie is already set; the next login retries the
          // upsert, and each gate handles a missing profile gracefully.
          console.warn('profile upsert failed on OAuth callback', upsertError)
        }
        return back()
      },
    },
  },
})
