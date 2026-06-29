import { describe, expect, it } from 'vitest'
import { initObservability } from '#/lib/observability'
import { publicEnv } from '#/lib/env'

describe('initObservability', () => {
  it('reports provider activation strictly from provisioned keys', () => {
    const status = initObservability()
    expect(status).toEqual({
      sentry: Boolean(publicEnv.sentryDsn),
      posthog: Boolean(publicEnv.posthogKey),
    })
  })
})
