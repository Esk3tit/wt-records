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
export async function readerScrollsTo(page: Page, top: number, within = 8) {
  const { width, height } = page.viewportSize() ?? { width: 1280, height: 720 }
  await page.mouse.move(width / 2, height / 2)
  const where = () => page.evaluate(() => Math.round(window.scrollY))
  for (let attempt = 0; attempt < 12; attempt++) {
    if (Math.abs((await where()) - top) <= within) {
      await settle(page)
      if (Math.abs((await where()) - top) <= within) return
      continue
    }
    await page.mouse.wheel(0, top - (await where()))
    await settle(page)
  }
  throw new Error(`the page would not hold at ${top}px`)
}

/** How far this page can actually be scrolled, so a depth the content cannot
    reach is skipped rather than read at whatever position it stopped at. */
export async function deepestScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
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
    if (!pane) throw new Error('the pane never rendered')
    const fill = () => getComputedStyle(pane, '::before').opacity
    const was = fill()
    return new Promise((done) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => done(was === fill())),
      ),
    )
  })
}

/** Pins a band of one flat colour behind the nav — the worst backdrop a page
    could ever scroll beneath it. It goes in as a sibling of the header so it
    shares the stacking context the header's own z-index is resolved in; put it
    at the root instead and it paints straight over the pane. That it landed
    *behind* is asserted, not assumed, because a band in front reads as a
    perfect 1:1 and every ink on it looks fine. */
export async function pinUnderNav(page: Page, colour: string) {
  await page.evaluate((c) => {
    const header = document.querySelector('header')
    if (!header?.parentElement) throw new Error('the nav never rendered')
    const band = document.createElement('div')
    band.style.cssText = `position:fixed;left:0;right:0;top:0;height:200px;z-index:30;background:${c}`
    header.parentElement.insertBefore(band, header)

    const box = header.getBoundingClientRect()
    const over = document.elementFromPoint(box.x + box.width / 2, box.y + 2)
    if (!over || !header.contains(over))
      throw new Error('the band covered the nav instead of sitting behind it')
  }, colour)
}
