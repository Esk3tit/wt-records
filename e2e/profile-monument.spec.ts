import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { amberMoments } from './support/amber'
import { firstPath, openNav } from './support/nav'
import { STATE } from './support/states'
import { LIGHTING } from './support/theme'
import type { Lighting } from './support/theme'

/* The profile header states the number the ledger is about as the site's own
   Record Monument. What is asserted here is what the direction was picked for:
   the page has one amber moment, nothing is said twice, and the shape is the
   same for a player with titles standing and one with none. */

const NUMERAL = '[data-monument-days]'

/** An unclaimed Player, reached from live data so the seed and a real corpus
    both answer. The claimed and owner cases live in avatar-owner.spec.ts. */
async function openProfile(page: Page, theme: Lighting = 'dark') {
  await openNav(page, { path: '/grb/leaderboard', theme })
  const profile = await firstPath(page, /^\/player\//)
  await openNav(page, { path: profile, theme })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test.describe('the profile monument', () => {
  test.use({ storageState: STATE.anon })

  test('leads the header with days at the top, over the titles held', async ({
    page,
  }) => {
    await openProfile(page)

    await expect(page.getByText('Days at the top')).toBeVisible()
    await expect(page.locator(NUMERAL)).toHaveText(/^\d+$/)
    await expect(
      page.getByText(/\d+ titles? held now|No titles standing/),
    ).toBeVisible()
    await expect(page.locator('.monument-glow')).toBeVisible()
  })

  test('does not say the tenure twice — the stats strip dropped it', async ({
    page,
  }) => {
    await openProfile(page)

    await expect(page.getByText('Longest held')).toHaveCount(0)
  })

  for (const theme of LIGHTING) {
    test(`spends exactly one amber moment in ${theme} on an unclaimed page`, async ({
      page,
    }) => {
      await openProfile(page, theme)
      // The common case, and the one the rule is most visible in.
      await expect(
        page.getByRole('link', { name: 'Claim this page' }),
      ).toBeVisible()

      const moments = await amberMoments(page, 'main')

      expect(moments).toHaveLength(1)
      expect(moments[0].says).toMatch(/^\d+\s*days?$/)
    })
  }

  test('holds at 320px, with the monument under the name', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await openProfile(page)

    const name = await page.getByRole('heading', { level: 1 }).boundingBox()
    const numeral = await page.locator(NUMERAL).boundingBox()
    expect(numeral!.y).toBeGreaterThan(name!.y)

    // The glow's circle is sized off a wide pane, and a narrow one cuts it
    // mid-ramp into a hard vertical seam down the card.
    await expect(page.locator('.monument-glow')).toBeHidden()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('the monument under reduced motion', () => {
  test.use({ storageState: STATE.anon })

  test('lands the number whole instead of tallying it up', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openProfile(page)

    // The count-up starts from zero, so a reader who asked for no motion would
    // meet a 0 that never resolves if the alternative were merely "no frames".
    const numeral = page.locator(NUMERAL)
    const landed = await numeral.textContent()
    expect(landed).toMatch(/^\d+$/)
    await page.waitForTimeout(1200)
    await expect(numeral).toHaveText(landed!)
  })
})
