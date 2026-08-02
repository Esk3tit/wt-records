import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { FLOOR, bringIntoView, heightOf, reachFaults } from './support/reach'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

/** Filtering is the main thing a reader does at the hangar screen, so every
    control in the panel holds itself to the same 44px the nav does. The
    ledger's head and pager are the rest of that reader's reach. */
const PANEL = '.glass-thin:has(#vehicle-filter-groups)'
/* The panel is its own pane with the ledger just below it, and the head is
   sticky over its own rows — a reach past either edge would take taps meant for
   the table. The pager sits in open margin and has nothing to take, so it is
   held only to its neighbours. */
const FILTERS = { root: PANEL, pane: PANEL }
const HEAD = { root: 'thead', pane: 'thead' }
const PAGER = { root: 'nav[aria-label="Pages"]' }

/* Wrapping is decided by width alone, so the panel is measured on a screen tall
   enough to hold all of it at once — a control scrolled off the edge reports no
   owner at all and would read as a fault it isn't. */
const TALL = 2400

const PHONES = [320, 390]
const LIGHTING = ['dark', 'light'] as const

async function openBrowse(
  page: Page,
  {
    width,
    theme = 'dark',
    path = '/grb/vehicles',
  }: { width: number; theme?: 'dark' | 'light'; path?: string },
) {
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
  await page.setViewportSize({ width, height: TALL })
  await page.goto(path)
  // The panel, not the ledger: a nation sheet mounts the same filters over a
  // card wall rather than a table.
  await expect(page.locator(PANEL)).toBeVisible()
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

/* Lighting cannot move a hit box, but the panel is worn both ways and its two
   fills are separate rules — a hit box lost to one of them would hide here. */
for (const width of [...PHONES, 640, 1280]) {
  for (const theme of LIGHTING) {
    test(`every filter control can be tapped at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await openBrowse(page, { width, theme })
      await openFilters(page)

      expect(await reachFaults(page, FILTERS)).toEqual([])
    })
  }
}

/* Folded, the panel is two controls and its own padding — the state every phone
   reader meets first, and the one where the disclosure is the only door to any
   filter at all. */
for (const width of PHONES) {
  for (const theme of LIGHTING) {
    test(`the folded panel can be tapped at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await openBrowse(page, { width, theme })
      await expect(
        page.getByRole('button', { name: /Filters/ }),
      ).toHaveAttribute('aria-expanded', 'false')

      expect(await reachFaults(page, FILTERS)).toEqual([])
    })
  }
}

/* The nation sheet mounts the same panel without a name search, so its
   disclosure sits at the panel's own top edge rather than under a field. */
for (const width of PHONES) {
  test(`the nation sheet's filters can be tapped at ${width}px`, async ({
    page,
  }) => {
    await openBrowse(page, { width, path: '/grb/nation/germany' })
    await openFilters(page)

    expect(await reachFaults(page, FILTERS)).toEqual([])
  })
}

for (const width of [...PHONES, 1280]) {
  test(`the ledger head can be sorted by thumb at ${width}px`, async ({
    page,
  }) => {
    await openBrowse(page, { width })
    await bringIntoView(page, 'thead')

    expect(await reachFaults(page, HEAD)).toEqual([])
  })
}

for (const width of PHONES) {
  test(`the pager can be tapped at ${width}px`, async ({ page }) => {
    await openBrowse(page, { width })
    const pager = page.locator(PAGER.root)
    await expect(pager, 'the catalogue fits on one page').toBeVisible()
    await bringIntoView(page, PAGER.root)

    expect(await reachFaults(page, PAGER)).toEqual([])
  })
}

/* A reach withdrawn cannot see height bought with padding — an absolute
   pseudo-element never held any to begin with. So the folded panel is held to
   its share of the screen outright: 13.2% of an 844px phone today, which two
   44px controls and 40px of panel padding just fit. */
for (const width of PHONES) {
  test(`the folded panel still fits its share of a ${width}px screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/grb/vehicles')
    await expect(page.locator(PANEL)).toBeVisible()

    expect((await heightOf(page, PANEL)) / 844).toBeLessThanOrEqual(0.14)
  })
}

/* elementFromPoint says who owns the pixel; only a real tap proves the widened
   reach carries the control's own behaviour with it. The rank chips are the
   narrowest ink on the surface and the ones the reach had to widen most. */
test('a tap at the far edge of a rank chip still filters', async ({ page }) => {
  await openBrowse(page, { width: 390 })
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
