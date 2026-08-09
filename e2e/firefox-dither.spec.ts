import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

/* Gecko does not dither its own gradients, so `.scene-dither` supplies the
   noise that keeps the metal panes from banding. The whole fix lives behind an
   `@supports` gate, which is exactly the kind of thing that dies silently: the
   gate can stop matching and every other check stays green. */

const FREEZE = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
}`

const ON = '/* dither as shipped */'
const OFF = '.scene-dither { background-image: none !important; }'

/* The pane's left padding, clear of every glyph — the gradient alone. */
const GUTTER = { x0: 4, x1: 24 }

async function shootPane(page: Page, css: string) {
  const tag = await page.addStyleTag({ content: css })
  await page.waitForTimeout(300)
  const shot = await page.locator('.pane-gold').first().screenshot()
  await tag.evaluate((el: Element) => el.remove())
  return shot.toString('base64')
}

/** Counts hard horizontal contours: rows where the whole sampled strip steps
    in lockstep. This is the thing banding *is*, so it answers the question a
    pixel-diff cannot — a flat tint moves every pixel and removes no band. */
async function bandEdges(page: Page, shot: string) {
  return page.evaluate(
    async ([b64, x0, x1]) => {
      const image = new Image()
      image.src = `data:image/png;base64,${b64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(image, 0, 0)
      const { data, width, height } = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      )
      const green = (x: number, y: number) => data[(y * width + x) * 4 + 1]

      let edges = 0
      // Past the 42% stop, where the tail turns shallow and the bands widen.
      // Rows are compared two apart so the 1px grain scanline cancels.
      for (let y = Math.round(height * 0.44); y < height - 8; y++) {
        // A contour is not "these pixels moved" but "these pixels moved
        // together": one signed step shared across the strip. Noise moves
        // pixels too, by every amount at once, which is the whole point.
        const shared = new Map<number, number>()
        let total = 0
        for (let x = Number(x0); x < Math.min(Number(x1), width); x++) {
          const step = green(x, y + 2) - green(x, y)
          if (step !== 0) shared.set(step, (shared.get(step) ?? 0) + 1)
          total++
        }
        const agreed = Math.max(0, ...shared.values())
        if (total && agreed / total > 0.8) edges++
      }
      return edges
    },
    [shot, GUTTER.x0, GUTTER.x1] as const,
  )
}

test.describe('the scene dither', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/grb')
    await page.addStyleTag({ content: FREEZE })
    // A skipped guard is a guard that does nothing: fail loudly if the seed
    // ever stops putting a gilded pane on this page.
    await expect(page.locator('.pane-gold').first()).toBeVisible()
  })

  test('breaks the gold pane out of banding, in Gecko', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'firefox',
      'Gecko is the only engine that needs it',
    )

    const layer = page.locator('.scene-dither')
    const { image, opacity } = await layer.evaluate((el) => {
      const s = getComputedStyle(el)
      return { image: s.backgroundImage, opacity: Number(s.opacity) }
    })
    // The gate resolved: without it the noise never reaches the compositor.
    expect(image).toContain('feTurbulence')
    // Under 0.018 the bands survive; over ~0.025 the noise bands on its own.
    expect(opacity).toBeGreaterThanOrEqual(0.018)
    expect(opacity).toBeLessThanOrEqual(0.025)

    const banded = await bandEdges(page, await shootPane(page, OFF))
    const dithered = await bandEdges(page, await shootPane(page, ON))

    // Guard the guard: if Gecko ever starts dithering for itself there is
    // nothing left to prove, and a 0-vs-0 pass would prove it forever.
    expect(banded, 'undithered Gecko should band').toBeGreaterThan(4)
    expect(
      dithered,
      `dither left ${dithered} hard contours against ${banded} without it`,
    ).toBeLessThanOrEqual(banded / 2)
  })

  test('leaves the pane untouched outside Gecko', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'firefox', 'covered by the Gecko case')

    // Chromium and WebKit dither for themselves; the fix must stay invisible
    // to them, so the layer is present but inert rather than absent.
    const layer = page.locator('.scene-dither')
    await expect(layer).toHaveCount(1)
    await expect(layer).toHaveCSS('background-image', 'none')

    // Not byte equality: WebKit's first composite of a backdrop-filtered pane
    // is not reproducible frame to frame, and that churn is not the dither.
    const withLayer = await bandEdges(page, await shootPane(page, ON))
    const without = await bandEdges(page, await shootPane(page, OFF))
    expect(withLayer, 'the gate must make the layer a no-op').toBe(without)
  })
})
