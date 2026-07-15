import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { profiles } from '#/db/schema'
import { upsertProfileFromOAuth } from '#/auth/profile'

const USER = '00000000-0000-4000-8000-0000000000aa'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await t.client.query('insert into auth.users (id) values ($1)', [USER])
})
afterEach(async () => {
  await t.client.close()
})

describe('upsertProfileFromOAuth', () => {
  it('provisions a viewer profile on first login', async () => {
    await upsertProfileFromOAuth(t.db, {
      id: USER,
      handle: 'Khai',
      discordId: '123',
    })
    const [row] = await t.db.select().from(profiles).where(eq(profiles.id, USER))
    expect(row.role).toBe('viewer')
    expect(row.handle).toBe('Khai')
    expect(row.discordId).toBe('123')
  })

  it('refreshes identity fields on re-login without touching a promoted role', async () => {
    await upsertProfileFromOAuth(t.db, {
      id: USER,
      handle: 'Khai',
      discordId: '123',
    })
    // the one-off promotion SQL:
    await t.db
      .update(profiles)
      .set({ role: 'moderator' })
      .where(eq(profiles.id, USER))

    await upsertProfileFromOAuth(t.db, {
      id: USER,
      handle: 'KhaiRenamed',
      discordId: '123',
    })
    const [row] = await t.db.select().from(profiles).where(eq(profiles.id, USER))
    expect(row.role).toBe('moderator')
    expect(row.handle).toBe('KhaiRenamed')
  })

  it('keeps existing identity fields when the provider omits them', async () => {
    await upsertProfileFromOAuth(t.db, {
      id: USER,
      handle: 'Khai',
      discordId: '123',
    })
    await upsertProfileFromOAuth(t.db, { id: USER, handle: null, discordId: null })
    const [row] = await t.db.select().from(profiles).where(eq(profiles.id, USER))
    expect(row.handle).toBe('Khai')
    expect(row.discordId).toBe('123')
  })
})
