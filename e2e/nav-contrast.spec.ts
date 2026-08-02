import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { faultsInInk, readInk, worstDownThePage } from './support/contrast'
import { openNav, paneStill, pinUnderNav, readerScrollsTo } from './support/nav'
import { STATE } from './support/states'

/** WCAG 1.4.3 asks nothing of text that is part of a logo or brand name, and
    the wordmark's amber separator is exactly that — a mark, carrying no reading.
    Everything the nav asks anyone to read is measured. This exempts a subtree,
    so the tests assert the home link still holds nothing but the wordmark. */
const WORDMARK = 'a[href="/"]'

/** The pane turns solid after 64px of overlap, so 32 catches the one window
    where content sits under glass that is still thin — and it only lands if the
    helper's tolerance is tighter than the gap to 0. The rest are places a reader
    stops; 800 is where the failure was first measured. */
const DEPTHS = [0, 32, 400, 800, 1200, 1600, 2400]

async function worstNavDownThePage(page: Page) {
  await expect(page.locator(`header ${WORDMARK}`)).toHaveCount(1)
  return faultsInInk(
    await worstDownThePage(page, {
      root: 'header',
      exempt: WORDMARK,
      depths: DEPTHS,
      settle: () => paneStill(page),
    }),
  )
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`in ${theme}`, () => {
    test.use({ storageState: STATE.anon })

    /* A nation sheet is the brightest hall the site has, and the mode landing
       carries the monument — the largest, lightest type that passes under. */
    for (const path of ['/grb', '/grb/nation/usa']) {
      test(`every ink in the nav is legible on ${path}`, async ({ page }) => {
        await openNav(page, { path, theme })

        expect(await worstNavDownThePage(page)).toEqual([])
      })
    }

    test('every ink in the wrapped nav is legible on a phone', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await openNav(page, { theme })

      expect(await worstNavDownThePage(page)).toEqual([])
    })

    /* Depths on real routes only prove those pages today. A flat band pinned
       behind the pane bounds the extremes instead — which holds for the nav's
       current ink, all of it far lighter or darker than the range the veil
       leaves reachable. A mid-luminance ink would need its own band. */
    for (const colour of ['#fff', '#000']) {
      test(`no page can beat the risen nav under ${colour}`, async ({
        page,
      }) => {
        await openNav(page, { theme })
        await pinUnderNav(page, colour)
        await readerScrollsTo(page, 800)
        await paneStill(page)

        expect(faultsInInk(await readInk(page, 'header', WORDMARK))).toEqual([])
      })
    }

    /* Hover paints a fill under ink that is already at its floor, and a fill of
       its own is exactly how the Admin chip failed. */
    for (const name of ['Search', 'Switch to']) {
      test(`the nav stays legible with ${name} hovered`, async ({ page }) => {
        await openNav(page, { theme })
        await readerScrollsTo(page, 800)
        await page
          .getByRole(name === 'Search' ? 'link' : 'button', {
            name: new RegExp(name),
          })
          .hover()
        await paneStill(page)

        expect(faultsInInk(await readInk(page, 'header', WORDMARK))).toEqual([])
      })
    }

    /* Medal Amber Deep is the one token here with reach past the nav, and the
       kicker is where it is set smallest. */
    test('the live-registry kicker clears the floor', async ({ page }) => {
      await openNav(page, { theme })

      expect(faultsInInk(await readInk(page, '.kicker', ''))).toEqual([])
    })
  })

  /* The Admin chip is ink most readers never see, so nothing else would catch
     it drifting — and it wore a fill of its own, on a surface already at its
     floor. */
  test.describe(`in ${theme}, for a moderator`, () => {
    test.use({ storageState: STATE.admin })

    test('every ink in the nav is legible', async ({ page }) => {
      await openNav(page, { theme })
      await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

      expect(await worstNavDownThePage(page)).toEqual([])
    })
  })
}
