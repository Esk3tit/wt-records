import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Sql } from 'postgres'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

/* The Country round-trip against the running app: the holder picks one, it
   persists, and the flag renders with the country's full name beside it. */

/** Claimed by the E2E viewer, which is what surfaces the owner's controls. */
const ownedPlayer = (slug: string) => ({
  slug,
  displayName: 'E2E Country Owner',
  ownerEmail: TEST_USERS.viewer.email,
})

function picker(page: Page) {
  return page.getByLabel('Country', { exact: true })
}

function saveButton(page: Page) {
  return page.getByRole('button', { name: 'Save', exact: true })
}

/** Choose and commit — the write happens on the press, never on the change. */
async function choose(page: Page, code: string) {
  await picker(page).selectOption(code)
  await saveButton(page).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
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
    await withPlayer(ownedPlayer(slug), async ({ sql }) => {
      await page.goto(`/player/${slug}`)

      // No country is the ordinary state: nothing renders, no placeholder mark,
      // and there is nothing to save until the owner changes something.
      await expect(picker(page)).toHaveValue('')
      await expect(page.locator('.country-flag')).toHaveCount(0)
      await expect(saveButton(page)).toBeDisabled()

      await choose(page, 'JP')
      expect(await storedCountry(sql, slug)).toBe('JP')

      // The mark and the full name, together — the flag never appears alone.
      const shown = page.locator('.country-flag').locator('..')
      await expect(shown).toContainText('Japan')
      await expect(page.locator('.country-flag')).toBeVisible()
      // ...and it links nowhere.
      await expect(shown.locator('a')).toHaveCount(0)

      // Unlimited and self-serve: a correction costs one press, no cooldown.
      await choose(page, 'BR')
      await expect(shown).toContainText('Brazil')
      expect(await storedCountry(sql, slug)).toBe('BR')

      // "Not set" is pinned first and always available, so clearing is one too.
      await choose(page, '')
      await expect(page.locator('.country-flag')).toHaveCount(0)
      expect(await storedCountry(sql, slug)).toBeNull()
    })
  })

  // "Japan" walks through Jamaica, so an autosaving field stored JM — and the
  // pause between "J" and "apan" is what defeated the debounce that hid it.
  // Typing writes nothing at all now; only the press does.
  test('typing a country stores only the one landed on', async ({ page }) => {
    const slug = 'e2e-country-keyboard'
    await withPlayer(ownedPlayer(slug), async ({ sql }) => {
      await page.goto(`/player/${slug}`)

      await picker(page).focus()
      await page.keyboard.type('Ja', { delay: 60 })
      await page.waitForTimeout(700) // resting on Jamaica must not store it
      await page.keyboard.type('pan', { delay: 60 })
      expect(await storedCountry(sql, slug)).toBeNull()

      // Reachable and operable by keyboard alone, and the press leaves focus
      // where the owner put it rather than dropping it to the body.
      await page.keyboard.press('Tab')
      await expect(saveButton(page)).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByText('Saved', { exact: true })).toBeVisible()

      expect(await storedCountry(sql, slug)).toBe('JP')
      // The press disabled its own button, so focus is handed back to the
      // field rather than dropped to the top of the document.
      await expect(saveButton(page)).toBeDisabled()
      await expect(picker(page)).toBeFocused()
    })
  })

  // The stored code outlives the list it came from: CLDR can retire one.
  test('reads a code the list no longer offers as "Not set"', async ({
    page,
  }) => {
    const slug = 'e2e-country-delisted'
    await withPlayer(ownedPlayer(slug), async ({ sql }) => {
      await sql`update players set country_code = 'ZZ' where slug = ${slug}`
      await page.goto(`/player/${slug}`)

      await expect(page.locator('.country-flag')).toHaveCount(0)
      // Not a blank selection: the picker offers no option for a delisted code.
      await expect(picker(page)).toHaveValue('')
    })
  })

  test('states the rule under the field, and offers no home nation', async ({
    page,
  }) => {
    const slug = 'e2e-country-rule'
    await withPlayer(ownedPlayer(slug), async () => {
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
    })
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
    await withPlayer(ownedPlayer(slug), async ({ sql }) => {
      await sql`update players set country_code = 'JP' where slug = ${slug}`
      await expectReadOnlyCountry(page, slug)
    })
  })
})

test.describe('a signed-out visitor', () => {
  test.use({ storageState: STATE.anon })

  test('sees the country but no picker', async ({ page }) => {
    const slug = 'e2e-country-anon'
    await withPlayer(ownedPlayer(slug), async ({ sql }) => {
      await sql`update players set country_code = 'JP' where slug = ${slug}`
      await expectReadOnlyCountry(page, slug)
    })
  })
})
