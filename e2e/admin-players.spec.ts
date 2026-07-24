import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'
import { requireEnv } from './support/env'

test.use({ storageState: STATE.admin })

const SLUG = 'e2e-avatar-reset'

test('a moderator resets a reported avatar and the Medallion returns', async ({
  page,
}) => {
  const sql = postgres(requireEnv('DATABASE_URL'), {
    prepare: false,
    connect_timeout: 10,
  })
  try {
    const ownerId = (
      await sql<{ id: string }[]>`
        select id from auth.users where email = ${TEST_USERS.viewer.email}
      `
    ).at(0)?.id
    if (!ownerId) throw new Error('the E2E viewer must be provisioned first')

    // A dedicated, claimed player carrying an avatar — isolated so the reset
    // never touches seeded data the other specs assert on. Delete-first so a
    // prior failed run doesn't leave the slug taken.
    await sql`delete from players where slug = ${SLUG}`
    const [player] = await sql<{ id: number }[]>`
      insert into players (slug, display_name, user_id, avatar_key)
      values (${SLUG}, 'E2E Avatar Reset', ${ownerId}, 'avatars/e2e/abc123abc123.png')
      returning id
    `

    await page.goto(`/admin/players/${player.id}`)
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
  } finally {
    await sql`delete from players where slug = ${SLUG}`
    await sql.end()
  }
})
