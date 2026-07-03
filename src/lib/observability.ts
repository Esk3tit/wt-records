import type { PostHog } from 'posthog-js'
import { publicEnv } from '#/lib/env'
import type { PublicEnv } from '#/lib/env'
import { readConsent } from '#/lib/consent'

export interface ObservabilityStatus {
  sentry: boolean
  posthog: boolean
}

// Shared PostHog project across apps — every event and replay carries this so
// WT Records data is separable from the other apps on the project.
const APP_TAG = 'wt-records'

// Which providers are configured (keys present). Pure — the side-effecting boot
// lives in `startObservability`.
export function observabilityStatus(
  env: PublicEnv = publicEnv,
): ObservabilityStatus {
  return {
    sentry: Boolean(env.sentryDsn),
    posthog: Boolean(env.posthogKey),
  }
}

let posthog: PostHog | undefined

// Boots the configured SDKs in the browser. Sentry (error + performance) starts
// immediately — it sets no tracking cookies. PostHog starts opted-out with
// replay off; analytics + session replay turn on only via `grantConsent`.
export function startObservability(
  env: PublicEnv = publicEnv,
): ObservabilityStatus {
  const status = observabilityStatus(env)
  if (typeof window === 'undefined') return status
  if (status.sentry) void initSentry(env.sentryDsn!).catch(() => {})
  if (status.posthog) void initAnalytics(env).catch(() => {})
  return status
}

async function initSentry(dsn: string): Promise<void> {
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

async function initAnalytics(env: PublicEnv): Promise<void> {
  const key = env.posthogKey
  if (!key) return
  const { default: ph } = await import('posthog-js')
  ph.init(key, {
    api_host: env.posthogHost ?? 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: true,
    // Write no cookies/localStorage until opt-in — persistence turns on with
    // opt_in_capturing(). Without this, init sets a distinct_id pre-consent.
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    disable_session_recording: true,
    session_recording: { maskAllInputs: true },
  })
  ph.register({ app: APP_TAG })
  posthog = ph
  if (readConsent() === 'granted') enableAnalytics()
}

function enableAnalytics(): void {
  if (!posthog) return
  posthog.opt_in_capturing()
  posthog.startSessionRecording()
  // The init-time pageview was suppressed while opted out; emit the landing one.
  posthog.capture('$pageview')
}

// Called by the consent banner. Safe to call before the async PostHog init
// resolves — `readConsent()` inside `initAnalytics` catches that race.
export function grantConsent(): void {
  enableAnalytics()
}

export function revokeConsent(): void {
  if (!posthog) return
  posthog.opt_out_capturing()
  posthog.stopSessionRecording()
}
