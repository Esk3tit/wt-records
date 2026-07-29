import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

const nav = (page: Page) => page.locator('header').first()

/** Samples the risen pane's fill as it settles, alongside the scroll it is
    answering. A value strictly between the endpoints means the reader watched
    the pane fade rather than finding it already risen. */
async function fillWhileSettling(page: Page, samples = 24) {
  const seen: { fill: number; y: number }[] = []
  for (let i = 0; i < samples; i++) {
    seen.push(
      await nav(page).evaluate((el) => ({
        fill: Number(getComputedStyle(el, '::before').opacity),
        y: Math.round(window.scrollY),
      })),
    )
    await page.waitForTimeout(45)
  }
  return {
    trace: seen.map((s) => `${s.fill.toFixed(2)}@${s.y}`).join(' '),
    ended: seen[seen.length - 1],
    faded: seen.some((s) => s.fill > 0.02 && s.fill < 0.98),
  }
}

/** The ledger streams in, so a scroll issued before it lands has nowhere to go.
    `--nav-h` is published by the mounted nav, so it also marks the point where
    the nav's own listeners exist to be armed at all. */
async function openLedger(page: Page, deepEnoughFor: number) {
  await page.goto('/grb/vehicles')
  await expect(page.getByRole('table')).toBeVisible()
  await page.waitForFunction(
    (need) =>
      document.documentElement.scrollHeight > need + window.innerHeight &&
      getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-h')
        .trim() !== '',
    deepEnoughFor,
  )
}

/** Scrolls the way a reader does, and holds there. It has to be a real wheel:
    motion is armed by genuine input, and only a real scroll is recorded for
    restoration — a scripted `scrollTo` is undone the moment the router restores
    the entry. Restoration also settles after hydration and will yank the page
    back once, so the target is re-asserted until it stays put. */
async function readerScrollsTo(page: Page, top: number) {
  await page.mouse.move(640, 400)
  const where = () => page.evaluate(() => Math.round(window.scrollY))
  for (let attempt = 0; attempt < 12; attempt++) {
    const y = await where()
    if (Math.abs(y - top) < 60) {
      await page.waitForTimeout(250)
      if (Math.abs((await where()) - top) < 60) return
      continue
    }
    await page.mouse.wheel(0, top - y)
    await page.waitForTimeout(200)
  }
  throw new Error(`the page would not hold at ${top}px`)
}

test('the pane arrives risen when the reader steps back to a restored scroll', async ({
  page,
}) => {
  await openLedger(page, 1400)
  await readerScrollsTo(page, 1400)
  await expect(nav(page)).toHaveAttribute('data-live', 'true')
  await expect(nav(page)).toHaveAttribute('data-solid', 'true')

  // A row already on screen: clicking one above the fold would scroll it into
  // view first, and that shallower position is what would be restored.
  const onScreen = await page.evaluate(() => {
    const rows = [...document.querySelectorAll<HTMLAnchorElement>('table a')]
    const hit = rows.find((a) => {
      const box = a.getBoundingClientRect()
      return box.top > 200 && box.bottom < window.innerHeight - 100
    })
    return hit?.getAttribute('href') ?? null
  })
  expect(onScreen, 'no ledger row was on screen to open').not.toBeNull()
  await page.locator(`table a[href="${onScreen}"]`).click()
  await expect(page).toHaveURL(/\/grb\/vehicle\//)
  // Arriving anywhere disarms motion, so the step back cannot animate.
  await expect(nav(page)).not.toHaveAttribute('data-live', 'true')

  await page.goBack()
  const settling = await fillWhileSettling(page)

  expect(settling.ended.y, settling.trace).toBeGreaterThan(1000)
  expect(settling.ended.fill, settling.trace).toBeCloseTo(1, 1)
  expect(settling.faded, settling.trace).toBe(false)
})

test('the pane still fades when the reader scrolls it up themselves', async ({
  page,
}) => {
  await openLedger(page, 800)
  // Let restoration finish having its say at the top, so the fade below is the
  // reader's scroll and nothing else.
  await readerScrollsTo(page, 0)

  await page.mouse.wheel(0, 800)
  const settling = await fillWhileSettling(page)

  expect(settling.ended.fill, settling.trace).toBeCloseTo(1, 1)
  expect(settling.faded, settling.trace).toBe(true)
})
