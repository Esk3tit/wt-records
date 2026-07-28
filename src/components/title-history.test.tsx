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
    const { getByText } = await history(climb)
    expect(getByText('holds it')).toBeDefined()
  })

  // A verified life below the standing record never held the title, so it must
  // not show a reign — nor close the reign of the record it never beat.
  it("gives a losing record no tenure and lets it end nobody else's", async () => {
    const { getByText, container } = await history([
      row({ kills: 26, verifiedAt: new Date('2024-01-01T00:00:00Z') }),
      row({
        kills: 20,
        playerSlug: 'kukwa',
        displayName: 'KuKwa',
        verifiedAt: new Date('2024-01-05T00:00:00Z'),
      }),
      row({
        kills: 30,
        playerSlug: 'koalkiest',
        displayName: 'Koalkiest',
        isCurrent: true,
        verifiedAt: new Date('2024-02-01T00:00:00Z'),
      }),
    ])
    expect(getByText('did not take the title')).toBeDefined()
    // the 26 was taken by the 30 a month later, not by the losing 20 on day 4
    expect(getByText('stood 31 days')).toBeDefined()
    expect(container.textContent).not.toContain('stood 4 days')
  })

  // formatHeldDays' rule: a brief reign is real, never a zero.
  it('renders a same-day supersede as under a day', async () => {
    const { getByText } = await history([
      row({ verifiedAt: new Date('2024-04-12T01:00:00Z') }),
      row({
        kills: 30,
        isCurrent: true,
        verifiedAt: new Date('2024-04-12T20:00:00Z'),
      }),
    ])
    expect(getByText('stood under a day')).toBeDefined()
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

  // makeCurrentRecord can hand the title to a record the frontier does not end
  // on. Nothing then knows who held what when, so the page claims nothing.
  it('drops every tenure claim when a moderator has overridden the holder', async () => {
    const { container, queryByText } = await history([
      row({ kills: 26, verifiedAt: new Date('2024-01-01T00:00:00Z') }),
      row({
        kills: 30,
        playerSlug: 'kukwa',
        displayName: 'KuKwa',
        verifiedAt: new Date('2024-02-01T00:00:00Z'),
      }),
      row({
        kills: 20,
        playerSlug: 'koalkiest',
        displayName: 'Koalkiest',
        isCurrent: true,
        verifiedAt: new Date('2024-03-01T00:00:00Z'),
      }),
    ])
    // the 30 was never beaten — it must not be called superseded
    expect(container.textContent).not.toContain('superseded')
    expect(container.textContent).not.toContain('stood')
    expect(queryByText('did not take the title')).toBeNull()
    // the record that actually holds the title still says so
    expect(queryByText('holds it')).not.toBeNull()
  })

  // demoteRecord leaves the records verified with nobody holding the title.
  // The chart names its last step the current holder, so it must not draw one.
  it('charts no progression and names no successor for a vacated title', async () => {
    const rows = [
      row({
        kills: 26,
        playerSlug: 'lope',
        displayName: 'LOPE',
        verifiedAt: new Date('2024-01-01T00:00:00Z'),
      }),
      row({
        kills: 30,
        playerSlug: 'kukwa',
        displayName: 'KuKwa',
        verifiedAt: new Date('2024-02-01T00:00:00Z'),
      }),
    ]
    const steps = rows.map((r) => ({
      kills: r.kills,
      verifiedAt: r.verifiedAt as Date,
      displayName: r.displayName,
      playerSlug: r.playerSlug,
    }))
    const rootRoute = createRootRoute({
      component: () => <TitleHistory rows={rows} steps={steps} />,
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
    await view.findByText('Record history')
    expect(view.container.textContent).not.toContain('current:')
    // nobody took the 30 — it was vacated, not superseded
    expect(view.container.textContent).not.toContain('superseded')
    expect(view.queryByText('title vacated')).not.toBeNull()
  })

  it('renders nothing for a title that has only ever had one holder', async () => {
    const { container } = await history([row({ isCurrent: true })])
    expect(container.textContent).toBe('')
  })
})
