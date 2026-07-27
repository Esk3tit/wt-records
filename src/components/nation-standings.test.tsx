import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { NationStandings } from './nation-standings'
import type { NationStanding } from '#/db/queries'

function standing(overrides: Partial<NationStanding> = {}): NationStanding {
  return {
    slug: 'italy',
    name: 'Italy',
    eligibleVehicles: 106,
    coveredVehicles: 104,
    completionPct: 98,
    openBounties: 2,
    rank: 1,
    holder: { name: 'CertifiedMonke', slug: 'certifiedmonke', titles: 8 },
    ...overrides,
  }
}

function renderStandings(nations: NationStanding[], contested = true) {
  const rootRoute = createRootRoute({
    component: () => (
      <NationStandings mode="grb" contested={contested} nations={nations} />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

describe('NationStandings', () => {
  it('renders the held count over the total, and what is left on the bar', async () => {
    const { findByText } = renderStandings([standing()])
    expect(await findByText('104')).toBeTruthy()
    expect(await findByText('of 106')).toBeTruthy()
    expect(await findByText('2')).toBeTruthy()
    expect(await findByText('left')).toBeTruthy()
  })

  it('gives ranks 1-3 their metal and leaves the rest in faint ink', async () => {
    const { container, findByText } = renderStandings([
      standing({ slug: 'a', name: 'A', rank: 1 }),
      standing({ slug: 'b', name: 'B', rank: 2 }),
      standing({ slug: 'c', name: 'C', rank: 3 }),
      standing({ slug: 'd', name: 'D', rank: 4 }),
    ])
    await findByText('A')
    for (const metal of ['gold', 'silver', 'bronze'])
      expect(container.querySelector(`.pane-${metal}`)).toBeTruthy()
    // The fourth place wears no metal pane and no metal ink.
    expect(container.querySelectorAll('[class*="pane-"]')).toHaveLength(3)
    expect(container.querySelectorAll('[class*="text-gold"]')).toHaveLength(1)
  })

  it('names the holder and speaks the whole row as a sentence', async () => {
    const { findByText, container } = renderStandings([standing()])
    expect(await findByText('CertifiedMonke')).toBeTruthy()
    expect(await findByText('8 titles')).toBeTruthy()
    // The row must speak as a sentence out of its own visible text — an
    // aria-label would exclude it and break Label in Name (WCAG 2.5.3).
    expect(container.querySelector('a')?.getAttribute('aria-label')).toBeNull()
    expect(
      container.querySelector('a')?.textContent.replace(/\s+/g, ' ').trim(),
    ).toBe(
      'Rank 1, Italy. Most titles: CertifiedMonke, 8 titles. 2 left to claim. 104 of 106 titles held.',
    )
  })

  it('inverts for a mode nobody has scored in: open counts, no places, no bar', async () => {
    const { findByText, queryByText, container } = renderStandings(
      [
        standing({
          slug: 'ussr',
          name: 'USSR',
          eligibleVehicles: 195,
          coveredVehicles: 0,
          completionPct: 0,
          openBounties: 195,
          rank: null,
          holder: null,
        }),
      ],
      false,
    )
    expect(await findByText('195')).toBeTruthy()
    expect(await findByText('open')).toBeTruthy()
    expect(await findByText('Unclaimed')).toBeTruthy()
    expect(queryByText('left')).toBeNull()
    expect(container.querySelector('[class*="pane-"]')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('aria-label')).toBeNull()
    expect(
      container.querySelector('a')?.textContent.replace(/\s+/g, ' ').trim(),
    ).toBe('USSR. Unclaimed. 195 open bounties.')
  })

  it('links each row to that nation’s record wall', async () => {
    const { container, findByText } = renderStandings([standing()])
    await findByText('Italy')
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/grb/nation/italy',
    )
  })

  it('teaches rather than showing a bare pane when the catalog has no nations', async () => {
    const { findByText } = renderStandings([])
    expect(await findByText(/no nations/i)).toBeTruthy()
  })
})
