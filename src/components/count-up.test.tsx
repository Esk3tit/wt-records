import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { CountUp } from './count-up'

/** jsdom evaluates no media query, so the tally's branch is chosen here. */
function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
}

/** Drives the tally by hand, so a case can hand it whatever timestamp it wants
    to prove something about — including one the real clock would never produce
    on the machine running this. */
function scriptedFrames() {
  const frames: Array<(now: number) => void> = []
  vi.stubGlobal('requestAnimationFrame', (fn: (now: number) => void) => {
    frames.push(fn)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  return frames
}

afterEach(() => vi.unstubAllGlobals())

describe('CountUp', () => {
  it('renders the final value under reduced motion, with no tally at all', () => {
    prefersReducedMotion(true)
    const { container } = render(<CountUp value={412} />)

    expect(container.textContent).toBe('412')
  })

  it('groups a four-figure tenure the way the rest of the site states it', () => {
    prefersReducedMotion(true)
    const { container } = render(<CountUp value={1234} />)

    expect(container.textContent).toBe('1,234')
  })

  /* A rAF callback is handed the *frame's* start time, and Chromium's can
     predate the clock read that scheduled it. Unclamped, the quartic ease turns
     those few milliseconds into a negative multiplier and the monument opens on
     `-6 days` — which is not a tenure anybody ever held. */
  it('never opens below zero when the frame predates its own start', () => {
    prefersReducedMotion(false)
    const frames = scriptedFrames()
    const start = performance.now()
    const { container } = render(<CountUp value={412} />)

    expect(frames).toHaveLength(1)
    act(() => frames[0](start - 3))

    expect(container.textContent).toBe('0')
  })

  it('never overshoots the value it is counting to', () => {
    prefersReducedMotion(false)
    const frames = scriptedFrames()
    const start = performance.now()
    render(<CountUp value={412} />)

    const { container } = render(<CountUp value={412} />)
    act(() => frames.at(-1)!(start + 10_000))

    expect(container.textContent).toBe('412')
  })
})
