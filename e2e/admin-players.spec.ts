import { expect, test } from '@playwright/test'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

test.use({ storageState: STATE.moderator })

const SLUG = 'e2e-avatar-reset'

test('a moderator resets a reported avatar and the Medallion returns', async ({
  page,
}) => {
  // A dedicated, claimed player carrying an avatar — isolated so the reset
  // never touches seeded data the other specs assert on.
  await withPlayer(
    {
      slug: SLUG,
      displayName: 'E2E Avatar Reset',
      ownerEmail: TEST_USERS.viewer.email,
      avatarKey: 'avatars/e2e/abc123abc123.png',
    },
    async ({ id }) => {
      await page.goto(`/admin/players/${id}`)
      const reset = page.getByRole('button', { name: 'Reset avatar' })
      await expect(reset).toBeVisible()

      await reset.click()
      await page.getByRole('button', { name: 'Reset', exact: true }).click()

      // The control is gone the moment the avatar clears…
      await expect(reset).toBeHidden()
      // …and stays gone after a reload, proving the write reached the database.
      await page.reload()
      await expect(
        page.getByRole('button', { name: 'Reset avatar' }),
      ).toBeHidden()

      // The action is recorded against the acting moderator.
      await page.goto('/admin/audit')
      await page.getByLabel('Filter by entity').selectOption('player')
      const entry = page
        .getByRole('listitem')
        .filter({ hasText: 'player.reset_avatar' })
        .first()
      await expect(entry).toContainText(TEST_USERS.moderator.handle)

      // The public profile now wears the Medallion.
      await page.goto(`/player/${SLUG}`)
      await expect(
        page.getByRole('img', { name: 'E2E Avatar Reset — no avatar set' }),
      ).toBeVisible()
    },
  )
})
