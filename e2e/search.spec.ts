import { expect, test } from '@playwright/test'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

test('searching a catalogued vehicle leads to its page', async ({ page }) => {
  // Take the query from live data rather than a hard-coded fixture name, so
  // the test holds against the seed fixture and a real imported corpus alike.
  await page.goto('/grb/vehicles')
  const vehicleName = (
    await page.getByRole('table').getByRole('link').first().textContent()
  )?.trim()
  expect(vehicleName, 'the catalogue rendered no vehicles').toBeTruthy()

  await page.getByRole('link', { name: 'Search' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Search' }),
  ).toBeVisible()

  await page.getByRole('searchbox').fill(vehicleName!)
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/search\?q=/)

  const hit = page.getByRole('link', { name: vehicleName!, exact: true })
  await expect(hit.first()).toBeVisible()
  await hit.first().click()
  await expect(
    page.getByRole('heading', { level: 1, name: vehicleName! }),
  ).toBeVisible()
})

test('a query with no matches reports both groups empty', async ({ page }) => {
  await page.goto('/search?q=zzzznotathing')
  await expect(page.getByText('No players.')).toBeVisible()
  await expect(page.getByText('No vehicles.')).toBeVisible()
})
