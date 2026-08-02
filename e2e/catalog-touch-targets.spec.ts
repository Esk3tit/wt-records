import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  REACH_FLOOR,
  UNBOUNDED,
  bringIntoView,
  heightOf,
  reachFaults,
  tapFarEdge,
} from './support/reach'
import { STATE } from './support/states'
import type { Lighting } from './support/theme'
import { LIGHTING, stampTheme } from './support/theme'

test.use({ storageState: STATE.anon })

/** Filtering is the main thing a reader does at the hangar screen, so every
    control in the panel holds itself to the same 44px the nav does. The
    ledger's head and pager are the rest of that reader's reach. */
const PANEL = '.glass-thin:has(#vehicle-filter-groups)'
/* The panel is its own pane with the ledger just below it, and the head is
   sticky over its own rows, so a reach past either edge would take taps meant
   for the table. The pager is the one region with open margin on every side. */
const FILTERS = { root: PANEL, pane: PANEL }
const HEAD = { root: 'thead', pane: 'thead' }
const PAGER = { root: 'nav[aria-label="Pages"]', pane: UNBOUNDED }

/* Wrapping is decided by width alone, so the panel is measured on a screen tall
   enough to hold all of it at once — a control scrolled off the edge reports no
   owner at all and would read as a fault it isn't. */
const TALL = 2400

const PHONES = [320, 390]

async function openBrowse(
  page: Page,
  {
    width,
    theme = 'dark',
    path = '/grb/vehicles',
  }: { width: number; theme?: Lighting; path?: string },
) {
  await stampTheme(page, theme)
  await page.setViewportSize({ width, height: TALL })
  await page.goto(path)
  // The panel, not the ledger: a nation sheet mounts the same filters over a
  // card wall rather than a table.
  await expect(page.locator(PANEL)).toBeVisible()
  /* The panel is server-rendered, so waiting for it proves nothing about its
     handlers — a disclosure clicked before hydration swallows the click and
     stays folded. The theme toggle mounts client-side, so it is the page's
     signal that React has taken the markup over. */
  await expect(page.getByRole('button', { name: /Switch to/ })).toBeVisible()
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

/* Measured parked rather than pinned: sticky lives on the `th`, so a stuck head
   leaves `thead`'s own box behind and containment would report on a box the
   controls have left. Only the head's fill changes when it sticks, never its
   geometry, so parked is the honest place to measure it. */
for (const width of [...PHONES, 1280]) {
  for (const theme of LIGHTING) {
    test(`the ledger head can be sorted by thumb at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await openBrowse(page, { width, theme })
      await bringIntoView(page, 'thead')

      expect(await reachFaults(page, HEAD)).toEqual([])
    })
  }
}

for (const width of PHONES) {
  for (const theme of LIGHTING) {
    test(`the pager can be tapped at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await openBrowse(page, { width, theme })
      const pager = page.locator(PAGER.root)
      // The seeded catalogue is one page long, so CI has no pager to measure.
      // Skipped rather than passed vacuously, and loudly rather than silently.
      test.skip(
        !(await pager.isVisible()),
        'this catalogue fits on one page — no pager rendered',
      )
      await bringIntoView(page, PAGER.root)

      expect(await reachFaults(page, PAGER)).toEqual([])
    })
  }
}

/* A reach withdrawn cannot see height bought with padding — an absolute
   pseudo-element never held any to begin with. So the panel is held to two
   budgets it could actually blow: the folded state to its share of the screen,
   and the chip grid to a pitch that clears a thumb without paying for more than
   one. Chips grown to a full 44px of ink, or a row gap opened to carry the
   whole reach, would each trip the ceiling. */
for (const width of PHONES) {
  test(`the folded panel still fits its share of a ${width}px screen`, async ({
    page,
  }) => {
    await openBrowse(page, { width })
    await page.setViewportSize({ width, height: 844 })

    expect((await heightOf(page, PANEL)) / 844).toBeLessThanOrEqual(0.14)
  })

  test(`the chip grid spends a thumb and no more at ${width}px`, async ({
    page,
  }) => {
    await openBrowse(page, { width })
    await openFilters(page)

    const pitch = await page.evaluate(() => {
      const rows = new Map<number, number>()
      for (const chip of document.querySelectorAll<HTMLElement>(
        '#vehicle-filter-groups fieldset button',
      )) {
        const box = chip.getBoundingClientRect()
        rows.set(Math.round(box.top), box.height)
      }
      const tops = [...rows.keys()].sort((a, b) => a - b)
      // Only gaps inside one group: the step across a group boundary carries a
      // legend, which is spacing the reach never has to clear.
      const steps = tops
        .slice(1)
        .map((top, i) => top - tops[i])
        .filter((step) => step < 60)
      return Math.min(...steps)
    })

    expect(pitch).toBeGreaterThanOrEqual(REACH_FLOOR)
    expect(pitch).toBeLessThanOrEqual(REACH_FLOOR + 4)
  })
}

/* The rank chips are the narrowest ink on the surface and the ones the reach
   had to widen most. Which ranks exist is the corpus's business — a seed holds
   a handful and production holds them all — so the fixture is whichever chip
   the group leads with rather than a numeral this catalogue may not stock. */
test('a tap at the far edge of a rank chip still filters', async ({ page }) => {
  await openBrowse(page, { width: 390 })
  await openFilters(page)

  const chip = page
    .locator('#vehicle-filter-groups fieldset', { hasText: 'Rank' })
    .getByRole('button')
    .first()
  await expect(chip).toHaveAttribute('aria-pressed', 'false')

  await tapFarEdge(page, chip)

  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/[?&]rank=\d/)
})
