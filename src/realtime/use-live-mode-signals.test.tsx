import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { useLiveModeSignals } from './use-live-mode-signals'
import type { ModeSignalHandlers } from './live-mode-controller'
import {
  realtimeConfigured,
  subscribeToModeSignals,
} from '#/realtime/mode-signals'

vi.mock('#/realtime/mode-signals', () => ({
  realtimeConfigured: vi.fn(),
  subscribeToModeSignals: vi.fn(),
}))

const configured = vi.mocked(realtimeConfigured)
const subscribe = vi.mocked(subscribeToModeSignals)

let handlersLog: ModeSignalHandlers[] = []
let unsubscribe = vi.fn()

function latestHandlers(): ModeSignalHandlers {
  const latest = handlersLog.at(-1)
  if (!latest) throw new Error('not subscribed')
  return latest
}

async function renderLiveSignals(mode: string, enabled: boolean) {
  const result = { current: false }
  function Probe() {
    result.current = useLiveModeSignals(mode, enabled)
    return <div data-testid="probe" />
  }
  const rootRoute = createRootRoute({ component: Probe })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(<RouterProvider router={router as never} />)
  await view.findByTestId('probe')
  return { result, router, unmount: view.unmount }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  handlersLog = []
  unsubscribe = vi.fn()
  configured.mockReturnValue(true)
  subscribe.mockImplementation((_mode, handlers) => {
    handlersLog.push(handlers)
    return unsubscribe
  })
})

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('useLiveModeSignals', () => {
  it('does not subscribe when disabled', async () => {
    const { result } = await renderLiveSignals('arcade', false)
    expect(subscribe).not.toHaveBeenCalled()
    expect(result.current).toBe(false)
  })

  it('does not subscribe when realtime is unconfigured', async () => {
    configured.mockReturnValue(false)
    const { result } = await renderLiveSignals('arcade', true)
    expect(subscribe).not.toHaveBeenCalled()
    expect(result.current).toBe(false)
  })

  it('subscribes for the mode and reports active once the channel joins', async () => {
    const { result } = await renderLiveSignals('arcade', true)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith('arcade', expect.anything())
    expect(result.current).toBe(false)
    act(() => latestHandlers().onStatus('subscribed'))
    expect(result.current).toBe(true)
  })

  it('invalidates the router after a records event', async () => {
    const { router } = await renderLiveSignals('arcade', true)
    const invalidate = vi
      .spyOn(router, 'invalidate')
      .mockResolvedValue(undefined)
    act(() => latestHandlers().onStatus('subscribed'))
    vi.useFakeTimers()
    try {
      act(() => latestHandlers().onEvent())
      expect(invalidate).not.toHaveBeenCalled()
      act(() => void vi.runAllTimers())
      expect(invalidate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tears down when the tab hides and resubscribes when it shows again', async () => {
    const { result } = await renderLiveSignals('arcade', true)
    act(() => latestHandlers().onStatus('subscribed'))
    setVisibility('hidden')
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(result.current).toBe(false)
    setVisibility('visible')
    expect(subscribe).toHaveBeenCalledTimes(2)
  })

  it('stops the channel and ignores visibility changes after unmount', async () => {
    const { unmount } = await renderLiveSignals('arcade', true)
    act(() => latestHandlers().onStatus('subscribed'))
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    setVisibility('hidden')
    setVisibility('visible')
    expect(subscribe).toHaveBeenCalledTimes(1)
  })
})
