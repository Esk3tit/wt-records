import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import {
  SPOTLIGHT_MIN_HELD,
  SPOTLIGHT_SHOWS,
  Spotlight,
  spotlightVisible,
} from './spotlight'
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
  const base = { activeFilters: 1, candidates: held(SPOTLIGHT_MIN_HELD) }

  it('shows once filtered and holding enough titles to be a selection', () => {
    expect(spotlightVisible(base)).toBe(true)
  })

  it('stays absent on the unfiltered view, however many titles are held', () => {
    expect(spotlightVisible({ ...base, activeFilters: 0 })).toBe(false)
  })

  it('stays absent when it would restate rather than summarise', () => {
    expect(
      spotlightVisible({ ...base, candidates: held(SPOTLIGHT_MIN_HELD - 1) }),
    ).toBe(false)
  })

  it('counts held titles, not rows — open bounties never reach it', () => {
    // The query only returns held titles, so a filter set that is mostly open
    // bounties yields few candidates and the strip stays away.
    expect(spotlightVisible({ ...base, candidates: [open()] })).toBe(false)
  })
})

function renderSpotlight(candidates: RecordCardRow[]) {
  const rootRoute = createRootRoute({
    component: () => <Spotlight mode="grb" candidates={candidates} />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

describe('Spotlight', () => {
  it('names itself as a landmark and shows only the top few candidates', async () => {
    const { findByRole, getAllByRole } = renderSpotlight(
      held(SPOTLIGHT_MIN_HELD),
    )
    const region = await findByRole('region', { name: /spotlight/i })
    expect(region).toBeTruthy()
    expect(getAllByRole('listitem')).toHaveLength(SPOTLIGHT_SHOWS)
  })

  it('carries the kills and the holder of each record', async () => {
    const { findByText } = renderSpotlight([row()])
    expect(await findByText('26')).toBeTruthy()
    expect(await findByText('Koalkiest')).toBeTruthy()
  })
})
