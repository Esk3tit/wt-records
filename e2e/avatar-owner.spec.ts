import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import postgres from 'postgres'
import type { Sql } from 'postgres'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'
import { requireEnv } from './support/env'

// A 16×16 PNG — a real raster the server decodes, crops, and re-encodes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWM4Y2xMEmIY1WA8GkpnhmvSAABHizIQeUoJ2gAAAABJRU5ErkJggg==',
  'base64',
)

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

  test('the owner uploads a photo, then replaces and removes it', async ({
    page,
  }) => {
    const slug = 'e2e-avatar-owner'
    const sql = connect()
    try {
      await seedOwnedPlayer(sql, slug)
      await page.goto(`/player/${slug}`)

      const upload = page.getByRole('button', { name: 'Upload photo' })
      await expect(upload).toBeVisible()
      await expect(page.getByRole('button', { name: 'Remove' })).toBeHidden()

      await page.locator('input[type="file"]').setInputFiles({
        name: 'me.png',
        mimeType: 'image/png',
        buffer: PNG,
      })

      // The upload committed: the control flips to replace/remove…
      const replace = page.getByRole('button', { name: 'Replace photo' })
      await expect(replace).toBeVisible()
      await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible()

      // …and survives a reload, proving the repoint reached the database.
      await page.reload()
      await expect(replace).toBeVisible()

      await page.getByRole('button', { name: 'Remove' }).click()
      await expect(upload).toBeVisible()
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
