import { describe, expect, it, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { NationGrid } from './nation-grid'
import type { NationGridRow } from './nation-grid'

function row(overrides: Partial<NationGridRow> = {}): NationGridRow {
  return {
    vehicleSlug: 'm2a4',
    vehicleName: 'M2A4',
    isDifficult: false,
    isEvent: false,
    isPremium: false,
    isSquadron: false,
    isRemoved: false,
    nationSlug: 'usa',
    nationName: 'USA',
    br: 1.0,
    kills: 34,
    playerSlug: 'koalkiest',
    displayName: 'Koalkiest',
    ignSnapshot: null,
    displayNameSnapshot: null,
    rank: 1,
    class: 'light_tank',
    vehicleImage: null,
    ...overrides,
  }
}

function renderGrid(
  rows: NationGridRow[],
  { hasFilters = false, onReset = () => {} } = {},
) {
  const rootRoute = createRootRoute({
    component: () => (
      <NationGrid
        mode="grb"
        rows={rows}
        hasFilters={hasFilters}
        onReset={onReset}
      />
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

describe('NationGrid', () => {
  it('splits acquisition-flagged and removed vehicles into the special wall', async () => {
    const { findByText, getAllByText } = renderGrid([
      row(),
      row({ vehicleSlug: 'p', vehicleName: 'Premium One', isPremium: true }),
      row({ vehicleSlug: 'r', vehicleName: 'Removed One', isRemoved: true }),
    ])
    await findByText('Tech tree')
    // Wall header at xl plus the stacked-layout band label both name the wall.
    expect(getAllByText('Premium & special').length).toBeGreaterThan(0)
    // One shared rank row: both walls carry a Rank I rule with their own count.
    expect(getAllByText('Rank I')).toHaveLength(2)
    expect(await findByText('1 of 1 held')).toBeTruthy()
    expect(await findByText('2 of 2 held')).toBeTruthy()
  })

  it('keeps the removed tag on special-wall cards but drops premium chips there', async () => {
    const { findByText, queryByText } = renderGrid([
      row({
        vehicleSlug: 'x',
        vehicleName: 'Panther X',
        isPremium: true,
        isRemoved: true,
      }),
    ])
    await findByText('removed')
    expect(queryByText('premium')).toBeNull()
  })

  it('renders a held record line and an open bounty state', async () => {
    const { findByText } = renderGrid([
      row(),
      row({
        vehicleSlug: 'open',
        vehicleName: 'Open One',
        kills: null,
        playerSlug: null,
        displayName: null,
      }),
    ])
    expect(await findByText('34')).toBeTruthy()
    expect(await findByText('Koalkiest')).toBeTruthy()
    expect(await findByText('Open bounty')).toBeTruthy()
  })

  it('renders no empty tech-tree rule when a rank is special-only', async () => {
    const { findByText, getAllByText, queryByText } = renderGrid([
      row({ vehicleSlug: 'p1', vehicleName: 'Premium One', isPremium: true }),
      row({
        vehicleSlug: 'p2',
        vehicleName: 'Premium Two',
        isPremium: true,
        rank: 2,
      }),
    ])
    await findByText('Premium One')
    expect(queryByText('0 of 0 held')).toBeNull()
    expect(getAllByText(/^Rank/)).toHaveLength(2)
  })

  it('marks difficult vehicles and names acquisition for assistive tech', async () => {
    const { findAllByRole } = renderGrid([
      row({
        vehicleSlug: 'd',
        vehicleName: 'Difficult One',
        isDifficult: true,
        isSquadron: true,
      }),
      row({
        vehicleSlug: 'both',
        vehicleName: 'Both One',
        isPremium: true,
        isSquadron: true,
      }),
    ])
    const cards = await findAllByRole('article')
    const difficult = cards.find((c) => within(c).queryByText('Difficult One'))
    expect(difficult).toBeTruthy()
    expect(
      within(difficult!).getByTitle(
        'Difficult vehicle — higher qualifying kill bar',
      ),
    ).toBeTruthy()
    expect(within(difficult!).getByText('Squadron vehicle')).toBeTruthy()
    const both = cards.find((c) => within(c).queryByText('Both One'))
    expect(both).toBeTruthy()
    const label = within(both!).getByText('Premium vehicle, Squadron vehicle')
    expect(label.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('carries name snapshots through to the record line', async () => {
    const { findByText } = renderGrid([row({ ignSnapshot: 'OldIGN' })])
    expect(await findByText('as «OldIGN»')).toBeTruthy()
  })

  it('renders no special wall when every vehicle is tech tree', async () => {
    const { findByText, queryByText } = renderGrid([row()])
    await findByText('34')
    expect(queryByText('Premium & special')).toBeNull()
    expect(queryByText('Tech tree')).toBeNull()
  })

  it('offers a reset only when filters caused the empty sheet', async () => {
    const onReset = vi.fn()
    const { findByRole } = renderGrid([], { hasFilters: true, onReset })
    const button = await findByRole('button', { name: 'Reset filters' })
    button.click()
    expect(onReset).toHaveBeenCalled()
  })
})
