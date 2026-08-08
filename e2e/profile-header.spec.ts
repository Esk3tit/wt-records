import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import postgres from 'postgres'
import type { Sql } from 'postgres'
import { reachFaults } from './support/reach'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'
import { requireEnv } from './support/env'

/* The header is the pane carrying the page's own h1 — the disc, the name, the
   former names, and the one claim affordance. The records pane below it is a
   separate surface with its own reach. */
const HEADER = '.glass-mid:has(h1)'

/* 320px is the narrowest screen PRODUCT.md admits, and the width where the
   name had ~180px to wrap in. 640px is `sm`, the first width that keeps the
   disc beside the name. Tall enough that nothing under test is scrolled off:
   a control past the viewport edge is owned by nobody. */
const PHONE = { width: 320, height: 900 }
const SIDE_BY_SIDE = { width: 640, height: 900 }

/* Forty characters of ordinary words, as the ticket asks. Its own single-line
   width is about twice the column, so the column can do no better than three
   lines — what makes it shatter is fragments, not the count. */
const LONG_NAME = 'Long Named Test Player For The Wide Name'
/* A name with nowhere to break. Left alone it sets the header's own minimum
   width and drags the whole page into sideways scroll. */
const UNBROKEN_NAME = 'ReichsmarschallVonWunderwaffePrototypXIV'

function connect(): Sql {
  return postgres(requireEnv('DATABASE_URL'), {
    prepare: false,
    connect_timeout: 10,
  })
}

async function userId(sql: Sql, email: string): Promise<string> {
  const found = (
    await sql<{ id: string }[]>`
      select id from auth.users where email = ${email}
    `
  ).at(0)?.id
  if (!found) throw new Error(`${email} must be provisioned first`)
  return found
}

/** One player per slug so parallel specs never touch each other's row.
    Delete-first survives a prior failure. */
async function seedPlayer(
  sql: Sql,
  {
    slug,
    name,
    aliases = [],
    ownerEmail,
  }: {
    slug: string
    name: string
    aliases?: string[]
    ownerEmail?: string
  },
): Promise<void> {
  await dropPlayer(sql, slug)
  const owner = ownerEmail ? await userId(sql, ownerEmail) : null
  const [player] = await sql<{ id: number }[]>`
    insert into players (slug, display_name, user_id)
    values (${slug}, ${name}, ${owner})
    returning id
  `
  for (const alias of aliases) {
    await sql`
      insert into player_aliases (player_id, name) values (${player.id}, ${alias})
    `
  }
}

async function dropPlayer(sql: Sql, slug: string): Promise<void> {
  await sql`
    delete from player_aliases
    where player_id in (select id from players where slug = ${slug})
  `
  await sql`delete from players where slug = ${slug}`
}

/** Runs a case against a freshly seeded player and takes the row away after,
    whether the assertions passed or not. */
async function withPlayer(
  seed: Parameters<typeof seedPlayer>[1],
  body: () => Promise<void>,
): Promise<void> {
  const sql = connect()
  try {
    await seedPlayer(sql, seed)
    await body()
  } finally {
    await dropPlayer(sql, seed.slug)
    await sql.end()
  }
}

async function openProfile(
  page: Page,
  slug: string,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport)
  await page.goto(`/player/${slug}`)
  await expect(page.locator(`${HEADER} h1`)).toBeVisible()
}

/** Where the disc sits relative to the name, and how much room the name got.
    Line boxes are read off a Range rather than divided out of the height, so a
    name that wraps is counted, not estimated. */
async function headerLayout(page: Page, header: string) {
  return page.evaluate((sel) => {
    const pane = document.querySelector(sel)
    if (!pane) throw new Error(`${sel} never rendered`)
    const h1 = pane.querySelector('h1')!
    // No fixture carries an avatar, so the disc is always the Medallion.
    const disc = pane.querySelector<SVGElement>('[role="img"]')!
    const range = document.createRange()
    range.selectNodeContents(h1)
    const lines = [...range.getClientRects()].filter((r) => r.width > 0)
    const padding = getComputedStyle(pane)
    // A DOMRect carries no own properties, so it crosses the bridge empty.
    const plain = (el: Element) => {
      const { top, right, bottom, left, width } = el.getBoundingClientRect()
      return { top, right, bottom, left, width }
    }
    const name = plain(h1)
    return {
      column:
        pane.clientWidth -
        parseFloat(padding.paddingLeft) -
        parseFloat(padding.paddingRight),
      name,
      disc: plain(disc),
      /** How much of the column each line box fills — a fragment is what a
          shattered name leaves behind. */
      fills: lines.map((line) => line.width / name.width),
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }
  }, header)
}

test.describe('the profile header stacks on a phone', () => {
  test.use({ storageState: STATE.anon })

  test('the disc sits above the name below sm', async ({ page }) => {
    await withPlayer({ slug: 'e2e-179-stacked', name: LONG_NAME }, async () => {
      await openProfile(page, 'e2e-179-stacked', PHONE)

      const { disc, name } = await headerLayout(page, HEADER)
      expect(disc.bottom).toBeLessThanOrEqual(name.top)
      // Both flush to the same edge: stacked, not indented under the disc.
      expect(name.left).toBeCloseTo(disc.left, 0)
    })
  })

  test('the disc stays beside the name at sm', async ({ page }) => {
    await withPlayer({ slug: 'e2e-179-beside', name: LONG_NAME }, async () => {
      await openProfile(page, 'e2e-179-beside', SIDE_BY_SIDE)

      const { disc, name } = await headerLayout(page, HEADER)
      expect(disc.right).toBeLessThanOrEqual(name.left)
      // Beside means sharing rows, not merely to the left of a name below it.
      expect(disc.top).toBeLessThan(name.bottom)
      expect(name.top).toBeLessThan(disc.bottom)
    })
  })

  test('a 40-character name gets the whole column at 320px', async ({
    page,
  }) => {
    await withPlayer({ slug: 'e2e-179-long', name: LONG_NAME }, async () => {
      await openProfile(page, 'e2e-179-long', PHONE)

      const header = await headerLayout(page, HEADER)
      // The defect this fixes: beside the disc the name had ~180 of the 230.
      expect(header.name.width).toBeCloseTo(header.column, 0)
      /* Twice the column of text cannot land in fewer than three lines, and
         none of them is a fragment — which is what shattering leaves. */
      expect(header.fills.length).toBeLessThanOrEqual(3)
      expect(header.fills.slice(0, -1).filter((fill) => fill < 0.5)).toEqual([])
      expect(header.pageOverflow).toBe(0)
    })
  })

  test('a name with nowhere to break does not push the page sideways', async ({
    page,
  }) => {
    await withPlayer(
      { slug: 'e2e-179-unbroken', name: UNBROKEN_NAME },
      async () => {
        await openProfile(page, 'e2e-179-unbroken', PHONE)

        const header = await headerLayout(page, HEADER)
        expect(header.name.width).toBeLessThanOrEqual(header.column + 1)
        expect(header.pageOverflow).toBe(0)
      },
    )
  })

  test('the former names and the claimed chip still read stacked', async ({
    page,
  }) => {
    await withPlayer(
      {
        slug: 'e2e-179-aliases',
        name: LONG_NAME,
        aliases: ['Earlier Name', 'Even Earlier Name'],
        // Claimed by someone else, so the chip shows and the panel does not.
        ownerEmail: TEST_USERS.moderator.email,
      },
      async () => {
        await openProfile(page, 'e2e-179-aliases', PHONE)

        const former = page.getByText('previously known as', { exact: false })
        const chip = page.getByText('Claimed', { exact: true })
        await expect(former).toBeVisible()
        await expect(former).toContainText('Earlier Name, Even Earlier Name')
        await expect(chip).toBeVisible()

        // Both inside the column they were given, and below the name.
        const header = await headerLayout(page, HEADER)
        for (const line of [former, chip]) {
          const box = (await line.boundingBox())!
          expect(box.x).toBeGreaterThanOrEqual(header.name.left - 1)
          expect(box.x + box.width).toBeLessThanOrEqual(
            header.name.left + header.column + 1,
          )
        }
        expect(header.pageOverflow).toBe(0)
      },
    )
  })
})

/* A phone reader meets the header in one of two states: a page nobody has
   claimed, which offers the claim CTA, or their own, which carries the avatar
   controls and the release. Each control holds the same 44px the nav does. */
test.describe('every header control answers a thumb at 320px', () => {
  test.describe('an anonymous visitor', () => {
    test.use({ storageState: STATE.anon })

    test('can tap the claim CTA', async ({ page }) => {
      await withPlayer({ slug: 'e2e-179-cta', name: LONG_NAME }, async () => {
        await openProfile(page, 'e2e-179-cta', PHONE)
        await expect(
          page.getByRole('link', { name: 'Claim this page' }),
        ).toBeVisible()

        expect(await reachFaults(page, { root: HEADER, pane: HEADER })).toEqual(
          [],
        )
      })
    })
  })

  test.describe('a signed-in visitor', () => {
    test.use({ storageState: STATE.moderator })

    test('can tap the claim form it opens', async ({ page }) => {
      await withPlayer({ slug: 'e2e-179-form', name: LONG_NAME }, async () => {
        await openProfile(page, 'e2e-179-form', PHONE)
        await page.getByRole('button', { name: 'Claim this page' }).click()
        await expect(
          page.getByRole('button', { name: 'Request claim' }),
        ).toBeVisible()

        expect(await reachFaults(page, { root: HEADER, pane: HEADER })).toEqual(
          [],
        )
      })
    })
  })

  test.describe('the page owner', () => {
    test.use({ storageState: STATE.viewer })

    test('can tap the avatar controls and the release', async ({ page }) => {
      await withPlayer(
        {
          slug: 'e2e-179-owner',
          name: LONG_NAME,
          ownerEmail: TEST_USERS.viewer.email,
        },
        async () => {
          await openProfile(page, 'e2e-179-owner', PHONE)
          await expect(
            page.getByRole('button', { name: 'Upload photo', exact: true }),
          ).toBeVisible()

          expect(
            await reachFaults(page, { root: HEADER, pane: HEADER }),
          ).toEqual([])

          // Releasing is a two-step confirm, and its two quiet text buttons are
          // only in the tree once the first step has been taken.
          await page.getByRole('button', { name: 'Release claim' }).click()
          await expect(page.getByRole('button', { name: 'Keep' })).toBeVisible()

          expect(
            await reachFaults(page, { root: HEADER, pane: HEADER }),
          ).toEqual([])
        },
      )
    })
  })
})
