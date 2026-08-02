import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  faultsInInk,
  pinScene,
  readInk,
  unmeasured,
  unreadable,
  worstDownThePage,
} from './support/contrast'
import { openNav, readerScrollsTo } from './support/nav'
import { STATE } from './support/states'

/* The nav has its own guard; this one owns everything the nav floats over.
   Both exist because the failure is the same one seen from either side — ink
   and the lit surface under it are settled at render, so neither a token nor a
   review of the stylesheet can tell you which way it went. */

/** Where a reader stops. 0 puts the top of the page clear of the nav; the rest
    walk the panes down past the brightest parts of the scene, and far enough
    that a ledger's later rows and a wall's lower ranks are read too. */
const DEPTHS = [0, 600, 1400, 2400, 3600]

/** Each route, and the sites it is visited *for* — asserted to have produced a
    reading, so a renamed class cannot quietly empty a sweep that goes on
    passing. Named by the fragment their `where` carries. */
const ROUTES: { path: string; sites: string[] }[] = [
  // The podium's metal panes, its rank chips, and the monument's own labels.
  { path: '/grb', sites: ['section-label', 'stat-unit', 'chip-well'] },
  // Standings rows: metal tint and flag wash under a row that is ink throughout.
  { path: '/grb/nations', sites: ['stat-unit', 'stat-label'] },
  // The record wall, where the acquisition material meets the card's own ink.
  { path: '/grb/nation/usa', sites: ['text-fg-faint', 'stat-unit'] },
  { path: '/grb/vehicles', sites: ['text-fg-muted'] },
  { path: '/grb/leaderboard', sites: ['text-fg-faint'] },
  { path: '/search?q=a', sites: ['section-label'] },
]

async function open(page: Page, path: string, theme: 'dark' | 'light') {
  await openNav(page, { path, theme })
}

/** The first link matching a route shape, so fixtures come from live data and
    these hold against the seed and a real corpus alike. */
async function firstPath(page: Page, shape: RegExp) {
  const href = await page
    .locator('a[href]')
    .evaluateAll(
      (links, source) =>
        (links as HTMLAnchorElement[])
          .map((a) => new URL(a.href).pathname)
          .find((path) => new RegExp(source).test(path)) ?? '',
      shape.source,
    )
  expect(href, `no ${shape} link to follow`).toBeTruthy()
  return href
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`in ${theme}`, () => {
    test.use({ storageState: STATE.anon })

    for (const { path, sites } of ROUTES) {
      test(`every ink on ${path} is legible`, async ({ page }) => {
        await open(page, path, theme)

        const readings = await worstDownThePage(page, { depths: DEPTHS })
        expect(unmeasured(readings, sites)).toEqual([])
        expect(faultsInInk(readings)).toEqual([])
      })
    }

    /* The two sheets, whose fixtures have to come from live data. The vehicle
       sheet is the surface the wash rule was written for, and both close on a
       Medallion — a monogram struck into its own lit disc, and the one piece of
       ink on the site painted with `fill` rather than `color`. */
    test('every ink on a vehicle sheet is legible', async ({ page }) => {
      await open(page, '/grb/vehicles', theme)
      const sheet = await firstPath(page, /^\/grb\/vehicle\//)
      await open(page, sheet, theme)

      const readings = await worstDownThePage(page, { depths: DEPTHS })
      expect(unmeasured(readings, ['stat-unit'])).toEqual([])
      expect(faultsInInk(readings)).toEqual([])
    })

    test('every ink on a player profile is legible', async ({ page }) => {
      await open(page, '/grb/leaderboard', theme)
      const profile = await firstPath(page, /^\/player\//)
      await open(page, profile, theme)

      const readings = await worstDownThePage(page, { depths: DEPTHS })
      expect(unmeasured(readings, ['section-label'])).toEqual([])
      expect(faultsInInk(readings)).toEqual([])
    })

    /* A flat band under the glass, so the panes are proved against something
       other than the scenes that happen to ship today.

       Unlike the nav's band this one is not pure black and white, and the
       difference is worth stating. The nav floats over content: a record page
       can put any luminance under it, so nothing short of both extremes is a
       bound. These panes float over the Spatial Scene, which is art direction
       rather than data — a fixed, curated, mode-adapted set. Measured, the
       night stack holds a flood to #202020 and the day stack down to #e0e0e0,
       and widening that would take a scrim opaque enough to erase the scene the
       product is built on. So this is the band the scene art has to stay
       inside, asserted rather than assumed. It floods flat, so it bounds a
       plate's overall exposure and not a local specular — a scene is still a
       thing to look at before it ships, not only to test. */
    const EDGE = theme === 'dark' ? '#202020' : '#e0e0e0'
    for (const path of ['/grb', '/grb/nation/usa', '/grb/vehicles']) {
      test(`no scene at ${EDGE} beats the panes on ${path}`, async ({
        page,
      }) => {
        await open(page, path, theme)
        await readerScrollsTo(page, 600)
        await pinScene(page, EDGE)

        expect(faultsInInk(await readInk(page, 'main', ''))).toEqual([])
      })
    }

    /* Answering the pointer lays a brighter wash under ink that is already at
       its floor — the way the nav's Admin chip failed, and the standings row is
       the one place a whole row of ink lights up at once. */
    test('a standings row stays legible while pointed at', async ({ page }) => {
      await open(page, '/grb/nations', theme)
      await page.locator('.standings-row').first().hover()

      const readings = await readInk(page, '.standings-row', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })

    /* Both panes that answer backdrop-filter's blind spot with near-opacity,
       and so lay their own fill under their own ink. */
    test('the floating lookup menu is legible', async ({ page }) => {
      await open(page, '/grb', theme)
      await page.getByRole('combobox').fill('a')
      await expect(page.locator('.menu-glass')).toBeVisible()

      const readings = await readInk(page, '.menu-glass', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })

    test('the pinned ledger head is legible', async ({ page }) => {
      await open(page, '/grb/vehicles', theme)
      await readerScrollsTo(page, 900)
      await expect(
        page.locator('.ledger-sticky[data-head-stuck="true"]'),
      ).toBeVisible()

      const readings = await readInk(page, '.ledger-sticky thead', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })
  })

  /* Back of house wears the one semantic token nothing else measures, on panes
     that are glass like every other — and it is ink most readers never see, so
     nothing else would catch it drifting. */
  test.describe(`in ${theme}, for a moderator`, () => {
    test.use({ storageState: STATE.admin })

    for (const path of ['/admin', '/admin/players']) {
      test(`every ink on ${path} is legible`, async ({ page }) => {
        await open(page, path, theme)

        expect(
          faultsInInk(await worstDownThePage(page, { depths: DEPTHS })),
        ).toEqual([])
      })
    }

    /* The warn token only paints for a queue with something pending in it, and
       a seeded queue may have nothing — leaving the one token here that nothing
       else covers resting on the claim that it is "only ever set on the base",
       which is what a status chip inside a glass panel disproves. So the state
       is simulated and the surface is not: the tone lands on a real chip, on the
       real pane, and the ratio that comes back is the one a moderator sees. */
    test('status-warn can be read on the pane it is set on', async ({
      page,
    }) => {
      await open(page, '/admin', theme)
      const chip = page.locator('.glass-thin .section-label').first()
      await expect(chip).toBeVisible()
      await chip.evaluate((el: HTMLElement) => {
        el.setAttribute('class', 'text-xs tracking-wide uppercase')
        el.classList.add('text-status-warn')
        el.textContent = 'pending'
      })

      const readings = await readInk(page, '.text-status-warn', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })
  })
}
