import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { amberMoments } from './support/amber'
import { firstPath, openNav } from './support/nav'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { LIGHTING } from './support/theme'
import type { Lighting } from './support/theme'

/* What the direction was picked for, not its markup: one amber moment, nothing
   said twice, and one shape whether titles stand or not. */

const NUMERAL = '[data-monument-figure]'

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
    await expect(page.locator(NUMERAL)).toHaveText(/^[\d,]+$/)
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
      expect(moments[0].says).toMatch(/^[\d,]+\s*days?$/)
    })
  }

  /* A Player who never held a title has no tenure and nothing standing, so the
     monument has no subject. Amber is the assertion that catches both halves:
     the figure and the glow are the page's only two, and neither may be spent
     marking the absence of a feat. */
  test('builds no monument, and no glow, for a player who never held a title', async ({
    page,
  }) => {
    await withPlayer(
      { slug: 'e2e-monument-nonholder', displayName: 'Never Held' },
      async () => {
        await openNav(page, { path: '/player/e2e-monument-nonholder' })
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        await expect(page.getByText('Days at the top')).toHaveCount(0)
        await expect(page.locator(NUMERAL)).toHaveCount(0)
        await expect(page.locator('.monument-glow')).toHaveCount(0)
        expect(await amberMoments(page, 'main')).toEqual([])
        // The page it has always had, not a hole where a monument would be.
        await expect(
          page.getByRole('link', { name: 'Claim this page' }),
        ).toBeVisible()
      },
    )
  })

  test('holds at 320px, with the monument under the name', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await openProfile(page)

    // The monument leads as the hero column, not as the first thing read: a
    // reader on a phone meets whose page this is before what it is worth.
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

/* Where the ration is actually spent, stated so nobody has to infer it: the
   resting page gets the monument alone, and the commit a reader summoned is
   amber's other sanctioned job, ranked far below it. */
test.describe('the claim form', () => {
  test.use({ storageState: STATE.viewer })

  test('adds the commit as the one further amber, and nothing else', async ({
    page,
  }) => {
    await openProfile(page)
    await page.getByRole('button', { name: 'Claim this page' }).click()
    await expect(
      page.getByRole('button', { name: 'Request claim' }),
    ).toBeVisible()

    const moments = await amberMoments(page, 'main')

    expect(moments.map((m) => m.says)).toEqual([
      expect.stringMatching(/^[\d,]+\s*days?$/),
      'Request claim',
    ])
  })
})

/** What the light is doing right now: its own fade, the glow's swell, and
    whether a loop is running behind it. */
async function lightState(page: Page) {
  return page.evaluate(() => {
    const light = document.querySelector('.monument-light')
    const glow = document.querySelector('.monument-glow')
    if (!light || !glow) throw new Error('no monument light')
    return {
      lit: Number(getComputedStyle(light).opacity),
      swell: getComputedStyle(glow).scale,
      loops: getComputedStyle(glow).animationName.includes('breathe'),
      playing: getComputedStyle(glow).animationPlayState,
    }
  })
}

/* The card's one authored moment: the monument lights as its number tallies.
   Material, not ink — it is inside an `aria-hidden` layer, which is why the
   amber cases above still count exactly one moment with the glow lit. */
test.describe('the monument lights as it counts', () => {
  test.use({ storageState: STATE.anon })

  test('arrives dark and settles lit', async ({ page }) => {
    await openProfile(page)

    const arriving = await lightState(page)
    await expect
      .poll(async () => (await lightState(page)).lit, { timeout: 5_000 })
      .toBe(1)
    // It really did fade in, rather than being lit the whole time — which is
    // the only thing that makes the reduced-motion case below a difference.
    expect(arriving.lit).toBeLessThan(1)
  })

  /* A reign still running breathes; a closed one is steady. A loop nobody is
     looking at stops, which is the whole cost of having one at all. */
  test('stops the loop once the card is off the screen', async ({ page }) => {
    await openProfile(page)
    await expect
      .poll(async () => (await lightState(page)).lit, { timeout: 5_000 })
      .toBe(1)
    test.skip(!(await lightState(page)).loops, 'this reign is already closed')

    await page.evaluate(() => {
      const pad = document.createElement('div')
      pad.style.height = '4000px'
      document.body.append(pad)
      window.scrollTo(0, 2500)
    })
    await expect
      .poll(async () => (await lightState(page)).playing, { timeout: 5_000 })
      .toContain('paused')

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect
      .poll(async () => (await lightState(page)).playing, { timeout: 5_000 })
      .not.toContain('paused')
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
    expect(landed).toMatch(/^[\d,]+$/)
    await page.waitForTimeout(1200)
    await expect(numeral).toHaveText(landed!)
  })

  /* The alternative is the arrival state, not a degraded one: the monument is
     already lit on the first frame, and nothing is left moving behind it. */
  test('meets the monument already lit, with nothing left running', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openProfile(page)

    const state = await lightState(page)
    expect(state.lit).toBe(1)
    expect(state.swell).toBe('none')
    expect(state.loops).toBe(false)
  })
})
