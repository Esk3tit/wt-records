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
/* The enrichment's vehicle link is a target inside a sentence, which WCAG 2.5.8
   exempts — and rightly: widening one takes the rest of its own sentence, which
   wraps a line-height below it. `takes no prose` holds that exemption honest. */
const CONTROLS = 'button, input:not([type="hidden"]), a:not(dl a)'
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

/* A phone reader meets the header in one of three states: a page nobody has
   claimed, which offers the claim CTA; a page they are signed in to claim; or
   their own, which carries the avatar controls and the release. Each control
   holds the same 44px the nav does. */
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
       column on a phone, three narrow ones at `sm`, where a stat's own sentence
       wraps under its link and is close enough for a reach to answer for. */
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
        await expect(page.getByText('Longest held')).toBeVisible()
        // The exempt link exists, so leaving it out is a decision, not a gap.
        await expect(page.locator(`${HEADER} dl a`).first()).toBeVisible()

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

    test('can tap the avatar controls and the release', async ({ page }) => {
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

          // Releasing is a two-step confirm, and its two quiet text buttons are
          // only in the tree once the first step has been taken.
          await page.getByRole('button', { name: 'Release claim' }).click()
          await expect(page.getByRole('button', { name: 'Keep' })).toBeVisible()

          expect(await reachFaults(page, HEADER_REACH)).toEqual([])
          expect(await proseTaken(page, HEADER_REACH)).toEqual([])
        },
      )
    })
  })
})
