import { publicEnv } from '#/lib/env'

export interface ObservabilityStatus {
  sentry: boolean
  posthog: boolean
}

// Inert seam. The real Sentry + PostHog SDKs and the consent-gated session
// replay are wired in PR3 (PRD §5); until keys are provisioned this no-ops.
export function initObservability(): ObservabilityStatus {
  return {
    sentry: Boolean(publicEnv.sentryDsn),
    posthog: Boolean(publicEnv.posthogKey),
  }
}
