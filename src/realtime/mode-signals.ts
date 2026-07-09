import { publicEnv } from '#/lib/env'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModeSignalHandlers } from '#/realtime/live-mode-controller'

// The browser Supabase client exists only to carry Realtime signals — event
// payloads are ignored and no data is ever read through it.
let clientPromise: Promise<SupabaseClient> | undefined

export function realtimeConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)
}

function getClient(): Promise<SupabaseClient> {
  // On-demand: ~50kB gzip that belongs in neither the route chunk nor SSR.
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(publicEnv.supabaseUrl!, publicEnv.supabaseAnonKey!, {
      // Anon-only: never touch auth storage (no session, no cookies).
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  )
  return clientPromise
}

// Unique topic per subscription: an unmount/remount pair (visibility flips,
// React strict effects) must never collide on the same channel topic.
let channelSeq = 0

export function subscribeToModeSignals(
  mode: string,
  handlers: ModeSignalHandlers,
): () => void {
  if (!realtimeConfigured()) return () => {}
  channelSeq += 1
  const topic = `records:${mode}:${channelSeq}`
  let cancelled = false
  let teardown: (() => void) | undefined
  getClient()
    .then((supabase) => {
      if (cancelled) return
      const channel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'records',
            filter: `mode=eq.${mode}`,
          },
          () => handlers.onEvent(),
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') handlers.onStatus('subscribed')
          else if (status === 'CLOSED') handlers.onStatus('closed')
          else handlers.onStatus('error')
        })
      teardown = () => void supabase.removeChannel(channel)
    })
    // A failed chunk load (ad-blocker, flaky CDN) is a failed subscription.
    .catch(() => handlers.onStatus('error'))
  return () => {
    cancelled = true
    teardown?.()
  }
}
