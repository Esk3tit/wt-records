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
import { deepestScroll, openNav, readerScrollsTo } from './support/nav'
import { STATE } from './support/states'

/* The nav has its own guard; this one owns everything the nav floats over.
   Both exist because the failure is the same one seen from either side — ink
   and the lit surface under it are settled at render, so neither a token nor a
   review of the stylesheet can tell you which way it went. */

/** Where a reader stops. 0 puts the top of the page clear of the nav; the rest
    walk the panes down past the brightest parts of the scene, and far enough
    that a ledger's later rows and a wall's lower ranks are read too. */
const DEPTHS = [0, 600, 1400, 2400, 3600]

/** Each route, and the surfaces it is visited *for* — asserted to have produced
    a reading, so deleting a component or renaming its class cannot quietly
    empty a sweep that goes on passing. These name components, not utility
    classes: `text-fg-faint` is satisfied by any element anywhere on the page,
    which is no assertion at all.

    Only what the *route* guarantees, never what the *data* happens to hold. A
    chip needs a premium or removed vehicle, a Medallion needs a holder with no
    avatar — name either and a thinner seed fails this for the state of the
    corpus rather than the state of the ink. */
const ROUTES: { path: string; sites: string[] }[] = [
  // The podium's metal panes and rank chips, and the monument's own labels.
  { path: '/grb', sites: ['.podium-card', '.section-label', '.stat-unit'] },
  // A row that is ink the whole way down, under a metal tint and a flag wash.
  { path: '/grb/nations', sites: ['.standings-row', '.stat-unit'] },
  { path: '/grb/vehicles', sites: ['.ledger-sticky'] },
  { path: '/grb/leaderboard', sites: ['.leaderboard-row'] },
  { path: '/search?q=a', sites: ['.section-label'] },
]

/** Walk the page, prove the surfaces it was visited *for* produced a reading,
    then prove every ink on it clears. The three always travel together: without
    the middle one the last is satisfied by a sweep that measured nothing. */
async function sweepReads(page: Page, sites: string[]) {
  const readings = await worstDownThePage(page, { depths: DEPTHS, sites })
  expect(unmeasured(readings, sites)).toEqual([])
  expect(faultsInInk(readings)).toEqual([])
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
        await openNav(page, { path, theme })

        await sweepReads(page, sites)
      })
    }

    /* The surface the wash rule was written for, reached from live data. */
    test('every ink on a vehicle sheet is legible', async ({ page }) => {
      await openNav(page, { path: '/grb/vehicles', theme })
      const sheet = await firstPath(page, /^\/grb\/vehicle\//)
      await openNav(page, { path: sheet, theme })

      /* Not the Medallion here: this sheet shows one holder, and whether that
         holder set an avatar is the state of the data. The ledger asserts it,
         where every row carries one. */
      await sweepReads(page, ['.stat-unit'])
    })

    /* The record wall, where the acquisition material meets the card's own ink.
       Reached by following the standings rather than by naming a nation, so a
       seed that never gave the USA a vehicle still measures a real wall. */
    test('every ink on a nation record wall is legible', async ({ page }) => {
      await openNav(page, { path: '/grb/nations', theme })
      const nation = await firstPath(page, /^\/grb\/nation\//)
      await openNav(page, { path: nation, theme })

      await sweepReads(page, ['.record-card'])
    })

    test('every ink on a player profile is legible', async ({ page }) => {
      await openNav(page, { path: '/grb/leaderboard', theme })
      const profile = await firstPath(page, /^\/player\//)
      await openNav(page, { path: profile, theme })

      await sweepReads(page, ['.section-label'])
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
    for (const path of ['/grb', '/grb/nations', '/grb/vehicles']) {
      test(`no scene at ${EDGE} beats the panes on ${path}`, async ({
        page,
      }) => {
        await openNav(page, { path, theme })
        /* Clamped: a thin corpus makes some of these pages shorter than the
           scroll they are asked for, and the point is to read the panes past
           the top of the scene, not to reach an exact offset. */
        await readerScrollsTo(
          page,
          Math.max(Math.min(600, await deepestScroll(page)), 0),
        )
        await pinScene(page, EDGE)

        expect(faultsInInk(await readInk(page, 'main', ''))).toEqual([])
      })
    }

    /* The washes are masked in proportions, not pixels, so the narrowest
       viewport is where a pool can slide off the art it was cut for and back
       under the ink. The record wall folds hardest here. */
    test('every ink on the record wall is legible at 320px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 720 })
      await openNav(page, { path: '/grb/nations', theme })
      const nation = await firstPath(page, /^\/grb\/nation\//)
      await openNav(page, { path: nation, theme })

      await sweepReads(page, ['.record-card'])
    })

    /* Answering the pointer lays a brighter wash under ink that is already at
       its floor — the way the nav's Admin chip failed, and the standings row is
       the one place a whole row of ink lights up at once. */
    test('a standings row stays legible while pointed at', async ({ page }) => {
      await openNav(page, { path: '/grb/nations', theme })
      await page.locator('.standings-row').first().hover()

      const readings = await readInk(page, '.standings-row', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })

    /* Both panes that answer backdrop-filter's blind spot with near-opacity,
       and so lay their own fill under their own ink — read against the band
       rather than today's scene, since a pane that near-opaque is exactly the
       one whose margin a brighter plate would eat. */
    test('the floating lookup menu is legible', async ({ page }) => {
      await openNav(page, { path: '/grb', theme })
      await page.getByRole('combobox').fill('a')
      await expect(page.locator('.menu-glass')).toBeVisible()

      await pinScene(page, EDGE)
      const readings = await readInk(page, '.menu-glass', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })

    test('the pinned ledger head is legible', async ({ page }) => {
      await openNav(page, { path: '/grb/vehicles', theme })
      await readerScrollsTo(page, 900)
      await expect(
        page.locator('.ledger-sticky[data-head-stuck="true"]'),
      ).toBeVisible()

      await pinScene(page, EDGE)
      const readings = await readInk(page, '.ledger-sticky thead', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })
  })

  /* Back of house wears the one semantic token nothing else measures, on panes
     that are glass like every other — and it is ink most readers never see, so
     nothing else would catch it drifting. */
  test.describe(`in ${theme}, for a moderator`, () => {
    test.use({ storageState: STATE.moderator })

    /* `.glass-thin` is the admin panel itself, so it stands for the whole
       surface. The claimed chip is not named here: it paints only for a Player
       someone has claimed, and a seed without one would fail this for the state
       of the data rather than the state of the ink. */
    for (const [path, sites] of [
      ['/admin', ['.section-label', '.glass-thin']],
      ['/admin/players', ['.glass-thin']],
    ] as const) {
      test(`every ink on ${path} is legible`, async ({ page }) => {
        await openNav(page, { path, theme })

        await sweepReads(page, [...sites])
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
      await openNav(page, { path: '/admin', theme })
      const chip = page.locator('.glass-thin .section-label').first()
      await expect(chip).toBeVisible()
      /* The class is replaced rather than added to, so what gets measured is a
         status chip and not a section label wearing a status colour. The marker
         is what the reading is then taken from: `.text-status-warn` alone would
         resolve to whichever element carries it first, which on a queue that
         does have something pending is a different chip entirely. */
      await chip.evaluate((el: HTMLElement) => {
        el.setAttribute(
          'class',
          'status-warn-probe text-xs tracking-wide uppercase text-status-warn',
        )
        el.textContent = 'pending'
      })

      const readings = await readInk(page, '.status-warn-probe', '')
      expect(faultsInInk(readings)).toEqual([])
      expect(unreadable(readings)).toEqual([])
    })
  })
}
