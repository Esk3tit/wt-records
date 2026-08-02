import { expect, test } from '@playwright/test'
import { openNav } from './support/nav'
import {
  heightOf,
  heightWithoutReach,
  reachFaults,
  tapFarEdge,
} from './support/reach'
import { STATE } from './support/states'
import { LIGHTING } from './support/theme'

test.use({ storageState: STATE.anon })

const WIDTHS = [320, 390, 639, 640, 1280]

/* The pane is sticky, so a reach past its edge would take taps meant for the
   content scrolling under it. */
const NAV = { root: 'header', pane: 'header' } as const

for (const width of WIDTHS) {
  test(`every nav control can be tapped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openNav(page)

    expect(await reachFaults(page, NAV)).toEqual([])
  })
}

/* Lighting cannot move a hit box, but the pane is worn both ways and its two
   fills are separate rules — a hit box lost to one of them would hide here. */
for (const theme of LIGHTING) {
  test(`every nav control can be tapped in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openNav(page, { theme })

    expect(await reachFaults(page, NAV)).toEqual([])
  })
}

/* The Admin link only exists for moderators, and it is the smallest ink in the
   nav — the one most likely to be left behind by a fix aimed at the rest. It
   also wraps the nav to a third row, where a fix paid for in spacing tells. */
test.describe('with the moderator nav', () => {
  test.use({ storageState: STATE.admin })

  for (const width of [320, 390]) {
    test(`every nav control can be tapped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await openNav(page)
      await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

      expect(await reachFaults(page, NAV)).toEqual([])
    })
  }

  test('the nav is no taller for the reach on its third row', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await openNav(page)
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

    expect(await heightOf(page, 'header')).toBe(
      await heightWithoutReach(page, 'header'),
    )
  })
})

test('a tap at the far edge of the search reach still opens search', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openNav(page)

  await tapFarEdge(page, page.getByRole('link', { name: 'Search' }))

  await expect(page).toHaveURL(/\/search/)
})

for (const width of [320, 390, 1280]) {
  test(`the nav is no taller for the reach at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openNav(page)

    expect(await heightOf(page, 'header')).toBe(
      await heightWithoutReach(page, 'header'),
    )
  })
}

/* Withdrawing the reach cannot see height bought with spacing — and a reach
   rebuilt out of padding would withdraw to nothing and pass. So the reader's
   nav is held to its share outright: 11.8% of an 844px screen today. */
for (const width of [320, 390]) {
  test(`the wrapped nav still fits its share of a ${width}px screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await openNav(page)

    expect((await heightOf(page, 'header')) / 844).toBeLessThanOrEqual(0.12)
  })
}
