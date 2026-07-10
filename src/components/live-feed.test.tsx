import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { LiveFeed } from './live-feed'
import { LiveSignalsContext } from '#/realtime/live-signals-context'
import type { FeedEntry } from './live-feed'

function entry(id: number, vehicleName: string): FeedEntry {
  return {
    id,
    verifiedAt: new Date('2026-07-01T00:00:00Z'),
    kills: 10 + id,
    vehicleSlug: `vehicle-${id}`,
    vehicleName,
    isEvent: false,
    isPremium: false,
    isSquadron: false,
    isRemoved: false,
    playerSlug: `player-${id}`,
    displayName: `Player ${id}`,
    ignSnapshot: null,
    displayNameSnapshot: null,
  }
}

// Server data is newest-first; the log reads downward into the present.
const newestFirst = [entry(3, 'Maus'), entry(2, 'IS-7'), entry(1, 'T-34')]

async function renderFeed(initial: FeedEntry[], { live = false } = {}) {
  let push: (entries: FeedEntry[]) => void = () => {}
  function Harness() {
    const [entries, setEntries] = useState(initial)
    push = setEntries
    return (
      <LiveSignalsContext.Provider value={live}>
        <LiveFeed mode="grb" entries={entries} />
      </LiveSignalsContext.Provider>
    )
  }
  const rootRoute = createRootRoute({ component: Harness })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(<RouterProvider router={router as never} />)
  await view.findByRole('complementary')
  return { ...view, push: (entries: FeedEntry[]) => act(() => push(entries)) }
}

describe('LiveFeed', () => {
  it('renders entries as a log, oldest at the top', async () => {
    const { getAllByRole } = await renderFeed(newestFirst)
    const items = getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('T-34'),
      expect.stringContaining('IS-7'),
      expect.stringContaining('Maus'),
    ])
  })

  it('slots a new record in at the bottom with the just-in treatment', async () => {
    const view = await renderFeed(newestFirst)
    view.push([entry(4, 'Object 279'), ...newestFirst])
    const items = view.getAllByRole('listitem')
    const last = items[items.length - 1]
    expect(last.textContent).toContain('Object 279')
    expect(last.className).toContain('feed-item-new')
  })

  it('holds a displaced record as exiting, then removes it', async () => {
    const view = await renderFeed(newestFirst)
    vi.useFakeTimers()
    try {
      // Refetch after a new record landed: 4 arrives, oldest (1) fell off.
      view.push([entry(4, 'Object 279'), entry(3, 'Maus'), entry(2, 'IS-7')])
      const exiting = view
        .getAllByRole('listitem')
        .find((li) => li.textContent.includes('T-34'))
      expect(exiting?.className).toContain('feed-item-exit')
      act(() => vi.runAllTimers())
      expect(view.queryByText(/T-34/)).toBeNull()
      expect(view.getAllByRole('listitem')).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sweeps each exiting row on its own deadline under a sustained stream', async () => {
    const view = await renderFeed(newestFirst)
    vi.useFakeTimers()
    try {
      view.push([entry(4, 'Object 279'), entry(3, 'Maus'), entry(2, 'IS-7')])
      act(() => vi.advanceTimersByTime(300))
      // A second wave lands mid-fade: it must not extend the first row's stay.
      view.push([
        entry(5, 'Leopard 2A7'),
        entry(4, 'Object 279'),
        entry(3, 'Maus'),
      ])
      act(() => vi.advanceTimersByTime(300))
      expect(view.queryByText(/T-34/)).toBeNull()
      expect(view.queryByText(/IS-7/)).not.toBeNull()
      act(() => vi.advanceTimersByTime(300))
      expect(view.queryByText(/IS-7/)).toBeNull()
      expect(view.getAllByRole('listitem')).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('dims rows with age: the oldest rests fainter than the newest', async () => {
    const { getAllByRole } = await renderFeed(newestFirst)
    const items = getAllByRole('listitem')
    const ageT = (li: HTMLElement) =>
      Number.parseFloat(li.style.getPropertyValue('--feed-age-t'))
    expect(ageT(items[0])).toBeLessThan(ageT(items[2]))
    expect(ageT(items[2])).toBe(1)
  })

  it('renders at most seven rows so no entry can hide clipped from view', async () => {
    const eight = Array.from({ length: 8 }, (_, i) =>
      entry(20 - i, `Vehicle ${20 - i}`),
    )
    const { getAllByRole, queryByText } = await renderFeed(eight)
    expect(getAllByRole('listitem')).toHaveLength(7)
    // The oldest of the eight is the one that never renders.
    expect(queryByText(/Vehicle 13/)).toBeNull()
  })

  it('announces arrivals: the log is a polite live region', async () => {
    const { getByRole } = await renderFeed(newestFirst)
    expect(getByRole('list').getAttribute('aria-live')).toBe('polite')
  })

  it('marks today’s records with the recency accent', async () => {
    const today = { ...entry(9, 'Object 279'), verifiedAt: new Date() }
    const view = await renderFeed([today, ...newestFirst])
    const items = view.getAllByRole('listitem')
    const dateSpan = (li: HTMLElement) => li.querySelector('span')
    expect(dateSpan(items[items.length - 1])?.className).toContain(
      'text-accent-text',
    )
    expect(dateSpan(items[0])?.className).toContain('text-fg-faint')
  })

  it('renders the empty state when no records exist', async () => {
    const view = await renderFeed([])
    expect(view.getByText('No verified records yet.')).toBeDefined()
    expect(view.queryByRole('list')).toBeNull()
  })

  it('shows the live dot only while the subscription is joined', async () => {
    const liveView = await renderFeed(newestFirst, { live: true })
    expect(liveView.container.querySelector('.feed-dot')).not.toBeNull()
    liveView.unmount()
    const deadView = await renderFeed(newestFirst, { live: false })
    expect(deadView.container.querySelector('.feed-dot')).toBeNull()
  })
})
