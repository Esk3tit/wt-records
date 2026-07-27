import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { SPOTLIGHT_MIN_ROWS, Spotlight, spotlightVisible } from './spotlight'
import type { RecordCardRow } from './record-card'

function row(overrides: Partial<RecordCardRow> = {}): RecordCardRow {
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
    ...overrides,
  }
}

const held = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    row({ vehicleSlug: `v${i}`, vehicleName: `V${i}` }),
  )

const open = () =>
  row({ vehicleSlug: 'open', kills: null, playerSlug: null, displayName: null })

describe('spotlightVisible', () => {
  const base = { activeFilters: 1, total: SPOTLIGHT_MIN_ROWS, rows: held(3) }

  it('shows once filtered, with three held titles and enough rows to summarise', () => {
    expect(spotlightVisible(base)).toBe(true)
  })

  it('stays absent on the unfiltered view, however many records match', () => {
    expect(spotlightVisible({ ...base, activeFilters: 0, total: 5000 })).toBe(
      false,
    )
  })

  it('stays absent when the filtered set is short enough to read whole', () => {
    expect(spotlightVisible({ ...base, total: SPOTLIGHT_MIN_ROWS - 1 })).toBe(
      false,
    )
  })

  it('needs three held titles — open bounties do not fill the podium', () => {
    expect(
      spotlightVisible({ ...base, rows: [...held(2), open()] }),
    ).toBe(false)
  })
})

function renderSpotlight(rows: RecordCardRow[]) {
  const rootRoute = createRootRoute({
    component: () => <Spotlight mode="grb" rows={rows} />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

describe('Spotlight', () => {
  it('names itself as a landmark and renders a card per record', async () => {
    const { findByRole, getAllByRole } = renderSpotlight(held(3))
    const region = await findByRole('region', { name: /spotlight/i })
    expect(region).toBeTruthy()
    expect(getAllByRole('listitem')).toHaveLength(3)
  })

  it('carries the kills and the holder of each record', async () => {
    const { findByText } = renderSpotlight([row()])
    expect(await findByText('26')).toBeTruthy()
    expect(await findByText('Koalkiest')).toBeTruthy()
  })
})
