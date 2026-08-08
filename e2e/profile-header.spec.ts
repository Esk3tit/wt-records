import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { reachFaults } from './support/reach'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

/* The header is the pane carrying the page's own h1 — the disc, the name, the
   former names, the enrichment stats, and the one claim affordance. The records
   pane below it is a separate surface with its own reach. */
const HEADER = '.glass-mid:has(h1)'
/* Its own pane, and the records pane sits right under it, so a reach past
   either edge would take taps meant for the surface beyond. */
const HEADER_REACH = { root: HEADER, pane: HEADER }

/* 320px is the narrowest phone the touch-target specs hold this site to, and
   the width where the name had ~180px to wrap in. 640px is `sm`, the first
   width that keeps the disc beside the name. Tall enough that nothing under
   test is scrolled off: a control past the viewport edge is owned by nobody. */
const PHONE = { width: 320, height: 900 }
const SIDE_BY_SIDE = { width: 640, height: 900 }

/* Forty ordinary characters. Its own single-line width is about twice the
   column, so the column can do no better than three lines — what makes a name
   shatter is the fragments, not the count. */
const LONG_NAME = 'Long Named Test Player For The Wide Name'
/* A name with nowhere to break. Left alone it sets the header's own minimum
   width and drags the whole page into sideways scroll. */
const UNBROKEN_NAME = 'ReichsmarschallVonWunderwaffePrototypXIV'

async function openProfile(
  page: Page,
  slug: string,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport)
  await page.goto(`/player/${slug}`)
  await expect(page.locator(`${HEADER} h1`)).toBeVisible()
  /* The header is server-rendered, so its own ink proves nothing about its
     handlers — a claim button clicked before hydration swallows the click and
     the panel never opens. The theme toggle mounts client-side, so it is the
     page's signal that React has taken the markup over. */
  await expect(page.getByRole('button', { name: /Switch to/ })).toBeVisible()
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

  test('the disc sits above the name below sm', async ({ page }) => {
    const slug = 'e2e-profile-header-stacked'
    await withPlayer({ slug, displayName: LONG_NAME }, async () => {
      await openProfile(page, slug, PHONE)

      const { disc, name } = await headerLayout(page)
      expect(disc.bottom).toBeLessThanOrEqual(name.top)
      // Both flush to the same edge: stacked, not indented under the disc.
      expect(name.left).toBeCloseTo(disc.left, 0)
    })
  })

  test('the disc stays beside the name at sm', async ({ page }) => {
    const slug = 'e2e-profile-header-beside'
    await withPlayer({ slug, displayName: LONG_NAME }, async () => {
      await openProfile(page, slug, SIDE_BY_SIDE)

      const { disc, name } = await headerLayout(page)
      expect(disc.right).toBeLessThanOrEqual(name.left)
      // Beside means sharing rows, not merely to the left of a name below it.
      expect(disc.top).toBeLessThan(name.bottom)
      expect(name.top).toBeLessThan(disc.bottom)
    })
  })

  test('a 40-character name gets the whole column at 320px', async ({
    page,
  }) => {
    const slug = 'e2e-profile-header-long'
    await withPlayer({ slug, displayName: LONG_NAME }, async () => {
      await openProfile(page, slug, PHONE)

      const header = await headerLayout(page)
      // The defect this fixes: beside the disc the name had ~180 of the 230.
      expect(header.name.width).toBeCloseTo(header.column, 0)
      /* Twice the column of text cannot land in fewer than three lines, and
         none of them is a fragment — which is what shattering leaves. */
      expect(header.fills.length).toBeLessThanOrEqual(3)
      expect(header.fills.slice(0, -1).filter((fill) => fill < 0.5)).toEqual([])
      expect(header.pageOverflow).toBe(0)
    })
  })

  test('a name with nowhere to break does not push the page sideways', async ({
    page,
  }) => {
    const slug = 'e2e-profile-header-unbroken'
    await withPlayer({ slug, displayName: UNBROKEN_NAME }, async () => {
      await openProfile(page, slug, PHONE)

      const header = await headerLayout(page)
      expect(header.name.width).toBeLessThanOrEqual(header.column + 1)
      expect(header.pageOverflow).toBe(0)
    })
  })

  test('the former names and the claimed chip still read stacked', async ({
    page,
  }) => {
    const slug = 'e2e-profile-header-aliases'
    await withPlayer(
      {
        slug,
        displayName: LONG_NAME,
        aliases: ['Earlier Name', 'Even Earlier Name'],
        // Claimed by someone else, so the chip shows and the panel does not.
        ownerEmail: TEST_USERS.moderator.email,
      },
      async () => {
        await openProfile(page, slug, PHONE)

        const former = page.getByText('previously known as', { exact: false })
        const chip = page.getByText('Claimed', { exact: true })
        await expect(former).toBeVisible()
        await expect(former).toContainText('Earlier Name, Even Earlier Name')
        await expect(chip).toBeVisible()

        // Both inside the column they were given, and below the name.
        const header = await headerLayout(page)
        for (const line of [former, chip]) {
          const box = (await line.boundingBox())!
          expect(box.y).toBeGreaterThanOrEqual(header.name.bottom - 1)
          expect(box.x).toBeGreaterThanOrEqual(header.name.left - 1)
          expect(box.x + box.width).toBeLessThanOrEqual(
            header.name.left + header.column + 1,
          )
        }
        expect(header.pageOverflow).toBe(0)
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
      const slug = 'e2e-profile-header-cta'
      await withPlayer({ slug, displayName: LONG_NAME }, async () => {
        await openProfile(page, slug, PHONE)
        await expect(
          page.getByRole('link', { name: 'Claim this page' }),
        ).toBeVisible()

        expect(await reachFaults(page, HEADER_REACH)).toEqual([])
      })
    })

    /* A seeded player holds no titles, so their header carries no enrichment
       stats and the vehicle link inside them never renders. Reached through
       the leaderboard rather than seeded, so the fixture is whichever holder
       this corpus actually has — the seed's, or production's. */
    test('can tap the longest-held vehicle a real holder carries', async ({
      page,
    }) => {
      await page.setViewportSize(PHONE)
      await page.goto('/grb/leaderboard')
      const topHolder = page
        .getByRole('listitem')
        .first()
        .getByRole('link')
        .first()
      await expect(topHolder).toBeVisible()
      await topHolder.click()
      await expect(page.getByText('Longest held')).toBeVisible()

      expect(await reachFaults(page, HEADER_REACH)).toEqual([])
    })
  })

  test.describe('a signed-in visitor', () => {
    test.use({ storageState: STATE.moderator })

    test('can tap the claim form it opens', async ({ page }) => {
      const slug = 'e2e-profile-header-form'
      await withPlayer({ slug, displayName: LONG_NAME }, async () => {
        await openProfile(page, slug, PHONE)
        await page.getByRole('button', { name: 'Claim this page' }).click()
        await expect(
          page.getByRole('button', { name: 'Request claim' }),
        ).toBeVisible()

        expect(await reachFaults(page, HEADER_REACH)).toEqual([])
      })
    })
  })

  test.describe('the page owner', () => {
    test.use({ storageState: STATE.viewer })

    test('can tap the avatar controls and the release', async ({ page }) => {
      const slug = 'e2e-profile-header-owner'
      await withPlayer(
        {
          slug,
          displayName: LONG_NAME,
          ownerEmail: TEST_USERS.viewer.email,
        },
        async () => {
          await openProfile(page, slug, PHONE)
          await expect(
            page.getByRole('button', { name: 'Upload photo', exact: true }),
          ).toBeVisible()

          expect(await reachFaults(page, HEADER_REACH)).toEqual([])

          // Releasing is a two-step confirm, and its two quiet text buttons are
          // only in the tree once the first step has been taken.
          await page.getByRole('button', { name: 'Release claim' }).click()
          await expect(page.getByRole('button', { name: 'Keep' })).toBeVisible()

          expect(await reachFaults(page, HEADER_REACH)).toEqual([])
        },
      )
    })
  })
})
