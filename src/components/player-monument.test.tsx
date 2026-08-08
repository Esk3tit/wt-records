import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { PlayerMonument } from './player-monument'
import type { ProfileEnrichmentData } from './profile-enrichment'

const held = {
  vehicleSlug: 'panther-d',
  vehicleName: 'Panther D',
  mode: 'grb',
  heldSeconds: 61 * 86_400,
  lostAt: null,
}

/** jsdom evaluates no media query, so the count-up's branch is chosen here. */
function prefersReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
}

// The monument links the title it names, so it needs a router.
async function renderMonument(props: {
  titlesHeld: number
  longestHeld: ProfileEnrichmentData['longestHeld']
}) {
  const rootRoute = createRootRoute({
    component: () => (
      <main>
        <PlayerMonument {...props} />
      </main>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(<RouterProvider router={router as never} />)
  const monument = await view.findByRole('main')
  return {
    ...view,
    monument,
    numeral: () =>
      monument.querySelector('[data-monument-days]')?.textContent ?? '',
    unit: () => monument.querySelector('.stat-unit')?.textContent ?? '',
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('PlayerMonument', () => {
  it('leads with days at the top and states the titles held beneath it', async () => {
    prefersReducedMotion(true)
    const { monument } = await renderMonument({
      titlesHeld: 3,
      longestHeld: held,
    })
    expect(monument.textContent).toContain('61')
    expect(monument.textContent).toContain('3 titles held now')
  })

  it('says one title in the singular', async () => {
    prefersReducedMotion(true)
    const { monument } = await renderMonument({
      titlesHeld: 1,
      longestHeld: held,
    })
    expect(monument.textContent).toContain('1 title held now')
  })

  it('inverts to the days an ex-holder kept, rather than leaving a hole', async () => {
    prefersReducedMotion(true)
    const { monument } = await renderMonument({
      titlesHeld: 0,
      longestHeld: {
        ...held,
        lostAt: new Date('2026-03-14T00:00:00Z'),
      },
    })
    expect(monument.textContent).toContain('61')
    expect(monument.textContent).toContain('No titles standing')
    // Carried from the stats cell the monument replaces: a closed window is
    // history, or an ex-holder reads as current.
    expect(monument.textContent).toContain('ended Mar 2026')
  })

  it('names no title when the player has never held one', async () => {
    prefersReducedMotion(true)
    const { monument, queryByRole } = await renderMonument({
      titlesHeld: 0,
      longestHeld: null,
    })
    expect(monument.textContent).toContain('No titles standing')
    expect(queryByRole('link')).toBeNull()
  })

  it('counts a brief reign as the day it is, never as a monumental zero', async () => {
    prefersReducedMotion(true)
    const { numeral, unit } = await renderMonument({
      titlesHeld: 1,
      longestHeld: { ...held, heldSeconds: 2 * 3_600 },
    })
    expect(numeral()).toBe('1')
    expect(unit()).toBe('day')
  })

  it('spends no days at the top when no title was ever held', async () => {
    prefersReducedMotion(true)
    const { numeral, unit } = await renderMonument({
      titlesHeld: 0,
      longestHeld: null,
    })
    expect(numeral()).toBe('0')
    expect(unit()).toBe('days')
  })

  it('tallies the numeral up when motion is welcome', async () => {
    prefersReducedMotion(false)
    const { monument } = await renderMonument({
      titlesHeld: 3,
      longestHeld: held,
    })
    // The tally starts from zero; the value is what it arrives at. The wait is
    // generous because the run is 800ms of real frames, not a fake timer.
    expect(monument.textContent).not.toContain('61')
    await waitFor(() => expect(monument.textContent).toContain('61'), {
      timeout: 5_000,
    })
  })

  it('lands the number without the tally under reduced motion', async () => {
    prefersReducedMotion(true)
    const { monument } = await renderMonument({
      titlesHeld: 3,
      longestHeld: held,
    })
    // No frame of animation to wait for — the feat is on the page at once.
    expect(monument.textContent).toContain('61')
  })
})
