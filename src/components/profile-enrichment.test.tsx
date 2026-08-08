import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { ProfileEnrichment } from './profile-enrichment'
import type { ProfileEnrichmentData } from './profile-enrichment'

const held = {
  vehicleSlug: 'panther-d',
  vehicleName: 'Panther D',
  mode: 'grb',
  heldSeconds: 412 * 86_400,
  lostAt: null,
}

// The strip renders links, so it needs a router; the landmark gives the async
// first render something to settle on (and the empty case something to read).
async function renderStrip(stats: ProfileEnrichmentData) {
  const rootRoute = createRootRoute({
    component: () => (
      <main>
        <ProfileEnrichment stats={stats} />
      </main>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(<RouterProvider router={router as never} />)
  return { ...view, strip: await view.findByRole('main') }
}

describe('ProfileEnrichment', () => {
  it('shows the spread and the latest verification', async () => {
    const { strip, getByText } = await renderStrip({
      nationSpread: [
        { slug: 'usa', name: 'USA', records: 2 },
        { slug: 'germany', name: 'Germany', records: 1 },
      ],
      longestHeld: held,
      lastVerifiedAt: new Date(Date.now() - 2 * 86_400_000),
    })
    expect(getByText('2 days ago')).toBeDefined()
    // Flags are decorative; the nation still reaches a screen reader.
    expect(strip.textContent).toContain('USA')
    expect(strip.textContent).toContain('Germany')
  })

  it('leaves the longest tenure to the monument, which now says it', async () => {
    const { strip } = await renderStrip({
      nationSpread: [],
      longestHeld: { ...held, lostAt: new Date('2026-03-14T00:00:00Z') },
      lastVerifiedAt: null,
    })
    expect(strip.textContent).toBe('')
  })

  it('names a nation that has no flag art rather than showing a bare count', async () => {
    const { getByText } = await renderStrip({
      nationSpread: [{ slug: 'atlantis', name: 'Atlantis', records: 4 }],
      longestHeld: null,
      lastVerifiedAt: null,
    })
    expect(getByText('Atlantis')).toBeDefined()
  })

  it('says nothing at all when there is nothing verified to say', async () => {
    const { strip } = await renderStrip({
      nationSpread: [],
      longestHeld: null,
      lastVerifiedAt: null,
    })
    expect(strip.textContent).toBe('')
  })
})
