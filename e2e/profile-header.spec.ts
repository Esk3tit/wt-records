import { expect, test } from '@playwright/test'
import type { Page, ViewportSize } from '@playwright/test'
import { proseTaken, reachFaults } from './support/reach'
import { withPlayer } from './support/players'
import type { PlayerSeed } from './support/players'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

/* The header is the pane carrying the page's own h1 — the disc, the name, the
   former names, the enrichment stats, and the one claim affordance. The records
   pane below it is a separate surface with its own reach. */
const HEADER = '.glass-mid:has(h1)'
/* The monument names the title it counts, inside a sentence — a target WCAG
   2.5.8 exempts, and rightly: widening one takes the rest of its own sentence,
   which wraps a line-height below it. `takes no prose` holds that exemption
   honest. Scoped to a paragraph, because that is what makes it a sentence; the
   claim CTA is a sibling of its prose, not inside it. */
const CONTROLS = 'button, input:not([type="hidden"]), a:not(p a)'
/* Its own pane, and the records pane sits right under it, so a reach past
   either edge would take taps meant for the surface beyond. */
const HEADER_REACH = { root: HEADER, controls: CONTROLS, pane: HEADER } as const

/* 320px is the narrowest phone the touch-target specs hold this site to, and
   the width where the name had ~180px to wrap in. 639/640 straddle `sm`, so a
   rule written to the wrong breakpoint cannot pass both. Tall enough that
   nothing under test is scrolled off: a control past the viewport edge is
   owned by nobody. */
const PHONE: ViewportSize = { width: 320, height: 900 }
const STACKED_WIDTHS = [320, 390, 639]
const BESIDE_WIDTHS = [640, 1280]

/* Forty ordinary characters. Its own single-line width is about twice the
   column, so the column can do no better than three lines — what makes a name
   shatter is the fragments, not the count. */
const LONG_NAME = 'Long Named Test Player For The Wide Name'
/* A name with nowhere to break. Left alone it sets the header's own minimum
   width and drags the whole page into sideways scroll. */
const UNBROKEN_NAME = 'ReichsmarschallVonWunderwaffePrototypXIV'

/** Seeds a Player, opens their page at a width, and takes the row away after.
    Waits past hydration: the header is server-rendered, so its own ink proves
    nothing about its handlers, and a claim button clicked before React takes
    the markup over swallows the click. The theme toggle mounts client-side. */
async function onProfile(
  page: Page,
  seed: PlayerSeed,
  viewport: ViewportSize,
  body: () => Promise<void>,
): Promise<void> {
  await withPlayer(seed, async () => {
    await page.setViewportSize(viewport)
    await page.goto(`/player/${seed.slug}`)
    await expect(page.locator(`${HEADER} h1`)).toBeVisible()
    await expect(page.getByRole('button', { name: /Switch to/ })).toBeVisible()
    await body()
  })
}

/** Where the disc sits relative to the name, and how much room the name got.
    Line boxes are read off a Range rather than divided out of the height, so a
    name that wraps is counted, not estimated. */
async function headerLayout(page: Page) {
  return page.evaluate((sel) => {
    const pane = document.querySelector(sel)
    if (!pane) throw new Error(`${sel} never rendered`)
    const h1 = pane.querySelector('h1')!
    // No fixture here carries an avatar, so the disc is always the Medallion.
    const disc = pane.querySelector<SVGElement>('[role="img"]')!
    const range = document.createRange()
    range.selectNodeContents(h1)
    const lines = [...range.getClientRects()].filter((r) => r.width > 0)
    const padding = getComputedStyle(pane)
    // A DOMRect carries no own properties, so it crosses the bridge empty.
    const plain = (el: Element) => {
      const { top, right, bottom, left, width } = el.getBoundingClientRect()
      return { top, right, bottom, left, width }
    }
    const name = plain(h1)
    return {
      column:
        pane.clientWidth -
        parseFloat(padding.paddingLeft) -
        parseFloat(padding.paddingRight),
      name,
      disc: plain(disc),
      /** How much of the column each line box fills — a fragment is what a
          shattered name leaves behind. */
      fills: lines.map((line) => line.width / name.width),
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }
  }, HEADER)
}

test.describe('the profile header stacks on a phone', () => {
  test.use({ storageState: STATE.anon })

  for (const width of STACKED_WIDTHS) {
    test(`the disc sits above the name at ${width}px`, async ({ page }) => {
      await onProfile(
        page,
        { slug: `e2e-profile-header-stacked-${width}`, displayName: LONG_NAME },
        { width, height: 900 },
        async () => {
          const { disc, name } = await headerLayout(page)
          expect(disc.bottom).toBeLessThanOrEqual(name.top)
          // Both flush to the same edge: stacked, not indented under the disc.
          expect(name.left).toBeCloseTo(disc.left, 0)
        },
      )
    })
  }

  for (const width of BESIDE_WIDTHS) {
    test(`the disc stays beside the name at ${width}px`, async ({ page }) => {
      await onProfile(
        page,
        { slug: `e2e-profile-header-beside-${width}`, displayName: LONG_NAME },
        { width, height: 900 },
        async () => {
          const { disc, name } = await headerLayout(page)
          expect(disc.right).toBeLessThanOrEqual(name.left)
          // Beside means sharing rows, not merely left of a name below it.
          expect(disc.top).toBeLessThan(name.bottom)
          expect(name.top).toBeLessThan(disc.bottom)
        },
      )
    })
  }

  test('a 40-character name gets the whole column at 320px', async ({
    page,
  }) => {
    await onProfile(
      page,
      { slug: 'e2e-profile-header-long', displayName: LONG_NAME },
      PHONE,
      async () => {
        const header = await headerLayout(page)
        // The defect this fixes: beside the disc the name had ~126 of the 230.
        expect(header.name.width).toBeCloseTo(header.column, 0)
        /* Shattering is the fragments, not the count — and a count is the one
           thing not safe to assert, since `ui-sans-serif` draws ~11% wider on
           CI than here and a 40-character name has no room to spare. */
        expect(header.fills.slice(0, -1).filter((fill) => fill < 0.5)).toEqual(
          [],
        )
        expect(header.pageOverflow).toBe(0)
      },
    )
  })

  test('a name with nowhere to break does not push the page sideways', async ({
    page,
  }) => {
    await onProfile(
      page,
      { slug: 'e2e-profile-header-unbroken', displayName: UNBROKEN_NAME },
      PHONE,
      async () => {
        const header = await headerLayout(page)
        expect(header.name.width).toBeLessThanOrEqual(header.column + 1)
        expect(header.pageOverflow).toBe(0)
      },
    )
  })

  test('the former names and the claimed chip stack under the disc', async ({
    page,
  }) => {
    await onProfile(
      page,
      {
        slug: 'e2e-profile-header-aliases',
        displayName: LONG_NAME,
        aliases: ['Earlier Name', 'Even Earlier Name'],
        // Claimed by someone else, so the chip shows and the panel does not.
        ownerEmail: TEST_USERS.moderator.email,
      },
      PHONE,
      async () => {
        const former = page.getByText('previously known as', { exact: false })
        const chip = page.getByText('Claimed', { exact: true })
        await expect(former).toBeVisible()
        await expect(former).toContainText('Earlier Name, Even Earlier Name')
        await expect(chip).toBeVisible()

        /* Flush to the disc's own edge, not indented past it: both sat beside
           the disc before, and both wrap below the name either way — so their
           left edge is the only thing here that tells the layouts apart. */
        const { disc, column } = await headerLayout(page)
        for (const line of [former, chip]) {
          const box = (await line.boundingBox())!
          expect(box.x).toBeCloseTo(disc.left, 0)
          expect(box.x + box.width).toBeLessThanOrEqual(disc.left + column + 1)
        }
      },
    )
  })
})

/* The Plinth's composition, on the running page rather than in a render tree:
   the country rides with the name, the links dock to the foot, and the empty
   case — the common one — renders neither. */
test.describe('the card reads identity, then the monument, then outward', () => {
  test.use({ storageState: STATE.anon })

  /** A slug per case, never a shared one: these run in parallel and the fixture
      deletes its slug first, so two cases on one row take turns destroying each
      other's. A handle is global for the same reason, so it derives from the
      slug that owns it. */
  const railed = (name: string): PlayerSeed => ({
    slug: `e2e-profile-header-${name}`,
    displayName: 'Composed Holder',
    aliases: ['Older Name'],
    countryCode: 'JP',
    // Claimed by somebody, which is all a country and a rail need — and it
    // keeps these cases off the lock every case claiming as the viewer waits on.
    ownerEmail: TEST_USERS.holder.email,
    links: [
      { platform: 'youtube', handle: `yt${name}` },
      { platform: 'twitch', handle: `tw${name}` },
    ],
  })

  /* A seeded Player holds no titles, so this header carries no stats strip at
     all — the rail's place relative to that strip is a DOM fact, and it is
     asserted where both can be constructed (profile-header.test.tsx). What only
     the running page can answer is where the rail actually lands: last in the
     pane, under a rule of its own, below everything about the player. */
  test('docks the links at the card’s foot, under their own rule', async ({
    page,
  }) => {
    await onProfile(
      page,
      railed('docked'),
      { width: 1280, height: 900 },
      async () => {
        const rail = page.locator('[data-profile-links]')
        await expect(rail).toBeVisible()

        const box = async (sel: string) =>
          (await page.locator(sel).first().boundingBox())!
        const name = await box(`${HEADER} h1`)
        const links = await box('[data-profile-links]')
        const pane = await box(HEADER)

        expect(links.y).toBeGreaterThan(name.y + name.height)
        // Nothing about this player sits below where else to find them.
        const lowest = await page
          .locator(`${HEADER} h1, ${HEADER} p, ${HEADER} dl`)
          .evaluateAll((nodes) =>
            Math.max(
              ...nodes
                .filter((el) => !el.closest('[data-profile-links]'))
                .map((el) => el.getBoundingClientRect().top),
            ),
          )
        expect(links.y).toBeGreaterThanOrEqual(lowest)
        expect(links.y + links.height).toBeLessThanOrEqual(
          pane.y + pane.height + 1,
        )

        // A hairline of its own, so its absence takes the rule with it.
        const ruled = await rail.evaluate(
          (ul) => getComputedStyle(ul.parentElement!).borderTopWidth,
        )
        expect(parseFloat(ruled)).toBeGreaterThan(0)
      },
    )
  })

  /* The majority state. Asserted as absence, because "no hole" is the
     property — and every rule this pane draws has to be ruling something off. */
  test('leaves the unclaimed page exactly as it was', async ({ page }) => {
    await onProfile(
      page,
      { slug: 'e2e-profile-header-empty', displayName: 'Nobody Home' },
      { width: 1280, height: 900 },
      async () => {
        await expect(page.locator('[data-profile-links]')).toHaveCount(0)
        await expect(page.locator(`${HEADER} .country-flag`)).toHaveCount(0)

        const empties = await page.locator(`${HEADER} *`).evaluateAll((nodes) =>
          nodes
            .filter((el) => parseFloat(getComputedStyle(el).borderTopWidth) > 0)
            .filter((el) => el.textContent.trim() === '')
            .map((el) => el.className),
        )
        expect(empties).toEqual([])
      },
    )
  })

  test('sets the country beside the name, and the flag is not read out', async ({
    page,
  }) => {
    await onProfile(
      page,
      railed('country'),
      { width: 1280, height: 900 },
      async () => {
        const flag = page.locator(`${HEADER} .country-flag`)
        await expect(flag).toHaveAttribute('aria-hidden', 'true')

        const name = (await page.locator(`${HEADER} h1`).boundingBox())!
        const line = (await flag.boundingBox())!
        const links = (await page
          .locator('[data-profile-links]')
          .boundingBox())!
        // Immediately under the name, and nowhere near the rail: the country is
        // identity, and identity rides with the name.
        expect(line.y).toBeGreaterThan(name.y)
        expect(line.y).toBeLessThan(name.y + name.height + 24)
        expect(line.y).toBeLessThan(links.y)

        /* The separator travels with what follows it. Wrapped to its own line
           at 320px, one left on the country's line would dangle there. */
        const country = await flag.evaluate((svg) =>
          svg.parentElement!.textContent.trim(),
        )
        expect(country).not.toContain('·')
        const former = await page
          .getByText('previously known as', { exact: false })
          .first()
          .evaluate((el) => el.textContent.trim())
        expect(former.startsWith('·')).toBe(true)
      },
    )
  })
})

/* A phone reader meets the header in one of three states: a page nobody has
   claimed, which offers the claim CTA; a page they are signed in to claim; or
   their own, which carries the avatar controls. Each control holds the same
   44px the nav does. */
test.describe('every header control answers a thumb at 320px', () => {
  test.describe('an anonymous visitor', () => {
    test.use({ storageState: STATE.anon })

    test('can tap the claim CTA', async ({ page }) => {
      await onProfile(
        page,
        { slug: 'e2e-profile-header-cta', displayName: LONG_NAME },
        PHONE,
        async () => {
          await expect(
            page.getByRole('link', { name: 'Claim this page' }),
          ).toBeVisible()

          expect(await reachFaults(page, HEADER_REACH)).toEqual([])
        },
      )
    })

    /* A seeded player holds no titles, so their header carries no enrichment
       stats at all. Reached through the leaderboard rather than seeded, so the
       fixture is whichever holder this corpus has — the seed's, or
       production's — and the stats are really in the tree being measured.

       Measured at both widths because the stats change shape between them: one
       column on a phone, narrow ones side by side at `sm`, where the monument's
       sentence wraps under its link and is close enough for a reach to answer
       for. */
    for (const width of [320, 640]) {
      test(`reaches every control on a header carrying the stats at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/grb/leaderboard')
        await page
          .getByRole('listitem')
          .first()
          .getByRole('link')
          .first()
          .click()
        await expect(page.getByText('Titles by nation')).toBeVisible()
        // The exempt link exists, so leaving it out is a decision, not a gap.
        await expect(page.locator(`${HEADER} p a`).first()).toBeVisible()

        expect(await reachFaults(page, HEADER_REACH)).toEqual([])
        expect(await proseTaken(page, HEADER_REACH)).toEqual([])
      })
    }
  })

  test.describe('a signed-in visitor', () => {
    test.use({ storageState: STATE.moderator })

    test('can tap the claim form it opens', async ({ page }) => {
      await onProfile(
        page,
        { slug: 'e2e-profile-header-form', displayName: LONG_NAME },
        PHONE,
        async () => {
          await page.getByRole('button', { name: 'Claim this page' }).click()
          await expect(
            page.getByRole('button', { name: 'Request claim' }),
          ).toBeVisible()

          expect(await reachFaults(page, HEADER_REACH)).toEqual([])
          expect(await proseTaken(page, HEADER_REACH)).toEqual([])
        },
      )
    })
  })

  test.describe('the page owner', () => {
    test.use({ storageState: STATE.viewer })

    test('can tap the avatar controls', async ({ page }) => {
      await onProfile(
        page,
        {
          slug: 'e2e-profile-header-owner',
          displayName: LONG_NAME,
          ownerEmail: TEST_USERS.viewer.email,
        },
        PHONE,
        async () => {
          await expect(
            page.getByRole('button', { name: 'Upload photo', exact: true }),
          ).toBeVisible()

          expect(await reachFaults(page, HEADER_REACH)).toEqual([])
          expect(await proseTaken(page, HEADER_REACH)).toEqual([])
        },
      )
    })
  })
})
