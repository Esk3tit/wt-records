import { createFileRoute } from '@tanstack/react-router'
import { getRequestUrl } from '@tanstack/react-start/server'
import { supabaseServer } from '#/auth/supabase-server'
import { profileFromUser, upsertProfileFromOAuth } from '#/auth/profile'
import { db } from '#/db'

const toAdmin = () =>
  new Response(null, { status: 302, headers: { Location: '/admin' } })

/* OAuth return leg: exchange the code for a cookie session and provision the
   profile (role defaults to viewer; promotion is one-off SQL). Every failure
   path lands on /admin, whose gate renders the right signed-out state. */
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async () => {
        const code = getRequestUrl().searchParams.get('code')
        if (!code) return toAdmin()
        const { data, error } =
          await supabaseServer().auth.exchangeCodeForSession(code)
        if (error) return toAdmin()
        try {
          await upsertProfileFromOAuth(db, profileFromUser(data.user))
        } catch (upsertError) {
          // The session cookie is already set; the next login retries the
          // upsert, and /admin's gate handles a missing profile gracefully.
          console.warn('profile upsert failed on OAuth callback', upsertError)
        }
        return toAdmin()
      },
    },
  },
})
