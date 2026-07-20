import { expect, test } from '@playwright/test'
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

  await page.goto('/grb/vehicles')
  await expect(
    page.getByRole('heading', { level: 1, name: /^vehicles/i }),
  ).toBeVisible()

  const firstVehicle = page.getByRole('table').getByRole('link').first()
  const vehicleName = (await firstVehicle.textContent())?.trim()
  expect(vehicleName, 'the catalogue rendered no vehicles').toBeTruthy()

  await firstVehicle.click()
  await expect(page).toHaveURL(/\/grb\/vehicle\//)
  await expect(
    page.getByRole('heading', { level: 1, name: vehicleName! }),
  ).toBeVisible()
})

test('the leaderboard renders for the live mode', async ({ page }) => {
  await page.goto('/grb/leaderboard')
  await expect(
    page.getByRole('heading', { level: 1, name: /leaderboard$/i }),
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
