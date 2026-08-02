import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openNav } from './support/nav'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

/** 44px is WCAG 2.5.5 Target Size (Enhanced) — level AAA, and what Apple's HIG
    asks for. PRODUCT.md names phones at the hangar screen as a real scene, and
    this is the site's primary navigation there, so it holds itself to that. */
const FLOOR = 44

const WIDTHS = [320, 390, 639, 640, 1280]

/** 344 is where the pane used to snap back to two rows, and 640 is where the
    cluster loses its `ml-auto` and closes on the mode pills. */
const MODERATOR_WIDTHS = [320, 344, 390, 640, 1280]

/** Asks the page who would receive a tap at each point around a control, and
    reports the box it actually owns. Measuring the reach beats probing a square
    centred on the ink: a target is no less reachable for sitting off-centre. */
async function reachOfNavControls(page: Page) {
  return page.evaluate((floor) => {
    const header = document.querySelector('header')
    if (!header) throw new Error('the nav never rendered')

    return [...header.querySelectorAll<HTMLElement>('a, button')].map((el) => {
      const ink = el.getBoundingClientRect()
      const cx = ink.left + ink.width / 2
      const cy = ink.top + ink.height / 2
      const owns = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y)
        return !!hit && (hit === el || el.contains(hit))
      }
      /* Ownership runs contiguously out from the ink, so where it stops can be
         bisected rather than walked. Reaching past the widest control here
         means an arm measures the true edge, not the bound. */
      const arm = (dx: number, dy: number) => {
        let held = 0
        let lost = floor * 2
        if (owns(cx + dx * lost, cy + dy * lost)) return lost
        for (let i = 0; i < 10; i++) {
          const mid = (held + lost) / 2
          if (owns(cx + dx * mid, cy + dy * mid)) held = mid
          else lost = mid
        }
        return held
      }

      const left = arm(-1, 0)
      const right = arm(1, 0)
      const up = arm(0, -1)
      const down = arm(0, 1)
      /* The arms only prove a cross. Slide the widest square they allow into
         that cross and check its corners, so an L-shaped reach cannot pass. */
      const x0 = Math.min(
        Math.max(cx - left, cx - floor / 2),
        cx + right - floor,
      )
      const y0 = Math.min(Math.max(cy - up, cy - floor / 2), cy + down - floor)
      const square = [
        [x0, y0],
        [x0 + floor, y0],
        [x0, y0 + floor],
        [x0 + floor, y0 + floor],
      ].every(([x, y]) => owns(x, y))
      // Inset, because right and bottom are the first pixel past the ink.
      const inkHeld = [
        [ink.left + 1, ink.top + 1],
        [ink.right - 1, ink.top + 1],
        [ink.left + 1, ink.bottom - 1],
        [ink.right - 1, ink.bottom - 1],
      ].every(([x, y]) => owns(x, y))

      /* A reach that hangs outside the pane would take taps meant for the
         content scrolling under it — the risk a reach carries once it stops
         being centred. Slack of a pixel, because hit testing snaps to the
         device grid and the arms are measured, not read off the box. */
      const pane = header.getBoundingClientRect()
      const inPane =
        cy - up >= pane.top - 1 &&
        cy + down <= pane.bottom + 1 &&
        cx - left >= pane.left - 1 &&
        cx + right <= pane.right + 1

      return {
        label: (el.getAttribute('aria-label') ?? el.textContent).trim(),
        ink: `${ink.width.toFixed(1)}x${ink.height.toFixed(1)}`,
        reach: { w: left + right, h: up + down },
        square,
        inkHeld,
        inPane,
      }
    })
  }, FLOOR)
}

async function faultsInReach(page: Page) {
  const controls = await reachOfNavControls(page)
  expect(controls.length, 'the nav had no controls to measure').toBeGreaterThan(
    0,
  )
  return controls.flatMap((c) => {
    const at = `${c.label} (ink ${c.ink}, reach ${c.reach.w.toFixed(1)}x${c.reach.h.toFixed(1)})`
    if (c.reach.w < FLOOR || c.reach.h < FLOOR)
      return [`${at} is under ${FLOOR}`]
    if (!c.square) return [`${at} reaches in a cross, not a square`]
    if (!c.inkHeld) return [`${at} has its own ink taken by a neighbour`]
    if (!c.inPane) return [`${at} reaches outside the pane`]
    return []
  })
}

async function navHeight(page: Page) {
  return page
    .locator('header')
    .first()
    .evaluate((el) => el.getBoundingClientRect().height)
}

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

/** Re-measures with the reach withdrawn, so the nav is compared against itself
    rather than against a number that rots the next time the pane is tuned. */
async function heightWithoutReach(page: Page) {
  await page.addStyleTag({ content: '.tap-reach::after { display: none }' })
  return navHeight(page)
}

for (const width of WIDTHS) {
  test(`every nav control can be tapped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openNav(page)

    expect(await faultsInReach(page)).toEqual([])
  })
}

/* Lighting cannot move a hit box, but the pane is worn both ways and its two
   fills are separate rules — a hit box lost to one of them would hide here. */
for (const theme of ['dark', 'light'] as const) {
  test(`every nav control can be tapped in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openNav(page, { theme })

    expect(await faultsInReach(page)).toEqual([])
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

      expect(await faultsInReach(page)).toEqual([])
    })
  }

  test('the nav is no taller for the reach with the Admin entry', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await openNav(page)
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()

    expect(await navHeight(page)).toBe(await heightWithoutReach(page))
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
})

/* elementFromPoint says who owns the pixel; only a real tap proves the widened
   reach carries the control's own behaviour with it. */
test('a tap at the far edge of the search reach still opens search', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openNav(page)

  const box = await page.getByRole('link', { name: 'Search' }).boundingBox()
  expect(box).not.toBeNull()
  const arm = FLOOR / 2 - 0.5
  await page.mouse.click(
    box!.x + box!.width / 2 - arm,
    box!.y + box!.height / 2 - arm,
  )
  await expect(page).toHaveURL(/\/search/)
})

for (const width of [320, 390, 1280]) {
  test(`the nav is no taller for the reach at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openNav(page)

    expect(await navHeight(page)).toBe(await heightWithoutReach(page))
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

    expect((await navHeight(page)) / 844).toBeLessThanOrEqual(0.12)
  })
}
