import { expect, test } from '@playwright/test'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

/* The moderator gate is the app's only guard on the CMS — ADR 0008 records
   that there is no RLS backstop behind it — so both refusals get a test. */

const ADMIN_PAGES = [
  '/admin',
  '/admin/records/new',
  '/admin/players',
  '/admin/catalog',
  '/admin/audit',
]

test.describe('signed out', () => {
  test.use({ storageState: STATE.anon })

  test('every admin page offers sign-in instead of the CMS', async ({
    page,
  }) => {
    for (const path of ADMIN_PAGES) {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Moderator sign-in' }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Sign in with Discord' }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Moderator CMS' }),
      ).toHaveCount(0)
    }
  })

  test('the site nav hides the admin entry point', async ({ page }) => {
    await page.goto('/grb')
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  })
})

test.describe('signed in without the moderator role', () => {
  test.use({ storageState: STATE.user })

  test('the CMS is refused by name', async ({ page }) => {
    await page.goto('/admin')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: `Hi ${TEST_USERS.viewer.handle} — not a moderator`,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Admin sections' }),
    ).toHaveCount(0)
  })
})
