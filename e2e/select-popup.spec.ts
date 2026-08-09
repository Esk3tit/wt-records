import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { LIGHTING, stampTheme } from './support/theme'
import { TEST_USERS } from './support/users'

/* A native <select>'s open list is drawn by the browser, not by us: it is not
   in the page, takes no screenshot, and never sees the pane the field sits on.
   The browser backs it with its own `Field` surface — chosen by the used
   `color-scheme` and nothing else — and then draws the options in whatever ink
   the field inherited from our stylesheet. So night ink over a day surface is
   possible and invisible here: our fields all read correctly closed while every
   list they open is white type on white.

   Only some builds show it. macOS hands the list to a system menu that ignores
   our ink; Windows and Linux draw it themselves and honour it, which is where
   it was reported. Both resolve the same two colours, so this measures those
   rather than the paint, and holds on any host. */

const FLOOR = 4.5

interface Reading {
  field: string
  option: string
  ink: string
  surface: string
  ratio: number
}

const channel = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const luminance = ([r, g, b]: number[]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

const rgba = (colour: string): number[] =>
  (colour.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number)

/** Ink carries its own alpha and the list has nothing behind it but the
    browser's surface, so that is the only thing it can be laid over. */
const over = (ink: number[], surface: number[]) => {
  const a = ink[3] ?? 1
  return [0, 1, 2].map((i) => ink[i] * a + surface[i] * (1 - a))
}

function ratioOf(ink: string, surface: string) {
  const under = rgba(surface)
  const [hi, lo] = [luminance(over(rgba(ink), under)), luminance(under)].sort(
    (x, y) => y - x,
  )
  return (hi + 0.05) / (lo + 0.05)
}

/** Reads every option's declared ink and the surface the browser will put
    behind it. `Field` is a system colour: asking for it in the page resolves it
    exactly as the list will, under the same used `color-scheme`. */
async function readOptions(page: Page): Promise<Reading[]> {
  const raw = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'Field'
    document.body.append(probe)
    const surface = getComputedStyle(probe).backgroundColor
    probe.remove()
    return [...document.querySelectorAll('select')].flatMap((field) =>
      [...field.options].map((option) => ({
        field: field.id || field.name || field.outerHTML.slice(0, 60),
        option: option.textContent.trim(),
        ink: getComputedStyle(option).color,
        surface,
      })),
    )
  })
  return raw.map((r) => ({ ...r, ratio: ratioOf(r.ink, r.surface) }))
}

function faults(readings: Reading[]) {
  return readings
    .filter((r) => r.ratio < FLOOR)
    .map(
      (r) =>
        `${r.field} · "${r.option}" ${r.ink} on ${r.surface} = ${r.ratio.toFixed(2)}:1`,
    )
}

test.describe('an open <select> is legible in both lightings', () => {
  test.use({ storageState: STATE.anon })

  for (const theme of LIGHTING) {
    test(`the hangar's filters, ${theme}`, async ({ page }) => {
      await stampTheme(page, theme)
      await page.goto('/grb/vehicles')
      await expect(page.locator('select').first()).toBeAttached()

      const readings = await readOptions(page)
      expect(readings.length).toBeGreaterThan(0)
      expect(faults(readings)).toEqual([])
    })
  }
})

test.describe("the holder's Country list is legible in both lightings", () => {
  test.use({ storageState: STATE.viewer })

  for (const theme of LIGHTING) {
    test(`the Country picker, ${theme}`, async ({ page }) => {
      const slug = `e2e-country-ink-${theme}`
      await withPlayer(
        {
          slug,
          displayName: 'E2E Country Ink',
          ownerEmail: TEST_USERS.viewer.email,
        },
        async () => {
          await stampTheme(page, theme)
          await page.goto(`/player/${slug}`)
          await expect(page.getByLabel('Country', { exact: true })).toBeVisible()

          const readings = await readOptions(page)
          // 250 countries and "Not set" — a list this long is exactly the one
          // nobody can scan for a single unreadable row.
          expect(readings.length).toBeGreaterThan(200)
          expect(faults(readings)).toEqual([])
        },
      )
    })
  }
})
