import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { withPlayer } from './support/players'
import { UNBOUNDED, bringIntoView, reachFaults } from './support/reach'
import {
  faultsInInk,
  readInk,
  unmeasured,
  unreadable,
} from './support/contrast'
import { STATE } from './support/states'
import type { Lighting } from './support/theme'
import { LIGHTING, stampTheme } from './support/theme'
import { TEST_USERS } from './support/users'

/* The rail of Profile links against the running app: what it emits, whether a
   thumb can land on it at the narrowest screen the site supports, and whether
   the handle beside each mark can be read in both lighting states.

   ⚠️ `bunx playwright test` reuses a stale `.output` build — rebuild before
   trusting a run on the plates. */

const RAIL = '[data-profile-links]'

/** A handle is unique across the whole site, so two specs seeding the same one
    meet on `plink_handle_uq` — which is the constraint working. Every fixture
    handle is therefore derived from the slug that owns it. Lower-case
    throughout, so the seed's own fold matches the write path's for every
    platform, including the one that does not fold at all. */
const token = (slug: string) => slug.replace(/[^a-z0-9]/g, '')

/** The full shippable spread, so the row is measured at the width it can
    actually reach: five named platforms plus the personal site. */
const fullRail = (slug: string) => [
  { platform: 'youtube', handle: `yt${token(slug)}` },
  { platform: 'discord', handle: `dc${token(slug)}` },
  { platform: 'twitch', handle: `tw${token(slug)}` },
  { platform: 'tiktok', handle: `tt${token(slug)}` },
  { platform: 'x', handle: `x${token(slug)}`.slice(0, 15) },
  { platform: 'website', handle: `https://${token(slug)}.example/shop` },
]

const linkedPlayer = (
  slug: string,
  options: { owned?: boolean; links?: ReturnType<typeof fullRail> } = {},
) => ({
  slug,
  displayName: 'E2E Link Holder',
  ownerEmail: options.owned ? TEST_USERS.viewer.email : undefined,
  links: options.links ?? fullRail(slug),
})

/* Tall enough that the whole wrapped rail is on screen at once: a control
   scrolled past the edge is owned by nobody, and would read as a fault it is
   not. */
const TALL = 2400

async function openProfile(
  page: Page,
  slug: string,
  { width = 320, theme = 'dark' }: { width?: number; theme?: Lighting } = {},
) {
  await stampTheme(page, theme)
  await page.setViewportSize({ width, height: TALL })
  await page.goto(`/player/${slug}`)
  await expect(page.locator(RAIL)).toBeVisible()
}

test.describe('the rail a visitor is shown', () => {
  test.use({ storageState: STATE.anon })

  test('renders for a signed-out visitor, with the mark and the handle', async ({
    page,
  }) => {
    const slug = 'e2e-links-anon'
    await withPlayer(linkedPlayer(slug, { owned: true }), async () => {
      await openProfile(page, slug, { width: 1280 })

      const links = page.locator(`${RAIL} a`)
      await expect(links).toHaveCount(fullRail(slug).length)
      // A row of glyphs says which platforms; only the handle says whose.
      await expect(links.first()).toContainText(`@${fullRail(slug)[0].handle}`)
    })
  })

  test('carries the markup the whole feature rests on', async ({ page }) => {
    const slug = 'e2e-links-markup'
    await withPlayer(linkedPlayer(slug, { owned: true }), async () => {
      await openProfile(page, slug, { width: 1280 })

      const first = page.locator(`${RAIL} a`).first()
      await expect(first).toHaveAttribute('rel', 'me ugc nofollow noopener')
      await expect(first).toHaveAttribute('referrerpolicy', 'origin')
      await expect(first).toHaveAttribute('target', '_blank')
      const handle = fullRail(slug)[0].handle
      await expect(first).toHaveAttribute(
        'href',
        `https://www.youtube.com/@${handle}`,
      )
      // The accessible name names the platform and the handle, not the glyph.
      await expect(first).toHaveAttribute(
        'aria-label',
        `YouTube: @${handle} (opens in a new tab)`,
      )
      // Every constructed URL is query-free, on the platform's own host.
      for (const href of await page
        .locator(`${RAIL} a`)
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
        expect(new URL(href).search).toBe('')
        expect(new URL(href).protocol).toBe('https:')
      }
    })
  })

  test('shows an unclaimed player no links at all', async ({ page }) => {
    // Seeded on the row, but the page implies nobody is behind it.
    await withPlayer(
      linkedPlayer('e2e-links-unclaimed', { owned: false }),
      async () => {
        await page.goto('/player/e2e-links-unclaimed')
        await expect(page.getByText('E2E Link Holder')).toBeVisible()
        await expect(page.locator(RAIL)).toHaveCount(0)
      },
    )
  })

  /* The one AC that can only be answered by the running app: a row of small
     marks must not be a lottery. Measured as the box each control actually
     owns — a border on a chip silently costs it hit area. */
  test('is reachable by thumb at 320px, where it stacks', async ({ page }) => {
    await withPlayer(
      linkedPlayer('e2e-links-reach', { owned: true }),
      async () => {
        await openProfile(page, 'e2e-links-reach')
        await bringIntoView(page, RAIL)

        // Stacked, not in one row: this is the state the pitch has to survive.
        const rows = await page
          .locator(`${RAIL} a`)
          .evaluateAll(
            (as) => new Set(as.map((a) => a.getBoundingClientRect().top)).size,
          )
        expect(rows).toBeGreaterThan(1)

        expect(
          await reachFaults(page, { root: RAIL, pane: UNBOUNDED }),
        ).toEqual([])
      },
    )
  })

  test('is reachable on a larger phone too', async ({ page }) => {
    await withPlayer(
      linkedPlayer('e2e-links-reach-390', { owned: true }),
      async () => {
        await openProfile(page, 'e2e-links-reach-390', { width: 390 })
        await bringIntoView(page, RAIL)
        expect(
          await reachFaults(page, { root: RAIL, pane: UNBOUNDED }),
        ).toEqual([])
      },
    )
  })
})

/* The plates are loud at night and near-invisible by day — the reverse of the
   usual mode problem, and accepted: in Daylight Hall they dissolve into the
   light glass and only the marks read. What is NOT accepted either way is the
   handle beside them, which is the whole anti-impersonation signal, so that is
   what is measured here — against the pane it actually sits on, in both fills. */
test.describe('the handle is readable in both lighting states', () => {
  test.use({ storageState: STATE.anon })

  for (const theme of LIGHTING) {
    test(`${theme}`, async ({ page }) => {
      await withPlayer(
        linkedPlayer(`e2e-links-ink-${theme}`, { owned: true }),
        async () => {
          await openProfile(page, `e2e-links-ink-${theme}`, {
            width: 1280,
            theme,
          })
          await bringIntoView(page, RAIL)

          const readings = await readInk(page, RAIL, 'nothing-here', [RAIL])
          expect(unmeasured(readings, [RAIL])).toEqual([])
          expect(unreadable(readings)).toEqual([])
          expect(faultsInInk(readings)).toEqual([])
        },
      )
    })
  }
})

test.describe('the holder authors them', () => {
  test.use({ storageState: STATE.viewer })

  test('saves a handle, shows the URL it will publish, and removes it', async ({
    page,
  }) => {
    const slug = 'e2e-links-owner'
    await withPlayer(
      linkedPlayer(slug, { owned: true, links: [] }),
      async ({ sql }) => {
        await page.setViewportSize({ width: 1280, height: TALL })
        await page.goto(`/player/${slug}`)

        const field = page.getByLabel('YouTube — youtube.com/@')
        await expect(field).toBeVisible()

        // The constructed prefix is welded to the field, so a pasted URL looks
        // wrong on screen — and the full URL is shown beneath as it is typed.
        await field.fill('E2EOwnerYT')
        await expect(
          page.getByText('https://www.youtube.com/@E2EOwnerYT'),
        ).toBeVisible()

        await page.getByRole('button', { name: 'Save YouTube link' }).click()
        await expect(page.locator(`${RAIL} a`)).toHaveCount(1)

        const rows = await sql<{ handle: string }[]>`
          select handle from player_links
          where player_id in (select id from players where slug = ${slug})
        `
        expect(rows.map((r) => r.handle)).toEqual(['E2EOwnerYT'])

        await page.getByRole('button', { name: 'Remove YouTube link' }).click()
        await expect(page.locator(RAIL)).toHaveCount(0)
      },
    )
  })

  test('refuses a pasted redirector and says so', async ({ page }) => {
    const slug = 'e2e-links-hostile'
    await withPlayer(
      linkedPlayer(slug, { owned: true, links: [] }),
      async ({ sql }) => {
        await page.setViewportSize({ width: 1280, height: TALL })
        await page.goto(`/player/${slug}`)

        await page
          .getByLabel('YouTube — youtube.com/@')
          .fill('https://youtube.com/redirect?q=https://evil.example')
        await page.getByRole('button', { name: 'Save YouTube link' }).click()

        await expect(page.getByRole('alert')).toContainText(
          'not a valid handle for YouTube',
        )
        const rows = await sql`
          select 1 from player_links
          where player_id in (select id from players where slug = ${slug})
        `
        expect(rows).toHaveLength(0)
      },
    )
  })
})

test.describe('a non-owner is offered nothing', () => {
  test.use({ storageState: STATE.moderator })

  test('sees the rail but no field', async ({ page }) => {
    const slug = 'e2e-links-nonowner'
    await withPlayer(linkedPlayer(slug, { owned: true }), async () => {
      await openProfile(page, slug, { width: 1280 })
      await expect(page.locator(`${RAIL} a`)).toHaveCount(fullRail(slug).length)
      await expect(page.getByLabel('YouTube — youtube.com/@')).toHaveCount(0)
    })
  })
})
