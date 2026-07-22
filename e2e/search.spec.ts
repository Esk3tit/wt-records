import { expect, test } from '@playwright/test'
import { firstCatalogueVehicle } from './support/catalogue'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

test('searching a catalogued vehicle leads to its page', async ({ page }) => {
  const vehicleName = await firstCatalogueVehicle(page)

  await page.getByRole('link', { name: 'Search' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Search' }),
  ).toBeVisible()

  await page.getByRole('searchbox').fill(vehicleName)
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/\/search\?q=/)

  const hit = page.getByRole('link', { name: vehicleName, exact: true })
  await expect(hit.first()).toBeVisible()
  await hit.first().click()
  await expect(
    page.getByRole('heading', { level: 1, name: vehicleName }),
  ).toBeVisible()
})

test('a query with no matches reports the empty state', async ({ page }) => {
  await page.goto('/search?q=zzzznotathing')
  await expect(page.getByText('Nothing matches “zzzznotathing”')).toBeVisible()
})
