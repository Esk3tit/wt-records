import { describe, expect, it, vi } from 'vitest'
import { subscribeToModeSignals } from './mode-signals'

const supabaseImport = { failNext: false }
const statusCallbacks: Array<(status: string) => void> = []
const eventCallbacks: Array<(payload: unknown) => void> = []

vi.mock('#/lib/env', () => ({
  publicEnv: { supabaseUrl: 'http://localhost:54321', supabaseAnonKey: 'anon' },
}))

vi.mock('@supabase/supabase-js', () => {
  if (supabaseImport.failNext) {
    supabaseImport.failNext = false
    throw new Error('chunk load failed')
  }
  const channel = {
    on: vi.fn(function (
      this: unknown,
      _type: string,
      _opts: unknown,
      cb: (payload: unknown) => void,
    ) {
      eventCallbacks.push(cb)
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

  it('scopes events by mode client-side, signaling unknown-mode payloads', async () => {
    const onEvent = vi.fn()
    subscribeToModeSignals('grb', { onEvent, onStatus: vi.fn() })
    await flush()
    const emit = eventCallbacks.at(-1)
    emit?.({ new: { id: 1, mode: 'grb' }, old: {} })
    expect(onEvent).toHaveBeenCalledTimes(1)
    // Another mode's record must not invalidate this mode-world.
    emit?.({ new: { id: 2, mode: 'arb' }, old: {} })
    expect(onEvent).toHaveBeenCalledTimes(1)
    // DELETE payloads carry only the PK — no readable mode, still a signal.
    emit?.({ new: {}, old: { id: 3 } })
    expect(onEvent).toHaveBeenCalledTimes(2)
  })
})
