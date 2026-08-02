import type { Page } from '@playwright/test'
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

/** 344 is where the pane used to snap back to two rows, 360 is where it leaves
    its compact regime, and 640 is where the cluster loses its `ml-auto` and
    closes on the mode pills. */
const MODERATOR_WIDTHS = [320, 344, 360, 390, 640, 1280]

/* The pane is sticky, so a reach past its edge would take taps meant for the
   content scrolling under it. */
const NAV = { root: 'header', pane: 'header' } as const

/** The pane's height and the row each shared control sits on. Height alone
    would let every control slide a row together and still pass, and the harm
    here was the controls moving, not the pane growing. */
async function navSeats(page: Page) {
  return page.evaluate(() => {
    const rowOf = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error(`${selector} is not in the nav`)
      return Math.round(el.getBoundingClientRect().top)
    }
    return {
      height: document.querySelector('header')!.getBoundingClientRect().height,
      search: rowOf('header a[aria-label="Search"]'),
      modes: rowOf('header nav[aria-label="Game modes"]'),
    }
  })
}

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

/* The Admin entry exists only for moderators, so no other test renders this
   composition — and a fix aimed at the rest of the nav will leave it behind. */
test.describe('with the moderator nav', () => {
  test.use({ storageState: STATE.admin })

  for (const width of MODERATOR_WIDTHS) {
    test(`every nav control can be tapped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await openNav(page)
      await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

      expect(await reachFaults(page, NAV)).toEqual([])
    })
  }

  test('the nav is no taller for the reach with the Admin entry', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await openNav(page)
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

    expect(await heightOf(page, 'header')).toBe(
      await heightWithoutReach(page, 'header'),
    )
  })

  /* The moderator's nav is the reader's nav. Measured against this same pane
     with the entry hidden, so the bar is what every other visitor sees rather
     than a constant that rots the next time the nav is tuned. */
  for (const width of MODERATOR_WIDTHS) {
    test(`the Admin entry moves nothing at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await openNav(page)
      const admin = page.getByRole('link', { name: 'Admin' })
      await expect(admin).toBeVisible()

      const seated = await navSeats(page)
      await page.addStyleTag({ content: '[href="/admin"] { display: none }' })
      await expect(admin).toBeHidden()

      expect(seated).toEqual(await navSeats(page))
    })
  }

  /* The wordmark's width belongs to whatever `ui-sans-serif` resolves to, and
     that is a different face on every platform: this fitted at 320px on macOS
     and wrapped on CI's Linux stack, where the mark drew 11% wider. A test
     cannot render a face the machine does not have, so it grows the wordmark
     past that delta instead and asks the question the face would have asked —
     is the cluster still beside it, or has it dropped below? */
  const WIDER_FACE = 1.15

  for (const width of [320, 360]) {
    test(`row one seats a wider wordmark at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await openNav(page)
      await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

      const apart = await page.evaluate((grow) => {
        const header = document.querySelector('header')!
        const brand = header.firstElementChild as HTMLElement
        const cluster = header.lastElementChild as HTMLElement
        const size = parseFloat(getComputedStyle(brand).fontSize)
        brand.style.fontSize = `${size * grow}px`
        const middle = (el: Element) => {
          const box = el.getBoundingClientRect()
          return box.top + box.height / 2
        }
        return Math.abs(middle(brand) - middle(cluster))
      }, WIDER_FACE)

      expect(apart, 'the cluster left the wordmark’s row').toBeLessThan(8)
    })
  }
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
