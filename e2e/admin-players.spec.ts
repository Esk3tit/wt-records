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
      ownerEmail: TEST_USERS.holder.email,
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

/* The other two levers a Moderator has over a claimed profile, both modelled on
   Reset avatar above and both clear-only: removal is moderation, authoring is
   speaking as someone else. Driven here because the absence of an authoring
   path is asserted in the integration suite, but that a Moderator can actually
   reach the removal is only true if the page offers it. */
test('a moderator clears the links a holder published, and the rail goes', async ({
  page,
}) => {
  await withPlayer(
    {
      slug: 'e2e-links-clear',
      displayName: 'E2E Links Clear',
      ownerEmail: TEST_USERS.holder.email,
      links: [
        { platform: 'youtube', handle: 'e2elinksclear' },
        { platform: 'website', handle: 'https://e2elinksclear.example' },
      ],
    },
    async ({ id }) => {
      await page.goto(`/player/e2e-links-clear`)
      await expect(page.locator('[data-profile-links] a')).toHaveCount(2)

      await page.goto(`/admin/players/${id}`)
      const clear = page.getByRole('button', { name: 'Clear links' })
      await expect(clear).toBeVisible()
      await clear.click()
      // The dialog names what it is about to remove, in the glossary's words.
      await expect(page.getByRole('dialog')).toContainText('Personal site')
      await page.getByRole('button', { name: 'Clear', exact: true }).click()

      // Gone from the lever, and gone after a reload — the write landed.
      await expect(clear).toBeHidden()
      await page.reload()
      await expect(
        page.getByRole('button', { name: 'Clear links' }),
      ).toBeHidden()
      // The claim is untouched: clearing is not revoking.
      await expect(
        page.getByRole('button', { name: 'Revoke claim' }),
      ).toBeVisible()

      await page.goto(`/player/e2e-links-clear`)
      await expect(page.locator('[data-profile-links]')).toHaveCount(0)
    },
  )
})

test('a moderator clears a stated country, and the claim survives it', async ({
  page,
}) => {
  await withPlayer(
    {
      slug: 'e2e-country-clear',
      displayName: 'E2E Country Clear',
      ownerEmail: TEST_USERS.holder.email,
    },
    async ({ sql, id }) => {
      await sql`update players set country_code = 'JP' where id = ${id}`
      await page.goto(`/player/e2e-country-clear`)
      await expect(page.getByText('Japan')).toBeVisible()

      await page.goto(`/admin/players/${id}`)
      const clear = page.getByRole('button', { name: 'Clear country' })
      await expect(clear).toBeVisible()
      await clear.click()
      await page.getByRole('button', { name: 'Clear', exact: true }).click()

      await expect(clear).toBeHidden()
      await page.reload()
      await expect(
        page.getByRole('button', { name: 'Clear country' }),
      ).toBeHidden()
      await expect(
        page.getByRole('button', { name: 'Revoke claim' }),
      ).toBeVisible()

      await page.goto(`/player/e2e-country-clear`)
      await expect(page.getByText('Japan')).toBeHidden()
    },
  )
})
