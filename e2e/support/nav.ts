import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** The toggle mounts client-side, so it is the last ink in the nav to exist.
    Theme is stamped first because the pane wears a different fill in each. */
export async function openNav(
  page: Page,
  {
    path = '/grb',
    theme = 'dark',
  }: { path?: string; theme?: 'dark' | 'light' } = {},
) {
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
  await page.goto(path)
  await expect(page.getByRole('button', { name: /Switch to/ })).toBeVisible()
}

/** Scrolls the way a reader does, and holds there. It has to be a real wheel:
    motion is armed by genuine input, and a scripted `scrollTo` is undone the
    moment the router restores the entry — which also settles after hydration
    and yanks the page back once, so the target is re-asserted until it sticks. */
export async function readerScrollsTo(page: Page, top: number) {
  const { width, height } = page.viewportSize() ?? { width: 1280, height: 720 }
  await page.mouse.move(width / 2, height / 2)
  const where = () => page.evaluate(() => Math.round(window.scrollY))
  for (let attempt = 0; attempt < 12; attempt++) {
    if (Math.abs((await where()) - top) < 60) {
      await settle(page)
      if (Math.abs((await where()) - top) < 60) return
      continue
    }
    await page.mouse.wheel(0, top - (await where()))
    await settle(page)
  }
  throw new Error(`the page would not hold at ${top}px`)
}

/** Waits for scrolling to actually stop, then keeps waiting. The frame-stable
    check alone is not enough: scroll restoration settles well after hydration,
    and a caller that proceeds the moment the wheel stops can navigate before
    the position it is about to step back to has been recorded. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    const was = window.scrollY
    return new Promise((done) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => done(window.scrollY === was)),
      ),
    )
  })
  await page.waitForTimeout(200)
}

/** Holds until the veil stops moving. Measuring is the one job that cannot
    tolerate a pane caught mid-rise: a half-faded veil reads as a thinner one
    and reports a contrast the reader never sees. */
export async function paneStill(page: Page) {
  await page.waitForFunction(() => {
    const pane = document.querySelector('.nav-pane')
    if (!pane) return true
    const fill = () => getComputedStyle(pane, '::before').opacity
    const was = fill()
    return new Promise((done) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => done(was === fill())),
      ),
    )
  })
}

/** Pins a band of one flat colour under the nav — the worst backdrop any page
    could ever scroll beneath it. It has to go inside the nav's own stacking
    context, or the app root's confines it below the band instead. */
export async function pinUnderNav(page: Page, colour: string) {
  await page.evaluate((c) => {
    const header = document.querySelector('header')
    if (!header?.parentElement) throw new Error('the nav never rendered')
    const band = document.createElement('div')
    band.dataset.band = ''
    band.style.cssText = `position:fixed;left:0;right:0;top:0;height:200px;z-index:30;background:${c}`
    header.parentElement.insertBefore(band, header)
  }, colour)
}
