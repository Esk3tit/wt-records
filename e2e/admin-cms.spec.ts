import { expect, test } from '@playwright/test'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

test.use({ storageState: STATE.admin })

test('a moderator sees the CMS shell and every section', async ({ page }) => {
  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Moderator CMS' }),
  ).toBeVisible()
  await expect(page.getByText(TEST_USERS.moderator.handle)).toBeVisible()

  const sections = page.getByRole('navigation', { name: 'Admin sections' })
  for (const tab of ['Records', 'Players', 'Catalog & rules', 'Audit']) {
    await expect(sections.getByRole('link', { name: tab })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'New record' })).toBeVisible()
})

test('a moderator edit persists and is written to the audit log', async ({
  page,
}) => {
  await page.goto('/admin/catalog')
  await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible()

  const toggle = page
    .getByRole('checkbox', { name: /^Mark .* difficult$/ })
    .first()
  const label = await toggle.getAttribute('aria-label')
  expect(label, 'the catalogue rendered no vehicles').toBeTruthy()
  const wasDifficult = await toggle.isChecked()

  await toggle.setChecked(!wasDifficult)
  await expect(toggle).toBeChecked({ checked: !wasDifficult })

  // The checkbox is optimistic, so only a reload proves the write reached the
  // database rather than just the React state.
  await page.reload()
  const reloaded = page.getByRole('checkbox', { name: label! })
  await expect(reloaded).toBeChecked({ checked: !wasDifficult })

  await page.goto('/admin/audit')
  await page.getByLabel('Filter by entity').selectOption('vehicle')
  const entry = page
    .getByRole('listitem')
    .filter({ hasText: 'vehicle.set_difficult' })
    .first()
  await expect(entry).toContainText(TEST_USERS.moderator.handle)

  await page.goto('/admin/catalog')
  await page.getByRole('checkbox', { name: label! }).setChecked(wasDifficult)
})

test('the records list filters without losing the moderator session', async ({
  page,
}) => {
  await page.goto('/admin')
  await page.getByLabel('Status', { exact: true }).selectOption('verified')
  await expect(page).toHaveURL(/status=verified/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Moderator CMS' }),
  ).toBeVisible()
})
