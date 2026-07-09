import { describe, expect, it, vi } from 'vitest'
import { createLiveModeController } from './live-mode-controller'
import type { ModeSignalHandlers } from './live-mode-controller'

function harness() {
  const unsubscribe = vi.fn()
  let handlers: ModeSignalHandlers | undefined
  const subscribe = vi.fn((h: ModeSignalHandlers) => {
    handlers = h
    return unsubscribe
  })
  const invalidate = vi.fn()
  return {
    subscribe,
    invalidate,
    unsubscribe,
    get handlers() {
      if (!handlers) throw new Error('not subscribed')
      return handlers
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

  it('does not invalidate on the initial subscribed status (fresh SSR data)', () => {
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

  it('reports a subscribe error once, however often the channel fails', () => {
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
    expect(onSubscribeError).toHaveBeenCalledTimes(1)
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
