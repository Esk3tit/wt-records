import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import postgres from 'postgres'
import type { Sql } from 'postgres'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'
import { requireEnv } from './support/env'

/* The Country round-trip against the running app: the holder picks one, it
   persists, and the flag renders with the country's full name beside it — the
   one thing separating it from the in-game nation chips a few hundred pixels
   below on the same card. */

function connect(): Sql {
  return postgres(requireEnv('DATABASE_URL'), {
    prepare: false,
    connect_timeout: 10,
  })
}

/** A player claimed by the E2E viewer, isolated on its own slug so parallel
    specs never touch each other's row. Delete-first survives a prior failure. */
async function seedOwnedPlayer(sql: Sql, slug: string): Promise<void> {
  const ownerId = (
    await sql<{ id: string }[]>`
      select id from auth.users where email = ${TEST_USERS.viewer.email}
    `
  ).at(0)?.id
  if (!ownerId) throw new Error('the E2E viewer must be provisioned first')
  await sql`delete from players where slug = ${slug}`
  await sql`
    insert into players (slug, display_name, user_id)
    values (${slug}, 'E2E Country Owner', ${ownerId})
  `
}

function picker(page: Page) {
  return page.getByLabel('Country', { exact: true })
}

async function storedCountry(sql: Sql, slug: string): Promise<string | null> {
  const rows = await sql<{ country_code: string | null }[]>`
    select country_code from players where slug = ${slug}
  `
  return rows.at(0)?.country_code ?? null
}

test.describe('the claim holder states a Country', () => {
  test.use({ storageState: STATE.viewer })

  test('picks one, sees it saved, and clears it again', async ({ page }) => {
    const slug = 'e2e-country-owner'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await page.goto(`/player/${slug}`)

      // No country is the ordinary state: nothing renders, no placeholder mark.
      await expect(picker(page)).toHaveValue('')
      await expect(page.locator('.country-flag')).toHaveCount(0)

      await picker(page).selectOption('JP')
      await expect(page.getByText('Saved', { exact: true })).toBeVisible()
      expect(await storedCountry(sql, slug)).toBe('JP')

      // The mark and the full name, together — the flag never appears alone.
      const shown = page.locator('.country-flag').locator('..')
      await expect(shown).toContainText('Japan')
      await expect(page.locator('.country-flag')).toBeVisible()
      // ...and it links nowhere.
      await expect(shown.locator('a')).toHaveCount(0)

      // Unlimited and self-serve: a correction costs one action, no cooldown.
      await picker(page).selectOption('BR')
      await expect(shown).toContainText('Brazil')
      expect(await storedCountry(sql, slug)).toBe('BR')

      // "Not set" is pinned first and always available, so clearing is one too.
      await picker(page).selectOption('')
      await expect(page.locator('.country-flag')).toHaveCount(0)
      expect(await storedCountry(sql, slug)).toBeNull()
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })

  test('states the rule under the field, and offers no home nation', async ({
    page,
  }) => {
    const slug = 'e2e-country-rule'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await page.goto(`/player/${slug}`)

      await expect(
        page.getByText('Your country is a citizenship you hold.'),
      ).toBeVisible()

      const options = await picker(page).locator('option').allInnerTexts()
      expect(options[0]).toBe('Not set')
      expect(options).toHaveLength(251)
      expect(options).toContain('United Kingdom')
      for (const home of ['England', 'Scotland', 'Wales', 'Catalonia']) {
        expect(options).not.toContain(home)
      }
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })
})

/** A visitor sees the stated Country but is never offered the picker. */
async function expectReadOnlyCountry(page: Page, slug: string) {
  await page.goto(`/player/${slug}`)
  await expect(page.getByText('E2E Country Owner')).toBeVisible()
  await expect(page.getByText('Japan')).toBeVisible()
  await expect(picker(page)).toHaveCount(0)
}

test.describe('only the claim holder can set it', () => {
  test.use({ storageState: STATE.moderator })

  test('a signed-in non-owner sees the country but no picker', async ({
    page,
  }) => {
    const slug = 'e2e-country-nonowner'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await sql`update players set country_code = 'JP' where slug = ${slug}`
      await expectReadOnlyCountry(page, slug)
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })
})

test.describe('a signed-out visitor', () => {
  test.use({ storageState: STATE.anon })

  test('sees the country but no picker', async ({ page }) => {
    const slug = 'e2e-country-anon'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await sql`update players set country_code = 'JP' where slug = ${slug}`
      await expectReadOnlyCountry(page, slug)
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })
})
