import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import postgres from 'postgres'
import type { Sql } from 'postgres'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'
import { requireEnv } from './support/env'

/* This stack has no object store configured, and an upload with nowhere to put
   the bytes is refused server-side — so the E2E proves the owner-only *gating*
   (owner sees the control, non-owners never do). The upload/replace/remove
   round-trip against a store is covered by the owner-avatar integration tests. */

function connect(): Sql {
  return postgres(requireEnv('DATABASE_URL'), {
    prepare: false,
    connect_timeout: 10,
  })
}

/** A player claimed by the E2E viewer, isolated on its own slug so parallel
    specs never touch each other's row. Delete-first survives a prior failure. */
async function seedOwnedPlayer(sql: Sql, slug: string): Promise<void> {
  const ownerId = (
    await sql<{ id: string }[]>`
      select id from auth.users where email = ${TEST_USERS.viewer.email}
    `
  ).at(0)?.id
  if (!ownerId) throw new Error('the E2E viewer must be provisioned first')
  await sql`delete from players where slug = ${slug}`
  await sql`
    insert into players (slug, display_name, user_id)
    values (${slug}, 'E2E Avatar Owner', ${ownerId})
  `
}

test.describe('owner avatar controls', () => {
  test.use({ storageState: STATE.user })

  test('the owner sees the upload control on their own page', async ({
    page,
  }) => {
    const slug = 'e2e-avatar-owner'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await page.goto(`/player/${slug}`)

      // The owner is offered the control; with no avatar yet, no Remove.
      await expect(
        page.getByRole('button', { name: 'Upload photo' }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Remove' })).toBeHidden()
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })
})

async function expectNoOwnerControls(page: Page) {
  // The header renders (the player exists) but no owner controls appear.
  await expect(page.getByText('E2E Avatar Owner')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload photo' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Replace photo' })).toBeHidden()
}

test.describe('a signed-out visitor sees no avatar controls', () => {
  test.use({ storageState: STATE.anon })

  test('no upload control for anonymous', async ({ page }) => {
    const slug = 'e2e-avatar-anon'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await page.goto(`/player/${slug}`)
      await expectNoOwnerControls(page)
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })
})

test.describe('a signed-in non-owner sees no avatar controls', () => {
  test.use({ storageState: STATE.admin })

  test('no upload control on someone else’s page', async ({ page }) => {
    const slug = 'e2e-avatar-nonowner'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await page.goto(`/player/${slug}`)
      await expectNoOwnerControls(page)
    } finally {
      await sql`delete from players where slug = ${slug}`
      await sql.end()
    }
  })
})
