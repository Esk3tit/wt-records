import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { createLiveModeController } from '#/realtime/live-mode-controller'
import {
  realtimeConfigured,
  subscribeToModeSignals,
} from '#/realtime/mode-signals'
import { captureWarningOnce } from '#/lib/observability'

// Live signals for one mode-world; returns whether the channel is joined.
// Unconfigured env is a supported state and degrades silently by design.
export function useLiveModeSignals(mode: string, enabled: boolean): boolean {
  const router = useRouter()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled || !realtimeConfigured()) return
    const controller = createLiveModeController({
      subscribe: (handlers) => subscribeToModeSignals(mode, handlers),
      invalidate: () => void router.invalidate(),
      onActiveChange: setActive,
      onSubscribeError: () =>
        captureWarningOnce(`realtime subscribe failed for mode ${mode}`),
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
