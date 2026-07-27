import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { HolderCell, LedgerPane, VehicleCell } from './catalog-ledger'
import type { IllustratedRow } from './catalog-ledger'

function row(overrides: Partial<IllustratedRow> = {}): IllustratedRow {
  return {
    vehicleSlug: 'm4a1',
    vehicleName: 'M4A1',
    isDifficult: false,
    isEvent: false,
    isPremium: false,
    isSquadron: false,
    isRemoved: false,
    nationSlug: 'france',
    nationName: 'France',
    br: 3.7,
    kills: 26,
    playerSlug: 'koalkiest',
    displayName: 'Koalkiest',
    ignSnapshot: null,
    displayNameSnapshot: null,
    vehicleImage: null,
    holderAvatar: null,
    ...overrides,
  }
}

function renderRow(r: IllustratedRow) {
  const rootRoute = createRootRoute({
    component: () => (
      <LedgerPane>
        <tbody>
          <tr>
            <VehicleCell mode="grb" row={r} nationChip="mobile" />
            <HolderCell row={r} />
          </tr>
        </tbody>
      </LedgerPane>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

describe('ledger row imagery', () => {
  it('renders the vehicle art decoratively — the name already says which one', async () => {
    const { container, findByRole } = renderRow(
      row({ vehicleImage: 'https://assets.example/m4a1.png' }),
    )
    await findByRole('link', { name: 'M4A1' })
    const img = container.querySelector('img[src*="m4a1"]')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('alt')).toBe('')
  })

  it('keeps the art slot when the catalog has no image yet', async () => {
    const { container, findByRole } = renderRow(row())
    await findByRole('link', { name: 'M4A1' })
    expect(container.querySelector('.vehicle-icon-ledger')).toBeTruthy()
  })

  it('falls back to the Medallion for a Holder with no Avatar', async () => {
    const { findAllByRole } = renderRow(row())
    const marks = await findAllByRole('img', { name: /no avatar set/i })
    expect(marks.length).toBeGreaterThan(0)
  })

  it('shows the Avatar when the Holder has claimed one', async () => {
    const { findAllByRole } = renderRow(
      row({ holderAvatar: 'https://assets.example/koalkiest.png' }),
    )
    const avatars = await findAllByRole('img', { name: /Koalkiest's avatar/i })
    expect(avatars.length).toBeGreaterThan(0)
  })

  it('repeats the Holder inside the name cell, for the widths that fold it', async () => {
    const { container, findByRole } = renderRow(row())
    await findByRole('link', { name: 'M4A1' })
    const [vehicleCell, holderCell] = container.querySelectorAll('td')
    // The folded line lives in the vehicle cell; the Holder column carries the
    // same name and is the one hidden below md.
    expect(vehicleCell.textContent).toContain('Koalkiest')
    expect(holderCell.className).toContain('hidden')
    expect(holderCell.className).toContain('md:table-cell')
  })

  it('marks an unheld title as an open bounty on both widths', async () => {
    const { container, findAllByText } = renderRow(
      row({ kills: null, playerSlug: null, displayName: null }),
    )
    expect((await findAllByText(/open bounty/i)).length).toBe(2)
    expect(container.textContent).not.toContain('Koalkiest')
  })
})
