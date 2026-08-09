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

/** How many pixels the dither moves, against how many the page moves on its
    own. A live page is never byte-stable frame to frame, so the second frame
    is the control: the verdict is the ratio, never the raw count. */
async function ditherSignal(page: Page) {
  const frame = async (css: string) => {
    const tag = await page.addStyleTag({ content: css })
    await page.waitForTimeout(300)
    const shot = (await page.screenshot()).toString('base64')
    await tag.evaluate((el: Element) => el.remove())
    return shot
  }
  const ON = '/* dither as shipped */'
  const OFF = '.scene-dither { background-image: none !important; }'
  const [a, b, c] = [await frame(ON), await frame(ON), await frame(OFF)]

  // Decoded in the page, the way the contrast harness does it: no image
  // decoder in the runner, and the browser already has one.
  return page.evaluate(
    async ([on1, on2, off]) => {
      const decode = async (b64: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${b64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(image, 0, 0)
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data
      }
      const count = (x: Uint8ClampedArray, y: Uint8ClampedArray) => {
        let n = 0
        for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i]) n++
        return n
      }
      const [p, q, r] = [
        await decode(on1),
        await decode(on2),
        await decode(off),
      ]
      return { floor: count(p, q), delta: count(p, r) }
    },
    [a, b, c],
  )
}

test.describe('the scene dither', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/grb')
    await page.addStyleTag({ content: FREEZE })
  })

  test('paints in Gecko, at the amplitude the bands were measured against', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'firefox',
      'Gecko is the only engine that needs it',
    )

    const layer = page.locator('.scene-dither')
    await expect(layer).toHaveCount(1)

    const { image, opacity } = await layer.evaluate((el) => {
      const s = getComputedStyle(el)
      return { image: s.backgroundImage, opacity: Number(s.opacity) }
    })
    // The gate resolved: without it the noise never reaches the compositor.
    expect(image).toContain('feTurbulence')
    // Under 0.018 the bands survive; over ~0.025 the noise bands on its own.
    expect(opacity).toBeGreaterThanOrEqual(0.018)
    expect(opacity).toBeLessThanOrEqual(0.025)

    const { floor, delta } = await ditherSignal(page)
    expect(
      delta,
      `dither moved ${delta}px against a ${floor}px floor`,
    ).toBeGreaterThan(Math.max(floor * 5, 10_000))
  })

  test('paints nothing outside Gecko', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'covered by the Gecko case')

    // Chromium and WebKit dither for themselves; the fix must stay invisible
    // to them, so the layer is present but inert rather than absent.
    await expect(page.locator('.scene-dither')).toHaveCount(1)
    await expect(page.locator('.scene-dither')).toHaveCSS(
      'background-image',
      'none',
    )

    const { floor, delta } = await ditherSignal(page)
    expect(
      delta,
      `dither moved ${delta}px against a ${floor}px floor`,
    ).toBeLessThanOrEqual(Math.max(floor * 2, 1000))
  })
})
