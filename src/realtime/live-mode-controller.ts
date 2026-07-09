export type SignalStatus = 'subscribed' | 'error' | 'closed'

export interface ModeSignalHandlers {
  onEvent: () => void
  onStatus: (status: SignalStatus) => void
}

export interface LiveModeControllerOptions {
  subscribe: (handlers: ModeSignalHandlers) => () => void
  invalidate: () => void
  onSubscribeError?: () => void
  debounceMs?: number
}

export interface LiveModeController {
  setVisible: (visible: boolean) => void
  stop: () => void
}

const DEFAULT_DEBOUNCE_MS = 300

// Visibility-aware lifecycle around one mode-signals subscription: debounces
// events into router invalidations, resyncs after any dark period (hidden tab
// or dropped connection), and reports channel failure once per page.
export function createLiveModeController(
  options: LiveModeControllerOptions,
): LiveModeController {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  let everSubscribed = false
  let errorReported = false
  let stopped = false

  const scheduleInvalidate = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      options.invalidate()
    }, debounceMs)
  }

  const cancelInvalidate = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const teardown = () => {
    cancelInvalidate()
    unsubscribe?.()
    unsubscribe = undefined
  }

  const handlers: ModeSignalHandlers = {
    onEvent() {
      if (stopped || unsubscribe === undefined) return
      scheduleInvalidate()
    },
    onStatus(status) {
      if (stopped) return
      if (status === 'error') {
        if (!errorReported) {
          errorReported = true
          options.onSubscribeError?.()
        }
        return
      }
      if (status !== 'subscribed') return
      // The first join serves fresh SSR data; only rejoins can have missed
      // events and need a resync.
      if (everSubscribed) scheduleInvalidate()
      everSubscribed = true
    },
  }

  return {
    setVisible(visible) {
      if (stopped) return
      if (visible) {
        unsubscribe ??= options.subscribe(handlers)
      } else {
        teardown()
      }
    },
    stop() {
      if (stopped) return
      stopped = true
      teardown()
    },
  }
}
