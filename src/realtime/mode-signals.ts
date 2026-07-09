import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '#/lib/env'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModeSignalHandlers } from '#/realtime/live-mode-controller'

// The browser Supabase client exists ONLY for Realtime signals (ADR 0006,
// ADR 0002): event payloads are ignored and no data is ever read through it.
let client: SupabaseClient | null | undefined

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const { supabaseUrl, supabaseAnonKey } = publicEnv
  client =
    supabaseUrl && supabaseAnonKey
      ? createClient(supabaseUrl, supabaseAnonKey, {
          // Anon-only: never touch auth storage (no session, no cookies).
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null
  return client
}

export function realtimeConfigured(): boolean {
  return getClient() !== null
}

// Unique topic per subscription: an unmount/remount pair (visibility flips,
// React strict effects) must never collide on the same channel topic.
let channelSeq = 0

export function subscribeToModeSignals(
  mode: string,
  handlers: ModeSignalHandlers,
): () => void {
  const supabase = getClient()
  if (!supabase) return () => {}
  channelSeq += 1
  const channel = supabase
    .channel(`records:${mode}:${channelSeq}`)
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
  return () => {
    void supabase.removeChannel(channel)
  }
}
