import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { TitleDeed } from './title-deed'
import type { TitleDeedRecord, TitleDeedVehicle } from './title-deed'

const vehicle: TitleDeedVehicle = {
  name: 'M2A4',
  class: 'light',
  rank: 1,
  isDifficult: false,
  isEvent: false,
  isPremium: false,
  isSquadron: false,
  isRemoved: false,
  nationSlug: 'usa',
  nationName: 'USA',
  image: null,
}

const current: TitleDeedRecord = {
  kills: 23,
  runBr: 1.0,
  patch: '2.53',
  patchName: 'Line of Contact',
  verifiedAt: new Date('2026-02-09T00:00:00Z'),
  playerSlug: 'koalkiest',
  displayName: 'Koalkiest',
  ignSnapshot: null,
  displayNameSnapshot: null,
  holderAvatar: null,
}

// TitleDeed links back to the nation's record wall, so it needs a router.
function renderDeed(props: Parameters<typeof TitleDeed>[0]) {
  const rootRoute = createRootRoute({
    component: () => <TitleDeed {...props} />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

// The router mounts asynchronously, so every case waits for the first paint.
async function deed(over: Partial<Parameters<typeof TitleDeed>[0]> = {}) {
  const props = {
    mode: 'grb',
    vehicle,
    br: 1.0,
    current,
    minKills: 12,
    ...over,
  }
  // Standing follows the holder unless a case sets it apart on purpose.
  const view = renderDeed({ standing: props.current?.kills ?? null, ...props })
  await view.findByRole('heading', { level: 1 })
  return view
}

describe('TitleDeed — the number to beat', () => {
  it('a held title states one more than the standing record', async () => {
    const { getByText } = await deed()
    expect(getByText('24 kills')).toBeDefined()
  })

  it('spells out that matching the record does not supersede', async () => {
    const { container } = await deed()
    expect(container.textContent).toContain(
      'matching the record does not supersede',
    )
  })

  // "Beat 24" would demand 25 — one more than the title actually costs.
  it('never states the bar as a number to beat', async () => {
    const { container } = await deed()
    expect(container.textContent).not.toMatch(/beat/i)
  })

  // A moderator can pin a lower record as holder without retiring the one it
  // displaces; the next write hands the title back to the higher record, so
  // the page must ask for a number that would actually win.
  it('asks for more than the holder scored when a higher record outranks it', async () => {
    const { getByText, container } = await deed({
      current: { ...current, kills: 20 },
      standing: 30,
    })
    expect(getByText('20')).toBeDefined()
    expect(getByText('31 kills')).toBeDefined()
    expect(container.textContent).not.toContain('21 kills')
  })

  it('states the held bar even when the record is under its class bar', async () => {
    // the migrated corpus holds records below today's qualifying minimum
    const { getByText, container } = await deed({
      current: { ...current, kills: 4 },
      minKills: 12,
    })
    expect(getByText('5 kills')).toBeDefined()
    expect(container.textContent).not.toContain('12 kills')
  })

  it('an open bounty states the class qualifying minimum', async () => {
    const { container } = await deed({ current: null, minKills: 12 })
    expect(container.querySelector('.text-accent-text')?.textContent).toBe(
      '12kills',
    )
    expect(container.textContent).toContain(
      'light-class qualifying bar for GRB',
    )
  })

  it('an open bounty on a difficult vehicle names the difficult bar', async () => {
    const { container } = await deed({
      current: null,
      minKills: 5,
      vehicle: { ...vehicle, isDifficult: true },
    })
    expect(container.textContent).toContain('Difficult qualifying bar')
  })

  it('states no number when the mode configures no bar for the class', async () => {
    const { container } = await deed({ current: null, minKills: null })
    expect(container.textContent).toContain('waiting for its first claim')
    expect(container.textContent).not.toContain('qualifying bar')
  })
})

describe('TitleDeed — the open-state inversion', () => {
  it('a held title keeps the numeral in full ink, with no amber', async () => {
    const { container } = await deed()
    expect(container.textContent).toContain('World record')
    expect(container.querySelectorAll('.text-accent-text')).toHaveLength(0)
  })

  it('an open bounty inverts: the bar becomes the amber numeral', async () => {
    const { container, getByText } = await deed({ current: null })
    // one amber moment, as on the Record Monument: the numeral, not its kicker
    expect(container.querySelectorAll('.text-accent-text')).toHaveLength(1)
    expect(getByText('Open bounty')).toBeDefined()
    expect(container.textContent).not.toContain('World record')
  })

  it('never presents an open bounty as a holder', async () => {
    const { container } = await deed({ current: null })
    expect(container.textContent).not.toContain('Koalkiest')
    expect(container.textContent).not.toContain('Held')
  })
})

describe('TitleDeed — identity and material', () => {
  it('gives the holder a face, falling back to the Medallion', async () => {
    const { getByText } = await deed()
    // the Medallion renders the holder's monogram
    expect(getByText('KO')).toBeDefined()
  })

  it('uses the site-owned avatar when the holder has claimed one', async () => {
    const { container } = await deed({
      current: { ...current, holderAvatar: 'https://assets.test/a.png' },
    })
    const img = container.querySelector('img[alt="Koalkiest\'s avatar"]')
    expect(img?.getAttribute('src')).toBe('https://assets.test/a.png')
  })

  it('wears the gilded material on a premium title', async () => {
    const { container } = await deed({
      vehicle: { ...vehicle, isPremium: true },
    })
    expect(container.querySelector('.acq-premium.acq-pane')).toBeTruthy()
  })

  it('wears service green on a squadron title', async () => {
    const { container } = await deed({
      vehicle: { ...vehicle, isSquadron: true },
    })
    expect(container.querySelector('.acq-squadron.acq-pane')).toBeTruthy()
  })

  it('leaves a tech-tree title on neutral glass', async () => {
    const { container } = await deed()
    expect(container.querySelector('.acq-premium, .acq-squadron')).toBeNull()
  })

  it('keeps a removed vehicle first-class, tagged inline', async () => {
    const { getByText } = await deed({
      vehicle: { ...vehicle, isRemoved: true },
    })
    expect(getByText('removed')).toBeDefined()
    expect(getByText('24 kills')).toBeDefined()
  })

  it('links the nation back to its record wall', async () => {
    const { getByRole } = await deed()
    const link = getByRole('link', { name: /USA/ })
    expect(link.getAttribute('href')).toBe('/grb/nation/usa')
  })
})
