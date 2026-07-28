import { expect, test } from '@playwright/test'
import { firstCatalogueVehicle } from './support/catalogue'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

test('a visitor lands on the live mode and reaches a vehicle from the catalogue', async ({
  page,
}) => {
  // `/` only 307s — following it proves the default-mode redirect still works.
  await page.goto('/')
  await expect(page).toHaveURL(/\/grb$/)
  await expect(page.getByText('Live registry')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()

  const vehicleName = await firstCatalogueVehicle(page)
  await expect(
    page.getByRole('heading', { level: 1, name: /^vehicles/i }),
  ).toBeVisible()

  await page.getByRole('table').getByRole('link').first().click()
  await expect(page).toHaveURL(/\/grb\/vehicle\//)
  await expect(
    page.getByRole('heading', { level: 1, name: vehicleName }),
  ).toBeVisible()
})

test('a held title states its record, its holder, and the number to beat', async ({
  page,
}) => {
  // Filtered to held and sorted by kills, so the first row is a title with a
  // current record whatever the corpus is — seed or the real record book.
  await page.goto('/grb/vehicles?title=held&sort=kills&dir=desc')
  const row = page.getByRole('table').getByRole('link').first()
  const vehicleName = (await row.textContent())?.trim()
  expect(vehicleName, 'no held titles in the catalogue').toBeTruthy()
  await row.click()

  await expect(
    page.getByRole('heading', { level: 1, name: vehicleName! }),
  ).toBeVisible()
  await expect(page.getByText('World record')).toBeVisible()
  await expect(
    page.getByText(/matching the record does not supersede/),
  ).toBeVisible()

  // The deed's whole claim in one assertion. The bar strictly exceeds the
  // record on show; it clears it by more than one only where a higher verified
  // score still stands, which the monument does not display.
  const deed = (await page.locator('header').last().textContent()) ?? ''
  const record = Number(/World record(\d+)/.exec(deed)?.[1])
  const bar = Number(/Take this title with (\d+) kills/.exec(deed)?.[1])
  expect(record, 'the deed states no record').toBeGreaterThan(0)
  expect(bar).toBeGreaterThanOrEqual(record + 1)
})

test('the leaderboard renders for the live mode', async ({ page }) => {
  await page.goto('/grb/leaderboard')
  await expect(
    page.getByRole('heading', { level: 1, name: /leaderboard$/i }),
  ).toBeVisible()
})

test('a profile introduces its holder with the enrichment stats', async ({
  page,
}) => {
  await page.goto('/grb/leaderboard')
  const topHolder = page.getByRole('listitem').first().getByRole('link').first()
  const name = (await topHolder.textContent())?.trim()
  expect(name, 'the leaderboard rendered no holders').toBeTruthy()
  await topHolder.click()
  await expect(
    page.getByRole('heading', { level: 1, name: name! }),
  ).toBeVisible()

  // The top holder holds current, dated titles, so all three stats are real.
  await expect(page.getByText('Titles by nation')).toBeVisible()
  await expect(page.getByText('Longest held')).toBeVisible()
  await expect(page.getByText('Last verified')).toBeVisible()
  await expect(
    page.getByText(/^(under a day|[\d,]+ days?)$/),
    'the longest-held tenure renders as a real span',
  ).toBeVisible()
})

test('a mode that is not live shows the coming-soon shell, not a 404', async ({
  page,
}) => {
  const response = await page.goto('/gab')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(
    0,
  )
})
