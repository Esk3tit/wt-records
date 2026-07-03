import { publicEnv } from '#/lib/env'
import type { PublicEnv } from '#/lib/env'

export interface ObservabilityStatus {
  sentry: boolean
  posthog: boolean
}

// Inert seam. The real Sentry + PostHog SDKs and the consent-gated session
// replay are wired in PR3 (PRD §5); until keys are provisioned this no-ops.
// `env` is injectable so the key-present/absent branches are testable.
export function initObservability(
  env: PublicEnv = publicEnv,
): ObservabilityStatus {
  return {
    sentry: Boolean(env.sentryDsn),
    posthog: Boolean(env.posthogKey),
  }
}
