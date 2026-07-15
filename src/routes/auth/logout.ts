import { createFileRoute } from '@tanstack/react-router'
import { supabaseServer } from '#/auth/supabase-server'

export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      // POST: signing out is a state change; links must not trigger it.
      POST: async () => {
        await supabaseServer().auth.signOut({ scope: 'local' })
        return new Response(null, { status: 303, headers: { Location: '/' } })
      },
    },
  },
})
