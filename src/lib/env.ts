export interface PublicEnv {
  sentryDsn: string | undefined
  posthogKey: string | undefined
  posthogHost: string | undefined
}

export const publicEnv: PublicEnv = {
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  posthogKey: import.meta.env.VITE_POSTHOG_KEY,
  posthogHost: import.meta.env.VITE_POSTHOG_HOST,
}
