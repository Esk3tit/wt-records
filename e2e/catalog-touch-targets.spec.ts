import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  FLOOR,
  bringIntoView,
  heightOf,
  heightWithoutReach,
  reachFaults,
} from './support/reach'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

/** Filtering the catalogue is the main thing a reader does at the hangar
    screen, so every control in the panel holds itself to the same 44px the nav
    does. The ledger's head and pager are the rest of that reader's reach. */
const PANEL = '.glass-thin:has(#vehicle-filter-groups)'
/* The panel is its own pane with the ledger just below it, so a reach past its
   edge would take taps meant for the table. The pager sits in open margin and
   has nothing to take, so it is held only to its neighbours. */
const FILTERS = { root: PANEL, pane: PANEL }
const HEAD = { root: 'thead', pane: '.glass-mid' }
const PAGER = { root: 'nav[aria-label="Pages"]' }

/* Wrapping is decided by width alone, so the panel is measured on a screen tall
   enough to hold all of it at once — a control scrolled off the edge reports no
   owner at all and would read as a fault it isn't. */
const TALL = 2400

const PHONES = [320, 390]

async function openCatalogue(
  page: Page,
  { width, theme = 'dark' }: { width: number; theme?: 'dark' | 'light' },
) {
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
  await page.setViewportSize({ width, height: TALL })
  await page.goto('/grb/vehicles')
  await expect(page.getByRole('table')).toBeVisible()
}

/** The groups fold behind one disclosure on phones; nothing in them can be
    reached, or measured, until it is opened. */
async function openFilters(page: Page) {
  const disclosure = page.getByRole('button', { name: /Filters/ })
  if (await disclosure.isVisible()) {
    await disclosure.click()
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  }
  await expect(page.locator('#vehicle-filter-groups')).toBeVisible()
}

for (const width of [...PHONES, 640, 1280]) {
  test(`every filter control can be tapped at ${width}px`, async ({ page }) => {
    await openCatalogue(page, { width })
    await openFilters(page)

    expect(await reachFaults(page, FILTERS)).toEqual([])
  })
}

/* Lighting cannot move a hit box, but the panel is worn both ways and its two
   fills are separate rules — a hit box lost to one of them would hide here. */
for (const theme of ['dark', 'light'] as const) {
  test(`every filter control can be tapped in ${theme}`, async ({ page }) => {
    await openCatalogue(page, { width: 390, theme })
    await openFilters(page)

    expect(await reachFaults(page, FILTERS)).toEqual([])
  })
}

/* Folded, the panel is two controls and 40px of its own padding — the state
   every phone reader meets first, and the one where the disclosure is the only
   door to any filter at all. */
for (const width of PHONES) {
  test(`the folded panel can be tapped at ${width}px`, async ({ page }) => {
    await openCatalogue(page, { width })
    await expect(page.getByRole('button', { name: /Filters/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    expect(await reachFaults(page, FILTERS)).toEqual([])
  })
}

for (const width of [...PHONES, 1280]) {
  test(`the ledger head can be sorted by thumb at ${width}px`, async ({
    page,
  }) => {
    await openCatalogue(page, { width })
    await bringIntoView(page, 'thead')

    expect(await reachFaults(page, HEAD)).toEqual([])
  })
}

for (const width of PHONES) {
  test(`the pager can be tapped at ${width}px`, async ({ page }) => {
    await openCatalogue(page, { width })
    const pager = page.locator(PAGER.root)
    await expect(pager, 'the catalogue fits on one page').toBeVisible()
    await bringIntoView(page, PAGER.root)

    expect(await reachFaults(page, PAGER)).toEqual([])
  })
}

/* The reach is a pseudo-element so it can cost the layout nothing. Re-measured
   with it withdrawn, so the panel is compared against itself rather than
   against a number that rots the next time its density is tuned. */
for (const width of PHONES) {
  test(`the panel is no taller for the reach at ${width}px`, async ({
    page,
  }) => {
    await openCatalogue(page, { width })
    await openFilters(page)

    expect(await heightOf(page, PANEL)).toBe(
      await heightWithoutReach(page, PANEL),
    )
  })
}

/* elementFromPoint says who owns the pixel; only a real tap proves the widened
   reach carries the control's own behaviour with it. The rank chips are the
   narrowest ink on the surface and the ones the reach had to widen most. */
test('a tap at the far edge of a rank chip still filters', async ({ page }) => {
  await openCatalogue(page, { width: 390 })
  await openFilters(page)

  const chip = page.getByRole('button', { name: 'I', exact: true })
  const box = await chip.boundingBox()
  expect(box).not.toBeNull()
  const arm = FLOOR / 2 - 0.5
  await page.mouse.click(
    box!.x + box!.width / 2 - arm,
    box!.y + box!.height / 2 - arm,
  )

  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/[?&]rank=1\b/)
})
