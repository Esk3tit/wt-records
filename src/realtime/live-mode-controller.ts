export type SignalStatus = 'subscribed' | 'error' | 'closed'

export interface ModeSignalHandlers {
  onEvent: () => void
  onStatus: (status: SignalStatus) => void
}

export interface LiveModeControllerOptions {
  subscribe: (handlers: ModeSignalHandlers) => () => void
  invalidate: () => void
  onActiveChange?: (active: boolean) => void
  onSubscribeError?: () => void
  debounceMs?: number
  firstJoinGraceMs?: number
}

export interface LiveModeController {
  setVisible: (visible: boolean) => void
  stop: () => void
}

const DEFAULT_DEBOUNCE_MS = 300
const DEFAULT_FIRST_JOIN_GRACE_MS = 5_000

export function createLiveModeController(
  options: LiveModeControllerOptions,
): LiveModeController {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const firstJoinGraceMs =
    options.firstJoinGraceMs ?? DEFAULT_FIRST_JOIN_GRACE_MS
  const createdAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | undefined
  // Bumped on every open/teardown so a torn-down channel's late async
  // callbacks (supabase emits CLOSED after removeChannel) can't act.
  let joinSeq = 0
  let everSubscribed = false
  let active = false
  let stopped = false

  const scheduleInvalidate = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      options.invalidate()
    }, debounceMs)
  }

  const setActive = (next: boolean) => {
    if (active === next) return
    active = next
    options.onActiveChange?.(next)
  }

  const teardown = () => {
    joinSeq += 1
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    unsubscribe?.()
    unsubscribe = undefined
    setActive(false)
  }

  const open = () => {
    const seq = ++joinSeq
    unsubscribe = options.subscribe({
      onEvent() {
        if (seq !== joinSeq) return
        scheduleInvalidate()
      },
      onStatus(status) {
        if (seq !== joinSeq) return
        if (status !== 'subscribed') {
          setActive(false)
          if (status === 'error') options.onSubscribeError?.()
          return
        }
        setActive(true)
        // Only a prompt first join can trust the SSR data; rejoins and
        // delayed first joins may have missed events and need a resync.
        const delayed = Date.now() - createdAt > firstJoinGraceMs
        if (everSubscribed || delayed) scheduleInvalidate()
        everSubscribed = true
      },
    })
  }

  return {
    setVisible(visible) {
      if (stopped) return
      if (visible) {
        if (unsubscribe === undefined) open()
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
