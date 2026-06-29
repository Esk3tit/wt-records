import { describe, expect, it } from 'vitest'
import { initObservability } from '#/lib/observability'
import type { PublicEnv } from '#/lib/env'

const absent: PublicEnv = { sentryDsn: undefined, posthogKey: undefined, posthogHost: undefined }

describe('initObservability', () => {
  it('activates both providers when their keys are present', () => {
    const env: PublicEnv = {
      sentryDsn: 'https://k@o.ingest.sentry.io/1',
      posthogKey: 'phc_abc',
      posthogHost: 'https://us.i.posthog.com',
    }
    expect(initObservability(env)).toEqual({ sentry: true, posthog: true })
  })

  it('activates neither provider when keys are absent', () => {
    expect(initObservability(absent)).toEqual({ sentry: false, posthog: false })
  })

  it('activates only the provider whose key is set', () => {
    expect(initObservability({ ...absent, sentryDsn: 'https://k@o.ingest.sentry.io/1' })).toEqual({
      sentry: true,
      posthog: false,
    })
  })
})
