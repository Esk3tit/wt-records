import { describe, expect, it } from 'vitest'
import { observabilityStatus } from '#/lib/observability'
import type { PublicEnv } from '#/lib/env'

const absent: PublicEnv = {
  sentryDsn: undefined,
  posthogKey: undefined,
  posthogHost: undefined,
  supabaseUrl: undefined,
  supabaseAnonKey: undefined,
}

describe('observabilityStatus', () => {
  it('reports both providers configured when their keys are present', () => {
    const env: PublicEnv = {
      ...absent,
      sentryDsn: 'https://k@o.ingest.sentry.io/1',
      posthogKey: 'phc_abc',
      posthogHost: 'https://us.i.posthog.com',
    }
    expect(observabilityStatus(env)).toEqual({ sentry: true, posthog: true })
  })

  it('reports neither configured when keys are absent', () => {
    expect(observabilityStatus(absent)).toEqual({
      sentry: false,
      posthog: false,
    })
  })

  it('reports only the provider whose key is set', () => {
    expect(
      observabilityStatus({
        ...absent,
        sentryDsn: 'https://k@o.ingest.sentry.io/1',
      }),
    ).toEqual({
      sentry: true,
      posthog: false,
    })
  })
})
