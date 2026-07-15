import { createFileRoute } from '@tanstack/react-router'
import { getRequestUrl } from '@tanstack/react-start/server'
import { supabaseServer } from '#/auth/supabase-server'

/* Starts the Discord OAuth dance server-side: the PKCE verifier lands in a
   cookie via the SSR client, the browser bounces to Discord. */
export const Route = createFileRoute('/auth/login')({
  server: {
    handlers: {
      GET: async () => {
        const origin = getRequestUrl({
          xForwardedHost: true,
          xForwardedProto: true,
        }).origin
        const { data, error } = await supabaseServer().auth.signInWithOAuth({
          provider: 'discord',
          options: { redirectTo: `${origin}/auth/callback` },
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
