import { describe, expect, it, vi } from 'vitest'
import { subscribeToModeSignals } from './mode-signals'

const supabaseImport = { failNext: false }
const statusCallbacks: Array<(status: string) => void> = []

vi.mock('#/lib/env', () => ({
  publicEnv: { supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'anon' },
}))

vi.mock('@supabase/supabase-js', () => {
  if (supabaseImport.failNext) {
    supabaseImport.failNext = false
    throw new Error('chunk load failed')
  }
  const channel = {
    on: vi.fn(function (this: unknown) {
      return this
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      statusCallbacks.push(cb)
      return channel
    }),
  }
  return {
    createClient: vi.fn(() => ({
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    })),
  }
})

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('subscribeToModeSignals', () => {
  it('retries the client import after a failed chunk load', async () => {
    supabaseImport.failNext = true
    const onStatus = vi.fn()
    subscribeToModeSignals('br', { onEvent: vi.fn(), onStatus })
    await flush()
    expect(onStatus).toHaveBeenCalledWith('error')

    const onStatusRetry = vi.fn()
    subscribeToModeSignals('br', { onEvent: vi.fn(), onStatus: onStatusRetry })
    await flush()
    statusCallbacks.at(-1)?.('SUBSCRIBED')
    expect(onStatusRetry).toHaveBeenCalledWith('subscribed')
  })
})
