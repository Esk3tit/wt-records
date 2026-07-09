import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { createLiveModeController } from '#/realtime/live-mode-controller'
import {
  realtimeConfigured,
  subscribeToModeSignals,
} from '#/realtime/mode-signals'

// One warning per page session: the 200-connection tripwire (and the deploy
// misconfig case) must be visible in Sentry without spamming it on every
// rejoin attempt or mode change.
let issueReported = false

function reportRealtimeIssue(message: string): void {
  if (issueReported) return
  issueReported = true
  void import('@sentry/react')
    .then((Sentry) => Sentry.captureMessage(message, 'warning'))
    .catch(() => {})
}

// Live-mode signals for one mode-world: subscribes while the tab is visible,
// turns records events into a debounced router.invalidate(), resyncs after any
// dark period, and degrades silently to the static SSR site. Returns whether
// the channel is currently joined.
export function useLiveModeSignals(mode: string, enabled: boolean): boolean {
  const router = useRouter()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled) return
    if (!realtimeConfigured()) {
      reportRealtimeIssue('realtime disabled: VITE_SUPABASE_* env missing')
      return
    }
    const controller = createLiveModeController({
      subscribe: (handlers) =>
        subscribeToModeSignals(mode, {
          onEvent: handlers.onEvent,
          onStatus: (status) => {
            setActive(status === 'subscribed')
            handlers.onStatus(status)
          },
        }),
      invalidate: () => void router.invalidate(),
      onSubscribeError: () =>
        reportRealtimeIssue(`realtime subscribe failed for mode ${mode}`),
    })
    const onVisibility = () => {
      controller.setVisible(document.visibilityState === 'visible')
    }
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      controller.stop()
      setActive(false)
    }
  }, [mode, enabled, router])

  return active
}
