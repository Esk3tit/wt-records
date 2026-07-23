import { createFileRoute } from '@tanstack/react-router'
import { getRequestUrl, setCookie } from '@tanstack/react-start/server'
import { supabaseServer } from '#/auth/supabase-server'
import { safeNextPath } from '#/lib/safe-next-path'
import { OAUTH_NEXT_COOKIE, OAUTH_NEXT_MAX_AGE } from '#/auth/oauth-next'

/* Starts the Discord OAuth dance server-side: the PKCE verifier lands in a
   cookie via the SSR client, the browser bounces to Discord. A ?next= target
   (e.g. the claim flow) is stashed for the callback to return to. */
export const Route = createFileRoute('/auth/login')({
  server: {
    handlers: {
      GET: async () => {
        const url = getRequestUrl({
          xForwardedHost: true,
          xForwardedProto: true,
        })
        const next = safeNextPath(url.searchParams.get('next'))
        setCookie(OAUTH_NEXT_COOKIE, next, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: OAUTH_NEXT_MAX_AGE,
          // Secure in prod (https); off on http://localhost so dev still works.
          secure: url.protocol === 'https:',
        })
        const { data, error } = await supabaseServer().auth.signInWithOAuth({
          provider: 'discord',
          options: { redirectTo: `${url.origin}/auth/callback` },
        })
        if (error || !data.url) {
          return new Response('Sign-in is unavailable right now', {
            status: 502,
          })
        }
        return new Response(null, {
          status: 302,
          headers: { Location: data.url },
        })
      },
    },
  },
})
