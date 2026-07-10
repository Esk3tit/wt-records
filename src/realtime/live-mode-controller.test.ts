import { describe, expect, it, vi } from 'vitest'
import { createLiveModeController } from './live-mode-controller'
import type { ModeSignalHandlers } from './live-mode-controller'

function harness() {
  const unsubscribe = vi.fn()
  const subscriptions: ModeSignalHandlers[] = []
  const subscribe = vi.fn((h: ModeSignalHandlers) => {
    subscriptions.push(h)
    return unsubscribe
  })
  const invalidate = vi.fn()
  return {
    subscribe,
    invalidate,
    unsubscribe,
    subscriptions,
    get handlers() {
      const latest = subscriptions.at(-1)
      if (!latest) throw new Error('not subscribed')
      return latest
    },
  }
}

describe('createLiveModeController', () => {
  it('subscribes when the tab becomes visible', () => {
    const h = harness()
    const controller = createLiveModeController({
      subscribe: h.subscribe,
      invalidate: h.invalidate,
    })
    controller.setVisible(true)
    expect(h.subscribe).toHaveBeenCalledTimes(1)
  })

  it('invalidates once after a records event, debounced', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
        debounceMs: 300,
      })
      controller.setVisible(true)
      h.handlers.onEvent()
      expect(h.invalidate).not.toHaveBeenCalled()
      vi.advanceTimersByTime(300)
      expect(h.invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('coalesces an event burst into a single invalidate', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
        debounceMs: 300,
      })
      controller.setVisible(true)
      h.handlers.onEvent()
      vi.advanceTimersByTime(100)
      h.handlers.onEvent()
      vi.advanceTimersByTime(100)
      h.handlers.onEvent()
      vi.advanceTimersByTime(300)
      expect(h.invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not invalidate on a prompt first join (fresh SSR data)', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
      })
      controller.setVisible(true)
      h.handlers.onStatus('subscribed')
      vi.runAllTimers()
      expect(h.invalidate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resyncs on a first join delayed past the grace window', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
        firstJoinGraceMs: 5_000,
      })
      controller.setVisible(true)
      // Join retries kept the channel down while events may have landed.
      vi.advanceTimersByTime(6_000)
      h.handlers.onStatus('subscribed')
      vi.runAllTimers()
      expect(h.invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('invalidates on a re-subscribe after a connection drop (resync)', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
      })
      controller.setVisible(true)
      h.handlers.onStatus('subscribed')
      h.handlers.onStatus('error')
      h.handlers.onStatus('subscribed')
      vi.runAllTimers()
      expect(h.invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tears down on hidden and drops any pending invalidate', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
      })
      controller.setVisible(true)
      h.handlers.onEvent()
      controller.setVisible(false)
      vi.runAllTimers()
      expect(h.unsubscribe).toHaveBeenCalledTimes(1)
      expect(h.invalidate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resubscribes on return from hidden and resyncs once joined', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
      })
      controller.setVisible(true)
      h.handlers.onStatus('subscribed')
      controller.setVisible(false)
      controller.setVisible(true)
      expect(h.subscribe).toHaveBeenCalledTimes(2)
      h.handlers.onStatus('subscribed')
      vi.runAllTimers()
      expect(h.invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores repeated setVisible(true) while already subscribed', () => {
    const h = harness()
    const controller = createLiveModeController({
      subscribe: h.subscribe,
      invalidate: h.invalidate,
    })
    controller.setVisible(true)
    controller.setVisible(true)
    expect(h.subscribe).toHaveBeenCalledTimes(1)
  })

  it('reports joined state and ignores a torn-down channel’s late callbacks', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const activeChanges: boolean[] = []
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
        onActiveChange: (active) => activeChanges.push(active),
      })
      controller.setVisible(true)
      const stale = h.handlers
      stale.onStatus('subscribed')
      controller.setVisible(false)
      controller.setVisible(true)
      h.handlers.onStatus('subscribed')
      // supabase emits CLOSED asynchronously after removeChannel.
      stale.onStatus('closed')
      stale.onEvent()
      vi.runAllTimers()
      expect(activeChanges).toEqual([true, false, true])
      // Only the live channel's resync ran; the stale event scheduled nothing.
      expect(h.invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('forwards every subscribe error; dedupe belongs to the reporter', () => {
    const h = harness()
    const onSubscribeError = vi.fn()
    const controller = createLiveModeController({
      subscribe: h.subscribe,
      invalidate: h.invalidate,
      onSubscribeError,
    })
    controller.setVisible(true)
    h.handlers.onStatus('error')
    h.handlers.onStatus('error')
    expect(onSubscribeError).toHaveBeenCalledTimes(2)
  })

  it('stop() tears down and goes dead: later events and visibility do nothing', () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const controller = createLiveModeController({
        subscribe: h.subscribe,
        invalidate: h.invalidate,
      })
      controller.setVisible(true)
      const { handlers } = h
      handlers.onEvent()
      controller.stop()
      handlers.onEvent()
      controller.setVisible(true)
      vi.runAllTimers()
      expect(h.unsubscribe).toHaveBeenCalledTimes(1)
      expect(h.invalidate).not.toHaveBeenCalled()
      expect(h.subscribe).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
