import { describe, expect, it, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
/* The owner's controls call server functions, which drag `#/db` into the
   browser bundle on import alone. Nothing here presses one — these cases are
   about what the composition renders, not about what it writes. */
vi.mock('#/claims/api', () => ({
  submitClaimRequest: vi.fn(),
  uploadMyAvatar: vi.fn(),
  removeMyAvatar: vi.fn(),
  setMyCountry: vi.fn(),
  setMyLink: vi.fn(),
  removeMyLink: vi.fn(),
}))

const { ProfileHeader } = await import('./profile-header')
type ProfileHeaderPlayer = import('./profile-header').ProfileHeaderPlayer
type ClaimViewer = import('./claim-panel').ClaimViewer
type ProfileEnrichmentData =
  import('./profile-enrichment').ProfileEnrichmentData

/* The properties the direction was picked for, not its markup: the empty case
   is unchanged, the pending case gives nothing away, nothing is said twice, and
   the country rides with the name while the links dock to the foot. */

const held = {
  vehicleSlug: 'panther-d',
  vehicleName: 'Panther D',
  mode: 'grb',
  heldSeconds: 61 * 86_400,
  lostAt: null,
}

const JAPAN = {
  code: 'JP',
  name: 'Japan',
  viewBox: '0 0 3 2',
  body: '<rect width="3" height="2" fill="#fff"/>',
}

/** The unclaimed Player: no country, no links, nothing standing. The common
    case, and the page this composition promises to leave alone. */
const bare: ProfileHeaderPlayer = {
  id: 7,
  slug: 'e2e-bare',
  displayName: 'Bare Player',
  aliases: [],
  avatarUrl: null,
  hasAvatar: false,
  country: null,
  countryCode: null,
  links: [],
  isClaimed: false,
  titlesHeld: 0,
}

const anon: ClaimViewer = { signedIn: false }
const owner: ClaimViewer = {
  signedIn: true,
  isOwner: true,
  claimState: 'none',
  canClaim: false,
  providerAvatarUrl: null,
}

const noStats: ProfileEnrichmentData = {
  nationSpread: [],
  longestHeld: null,
  lastVerifiedAt: null,
}

/** jsdom evaluates no media query, so the count-up's branch is chosen here. */
function noMotion() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  )
}

async function renderHeader({
  player = bare,
  viewer = anon,
  enrichment = noStats,
}: {
  player?: ProfileHeaderPlayer
  viewer?: ClaimViewer
  enrichment?: ProfileEnrichmentData
} = {}) {
  noMotion()
  const rootRoute = createRootRoute({
    component: () => (
      <main>
        <ProfileHeader
          player={player}
          viewer={viewer}
          enrichment={enrichment}
        />
      </main>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const view = render(<RouterProvider router={router as never} />)
  // Scoped to this render's own container: a case that mounts two headers to
  // compare them would otherwise read the first one twice.
  const scope = within(view.container)
  return { ...view, ...scope, header: await scope.findByRole('main') }
}

describe('the empty case is the page it has always been', () => {
  /* Asserted as absence, because "no hole" is the property — and this is the
     majority state, so a placeholder here would be the page most readers see. */
  it('renders no country, no rail and no hairline', async () => {
    const { header } = await renderHeader()

    expect(header.querySelector('.country-flag')).toBeNull()
    expect(header.querySelector('[data-profile-links]')).toBeNull()
    expect(header.textContent).not.toContain('previously known as')
    expect(header.querySelector('.monument-light')).toBeNull()
    // Every rule in this pane belongs to whatever sits under it — the claim
    // prompt keeps its own. A rule with nothing beneath it is the hole.
    for (const rule of header.querySelectorAll('.border-t')) {
      expect(rule.textContent!.trim()).not.toBe('')
    }
  })

  it('still offers the one thing an unclaimed page is for', async () => {
    const { getByRole } = await renderHeader()

    expect(getByRole('link', { name: 'Claim this page' })).toBeTruthy()
  })
})

describe('the country rides with the name', () => {
  it('sets the mark beside the country’s own name, in text', async () => {
    const { header } = await renderHeader({
      player: { ...bare, country: JAPAN },
    })

    const flag = header.querySelector('.country-flag')!
    expect(flag.getAttribute('aria-hidden')).toBe('true')
    expect(header.textContent).toContain('Japan')
  })

  /* Wrapped below the country at 320px, a separator left at the end of the
     country's line dangles there. Bound to what follows it, it travels. */
  it('binds the separator to the former names, never to the country', async () => {
    const { header } = await renderHeader({
      player: { ...bare, country: JAPAN, aliases: ['Earlier Name'] },
    })

    const line = header.querySelector('p')!
    expect(line.textContent).toContain('Japan')
    expect(line.textContent).toContain('previously known as Earlier Name')

    const former = [...line.querySelectorAll('span')].find((span) =>
      span.textContent?.includes('previously known as'),
    )!
    expect(former.textContent?.trimStart().startsWith('·')).toBe(true)
    // Nothing is left behind on the country's own element to be stranded.
    expect(header.querySelector('.country-flag')!.closest('span')!.textContent)
      .not.toContain('·')
  })

  it('drops a former name that is simply the name they go by now', async () => {
    const { header } = await renderHeader({
      player: { ...bare, aliases: ['Bare Player'] },
    })

    expect(header.textContent).not.toContain('previously known as')
  })
})

describe('the links dock to the card’s foot', () => {
  const linked: ProfileHeaderPlayer = {
    ...bare,
    isClaimed: true,
    links: [{ platform: 'youtube', handle: 'PhlyDaily' }],
  }
  const withStats: ProfileEnrichmentData = {
    ...noStats,
    nationSpread: [{ slug: 'germany', name: 'Germany', records: 2 }],
  }

  it('puts the rail below the stats strip, never between the two', async () => {
    const { header } = await renderHeader({
      player: linked,
      enrichment: withStats,
    })

    const strip = header.querySelector('dl')!
    const rail = header.querySelector('[data-profile-links]')!
    expect(
      strip.compareDocumentPosition(rail) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // And below the name, which is what the alternative direction failed.
    const name = header.querySelector('h1')!
    expect(
      name.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('carries its own hairline, so absence renders no rule', async () => {
    const { header } = await renderHeader({ player: linked })

    const rail = header.querySelector('[data-profile-links]')!
    expect(rail.parentElement!.className).toContain('border-t')
  })
})

describe('the owner', () => {
  it('is taught the feature exists by the empty rail itself', async () => {
    const { getByRole, queryByRole } = await renderHeader({ viewer: owner })

    expect(getByRole('button', { name: 'Add links' })).toBeTruthy()
    // Nothing else: the affordance is the whole of the empty rail.
    expect(queryByRole('textbox')).toBeNull()
  })

  it('is offered the avatar and the country side by side', async () => {
    const { getByRole } = await renderHeader({ viewer: owner })

    expect(getByRole('button', { name: 'Upload photo' })).toBeTruthy()
    expect(getByRole('combobox', { name: /Country/ })).toBeTruthy()
  })

  /* Two adjacent controls with deliberately different feedback: the country is
     not shadowed and says "Saved"; the avatar is, and says nothing at all. The
     contrast IS the decision, so it is asserted in one place — split across two
     specs, nothing would catch the day one of them drifts toward the other and
     the pair starts reading as an inconsistency instead of a design. */
  it('confirms the country and never the avatar', async () => {
    const { header } = await renderHeader({ viewer: owner })

    const region = (label: RegExp) => {
      const control = [...header.querySelectorAll('div')].find(
        (el) =>
          label.test(el.textContent ?? '') &&
          !el.querySelector('div')?.textContent?.match(label),
      )
      return control?.querySelector('[role="status"], [aria-live]') ?? null
    }

    // The country ships the live region its confirmation will speak through…
    expect(region(/Country/)).not.toBeNull()
    // …and the avatar ships none anywhere in its subtree, in any state.
    const avatar = header.querySelector('input[type="file"]')!.parentElement!
    expect(avatar.querySelector('[role="status"], [aria-live]')).toBeNull()
    expect(avatar.textContent).not.toMatch(/saved|pending|review|uploaded/i)
  })
})

/* The design test this issue owes: the two renders differ in the image and in
   nothing else. No badge, no reserved slot, no changed class, no changed
   spacing anywhere on the page — the shadow leaks through an inconsistency
   long before it leaks through a label.

   Half of that claim is checkable here and half is not: jsdom loads no image,
   so both renders fall to the Medallion and the *picture* can only be compared
   against the running app. What this level does own is everything around it —
   which is where a reserved slot or a changed gap would actually show. */
describe('a pending avatar gives nothing away', () => {
  /* Every node's tag, classes and inline style, in order — which is exactly
     "no additional node, no changed class, no changed spacing" and nothing
     else. Not the raw HTML: the country picker alone is 250 options, so a diff
     over that is unreadable, and `useId` counts up across the two mounts, which
     would fail this for a reason that has nothing to do with an avatar. */
  const shape = (root: Element) =>
    [root, ...root.querySelectorAll('*')].map((el) =>
      [
        el.tagName,
        el.getAttribute('class') ?? '',
        el.getAttribute('style') ?? '',
      ].join('|'),
    )

  it('lays the page out identically whatever the owner’s avatar is doing', async () => {
    const player = { ...bare, isClaimed: true }
    const withOne = await renderHeader({
      player: {
        ...player,
        hasAvatar: true,
        avatarUrl: 'https://assets.example/a.png',
      },
      viewer: owner,
    })
    const withAnother = await renderHeader({
      player: {
        ...player,
        hasAvatar: true,
        avatarUrl: 'https://assets.example/b.png',
      },
      viewer: owner,
    })

    expect(shape(withAnother.header)).toEqual(shape(withOne.header))
  })

  it('says nothing anywhere about where an avatar stands', async () => {
    const { header } = await renderHeader({
      player: {
        ...bare,
        isClaimed: true,
        hasAvatar: true,
        avatarUrl: 'https://assets.example/a.png',
      },
      viewer: owner,
    })

    expect(header.textContent).not.toMatch(/pending|review|approved|awaiting/i)
    // No live region on the avatar control either: a status that resolves into
    // a word is the same leak, spoken instead of drawn.
    for (const region of header.querySelectorAll('[role="status"]')) {
      expect(region.textContent!.trim()).toBe('')
    }
  })
})

describe('the monument', () => {
  const tenured: ProfileEnrichmentData = { ...noStats, longestHeld: held }

  it('lights only where there is a feat to light', async () => {
    const dark = await renderHeader()
    expect(dark.header.querySelector('.monument-light')).toBeNull()

    const lit = await renderHeader({
      player: { ...bare, titlesHeld: 1 },
      enrichment: tenured,
    })
    expect(lit.header.querySelector('.monument-light')).not.toBeNull()
  })

  /* A reign still running breathes; a closed one is steady. The distinction is
     the page's, not the animation's — an ex-holder must not read as current. */
  it('marks a reign still running apart from one already closed', async () => {
    const running = await renderHeader({
      player: { ...bare, titlesHeld: 1 },
      enrichment: tenured,
    })
    expect(
      running.header.querySelector('.monument-light')!.className,
    ).toContain('monument-light--standing')

    const closed = await renderHeader({
      player: bare,
      enrichment: {
        ...noStats,
        longestHeld: { ...held, lostAt: new Date('2026-03-14T00:00:00Z') },
      },
    })
    expect(
      closed.header.querySelector('.monument-light')!.className,
    ).not.toContain('monument-light--standing')
  })

  it('does not say the tenure the strip would otherwise repeat', async () => {
    const { header } = await renderHeader({
      player: { ...bare, titlesHeld: 1 },
      enrichment: tenured,
    })

    expect(header.textContent).toContain('Days at the top')
    expect(header.textContent).not.toContain('Longest held')
  })
})
