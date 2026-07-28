import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { TitleHistory } from './title-history'
import type { TitleHistoryRow } from './title-history'

function row(over: Partial<TitleHistoryRow> = {}): TitleHistoryRow {
  return {
    kills: 26,
    verifiedAt: new Date('2024-04-12T00:00:00Z'),
    patch: '2.31',
    isCurrent: false,
    playerSlug: 'lope',
    displayName: 'LOPE',
    ignSnapshot: null,
    displayNameSnapshot: null,
    ...over,
  }
}

async function history(rows: Array<TitleHistoryRow>) {
  const rootRoute = createRootRoute({
    component: () => <TitleHistory rows={rows} steps={[]} />,
  })
  const view = render(
    <RouterProvider
      router={
        createRouter({
          routeTree: rootRoute,
          history: createMemoryHistory({ initialEntries: ['/'] }),
        }) as never
      }
    />,
  )
  if (rows.length >= 2) await view.findByText('Record history')
  return view
}

// Oldest first, as the loader returns them.
const climb = [
  row(),
  row({
    kills: 30,
    playerSlug: 'kukwa',
    displayName: 'KuKwa',
    verifiedAt: new Date('2024-11-12T00:00:00Z'),
  }),
  row({
    kills: 34,
    playerSlug: 'koalkiest',
    displayName: 'Koalkiest',
    verifiedAt: new Date('2026-02-09T00:00:00Z'),
    isCurrent: true,
  }),
]

describe('TitleHistory', () => {
  it('states how long each superseded record stood', async () => {
    const { getByText } = await history(climb)
    expect(getByText('stood 214 days')).toBeDefined()
    expect(getByText('stood 454 days')).toBeDefined()
  })

  it('marks the standing record rather than giving it a tenure', async () => {
    const { getByText, container } = await history(climb)
    expect(getByText('holds it')).toBeDefined()
    expect(container.textContent).not.toContain('stood 0 days')
  })

  it('says only that a record was superseded when a date is missing', async () => {
    const { getByText } = await history([
      row({ verifiedAt: null }),
      row({ kills: 30, isCurrent: true }),
    ])
    expect(getByText('superseded')).toBeDefined()
  })

  it('keeps the singular day singular', async () => {
    const { getByText } = await history([
      row({ verifiedAt: new Date('2024-04-12T00:00:00Z') }),
      row({
        kills: 30,
        isCurrent: true,
        verifiedAt: new Date('2024-04-13T06:00:00Z'),
      }),
    ])
    expect(getByText('stood 1 day')).toBeDefined()
  })

  it('renders nothing for a title that has only ever had one holder', async () => {
    const { container } = await history([row({ isCurrent: true })])
    expect(container.textContent).toBe('')
  })
})
