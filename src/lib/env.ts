export interface PublicEnv {
  sentryDsn: string | undefined
  posthogKey: string | undefined
  posthogHost: string | undefined
  supabaseUrl: string | undefined
  supabaseAnonKey: string | undefined
}

export const publicEnv: PublicEnv = {
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  posthogKey: import.meta.env.VITE_POSTHOG_KEY,
  posthogHost: import.meta.env.VITE_POSTHOG_HOST,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
}
