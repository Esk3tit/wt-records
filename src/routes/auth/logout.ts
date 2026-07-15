import { createFileRoute } from '@tanstack/react-router'
import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'
import { supabaseServer } from '#/auth/supabase-server'

export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      // POST: signing out is a state change; links must not trigger it.
      POST: async () => {
        // Lightweight CSRF defence: browsers send Origin on form POSTs, so a
        // cross-site form can't force-sign a moderator out.
        const origin = getRequestUrl({
          xForwardedHost: true,
          xForwardedProto: true,
        }).origin
        const requestOrigin = getRequestHeader('origin')
        if (requestOrigin && requestOrigin !== origin) {
          return new Response('Forbidden', { status: 403 })
        }
        await supabaseServer().auth.signOut({ scope: 'local' })
        return new Response(null, { status: 303, headers: { Location: '/' } })
      },
    },
  },
})
