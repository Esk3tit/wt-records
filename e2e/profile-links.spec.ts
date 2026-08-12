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

/** X caps a handle at 15 characters, which is shorter than these slugs — so
    truncating one would throw away the part that made it unique, and two specs
    sharing a prefix would meet on `plink_handle_uq` in whichever shard lost.
    Folded over the whole token instead, so the cap cannot discard it. */
const shortToken = (slug: string) =>
  `x${[...token(slug)]
    .reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 0xffffffff, 7)
    .toString(36)}`

/** The full shippable spread, so the row is measured at the width it can
    actually reach: five named platforms plus the personal site. */
const fullRail = (slug: string) => [
  { platform: 'youtube', handle: `yt${token(slug)}` },
  { platform: 'discord', handle: `dc${token(slug)}` },
  { platform: 'twitch', handle: `tw${token(slug)}` },
  { platform: 'tiktok', handle: `tt${token(slug)}` },
  { platform: 'x', handle: shortToken(slug) },
  { platform: 'website', handle: `https://${token(slug)}.example/shop` },
]

/** `held` is a Player claimed by somebody — all a rail needs, and it keeps
    these cases off the lock every case signing in as the viewer waits on.
    `mine` is the reader's own Player, which only the authoring cases need. */
const linkedPlayer = (
  slug: string,
  options: {
    owned?: 'held' | 'mine'
    links?: ReturnType<typeof fullRail>
  } = {},
) => ({
  slug,
  displayName: 'E2E Link Holder',
  ownerEmail:
    options.owned === 'mine'
      ? TEST_USERS.viewer.email
      : options.owned === 'held'
        ? TEST_USERS.holder.email
        : undefined,
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
    await withPlayer(linkedPlayer(slug, { owned: 'held' }), async () => {
      await openProfile(page, slug, { width: 1280 })

      const links = page.locator(`${RAIL} a`)
      await expect(links).toHaveCount(fullRail(slug).length)
      // A row of glyphs says which platforms; only the handle says whose.
      await expect(links.first()).toContainText(`@${fullRail(slug)[0].handle}`)
    })
  })

  test('carries the markup the whole feature rests on', async ({ page }) => {
    const slug = 'e2e-links-markup'
    await withPlayer(linkedPlayer(slug, { owned: 'held' }), async () => {
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
    await withPlayer(linkedPlayer('e2e-links-unclaimed', {}), async () => {
      await page.goto('/player/e2e-links-unclaimed')
      await expect(page.getByText('E2E Link Holder')).toBeVisible()
      await expect(page.locator(RAIL)).toHaveCount(0)
    })
  })

  /* The one AC that can only be answered by the running app: a row of small
     marks must not be a lottery. Measured as the box each control actually
     owns — a border on a chip silently costs it hit area. */
  test('is reachable by thumb at 320px, where it stacks', async ({ page }) => {
    await withPlayer(
      linkedPlayer('e2e-links-reach', { owned: 'held' }),
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

  /* The one platform that ships as a wordmark, because its logo is forbidden
     outright without written permission. It was never captured at the size the
     row aligns on, and the spec named dropping the platform as the alternative
     if it could not be read — so the word is measured here rather than trusted:
     rendered at type size, on its own pill sized to itself, and not clipped. */
  test('draws the TikTok wordmark legibly at the row’s own height', async ({
    page,
  }) => {
    await withPlayer(
      linkedPlayer('e2e-links-wordmark', { owned: 'held' }),
      async () => {
        await openProfile(page, 'e2e-links-wordmark')
        await bringIntoView(page, RAIL)

        const pill = page
          .locator(`${RAIL} a[aria-label^="TikTok"] > :first-child`)
          .first()
        await expect(pill).toHaveText('TikTok')
        const drawn = await pill.evaluate((el) => ({
          fontSize: parseFloat(getComputedStyle(el).fontSize),
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
          clipped: el.scrollWidth > Math.ceil(el.getBoundingClientRect().width),
        }))
        // Set in our own type at reading size, never squeezed into a glyph box.
        expect(drawn.fontSize).toBeGreaterThanOrEqual(12)
        expect(drawn.clipped).toBe(false)
        // The row aligns on plate height and never plate width: the pill is as
        // tall as a glyph plate and wider, because it is sized to the word.
        const glyph = await page
          .locator(`${RAIL} a[aria-label^="YouTube"] > :first-child`)
          .first()
          .evaluate((el) => el.getBoundingClientRect())
        expect(drawn.height).toBeCloseTo(glyph.height, 0)
        expect(drawn.width).toBeGreaterThan(glyph.width)
      },
    )
  })

  test('is reachable on a larger phone too', async ({ page }) => {
    await withPlayer(
      linkedPlayer('e2e-links-reach-390', { owned: 'held' }),
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

/* Two separate promises, measured separately.

   The marks are logotypes, which 1.4.11 asks no ratio of — but that exemption
   is only honest if they are actually sitting on the sanctioned background the
   brand terms require. So the plate is measured for what it PROMISES: fully
   opaque, and the same fill in both lighting states. That is the whole reason
   it is white rather than a site token — a mark over our frost would be
   non-compliant with YouTube, Bluesky and X whatever colour it was drawn in,
   and a mark whose plate flipped with the theme would be a recolouring.

   Everything that is genuinely text — the handle beside each mark, and the one
   wordmark — carries no exemption at all and is measured against the pane it
   actually sits on, in both fills. */
test.describe('the rail is readable in both lighting states', () => {
  test.use({ storageState: STATE.anon })

  const plateFills = (page: Page) =>
    page
      .locator(`${RAIL} a > :first-child`)
      .evaluateAll((plates) =>
        plates.map((el) => getComputedStyle(el).backgroundColor),
      )

  for (const theme of LIGHTING) {
    test(`${theme}`, async ({ page }) => {
      await withPlayer(
        linkedPlayer(`e2e-links-ink-${theme}`, { owned: 'held' }),
        async () => {
          await openProfile(page, `e2e-links-ink-${theme}`, {
            width: 1280,
            theme,
          })
          await bringIntoView(page, RAIL)

          // Opaque, and the same fill for every mark in the row. `rgb(…)`
          // rather than `rgba(…, <1)` is the assertion: any alpha at all would
          // let the scene through and break all three brand rules at once.
          const fills = await plateFills(page)
          expect(fills.length).toBeGreaterThan(1)
          expect([...new Set(fills)]).toEqual(['rgb(255, 255, 255)'])

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
      linkedPlayer(slug, { owned: 'mine', links: [] }),
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

  /* The personal site is the one slot whose stored value is a whole canonical
     URL, while the welded prefix is already drawing its scheme. Round-tripped
     through a real save here, because the failure only appears on the SECOND
     render — the field looked right until the first save came back, and then
     read `https://https://…` forever after. */
  test('leaves the personal site readable after it round-trips', async ({
    page,
  }) => {
    const slug = 'e2e-links-site'
    await withPlayer(
      linkedPlayer(slug, { owned: 'mine', links: [] }),
      async ({ sql }) => {
        await page.setViewportSize({ width: 1280, height: TALL })
        await page.goto(`/player/${slug}`)

        await page.getByLabel('Add a link').selectOption('website')
        const field = page.getByLabel('Personal site — https://')
        await field.fill('e2e-links-site.example/shop')
        await page
          .getByRole('button', { name: 'Save Personal site link' })
          .click()
        await expect(page.locator(`${RAIL} a`)).toHaveCount(1)

        // What was stored is the canonical URL, scheme and all…
        const rows = await sql<{ handle: string }[]>`
          select handle from player_links
          where player_id in (select id from players where slug = ${slug})
        `
        expect(rows.map((r) => r.handle)).toEqual([
          'https://e2e-links-site.example/shop',
        ])

        // …and the field shows only what belongs under the prefix, both now
        // and after a full reload.
        const saved = page.getByLabel('Personal site — https://')
        await expect(saved).toHaveValue('e2e-links-site.example/shop')
        await page.reload()
        await expect(page.getByLabel('Personal site — https://')).toHaveValue(
          'e2e-links-site.example/shop',
        )
        // Nothing left to save: the field agrees with what was stored.
        await expect(
          page.getByRole('button', { name: 'Save Personal site link' }),
        ).toBeDisabled()
      },
    )
  })

  /* The server canonicalises, and the field has to take what it actually
     stored — or a save that changed anything leaves the field looking dirty
     against a value that is already published. */
  test('settles the field on what the server stored', async ({ page }) => {
    const slug = 'e2e-links-echo'
    await withPlayer(
      linkedPlayer(slug, { owned: 'mine', links: [] }),
      async () => {
        await page.setViewportSize({ width: 1280, height: TALL })
        await page.goto(`/player/${slug}`)

        // A pasted profile URL, which the server stores as a bare handle.
        await page
          .getByLabel('YouTube — youtube.com/@')
          .fill('https://www.youtube.com/@E2EEcho')
        await page.getByRole('button', { name: 'Save YouTube link' }).click()
        await expect(page.locator(`${RAIL} a`)).toHaveCount(1)

        await expect(page.getByLabel('YouTube — youtube.com/@')).toHaveValue(
          'E2EEcho',
        )
        await expect(
          page.getByRole('button', { name: 'Save YouTube link' }),
        ).toBeDisabled()
      },
    )
  })

  test('refuses a pasted redirector and says so', async ({ page }) => {
    const slug = 'e2e-links-hostile'
    await withPlayer(
      linkedPlayer(slug, { owned: 'mine', links: [] }),
      async ({ sql }) => {
        await page.setViewportSize({ width: 1280, height: TALL })
        await page.goto(`/player/${slug}`)

        await page
          .getByLabel('YouTube — youtube.com/@')
          .fill('https://youtube.com/redirect?q=https://evil.example')
        await page.getByRole('button', { name: 'Save YouTube link' }).click()

        await expect(page.getByRole('alert')).toContainText(
          'Check your YouTube handle',
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
    await withPlayer(linkedPlayer(slug, { owned: 'held' }), async () => {
      await openProfile(page, slug, { width: 1280 })
      await expect(page.locator(`${RAIL} a`)).toHaveCount(fullRail(slug).length)
      await expect(page.getByLabel('YouTube — youtube.com/@')).toHaveCount(0)
    })
  })
})
