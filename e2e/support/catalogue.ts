import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** The name of the first vehicle the catalogue lists. Tests derive their
    fixtures from live data so they hold against the seed and a real corpus. */
export async function firstCatalogueVehicle(page: Page): Promise<string> {
  await page.goto('/grb/vehicles')
  const name = (
    await page.getByRole('table').getByRole('link').first().textContent()
  )?.trim()
  expect(name, 'the catalogue rendered no vehicles').toBeTruthy()
  return name!
}
