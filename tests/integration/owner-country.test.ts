import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { players, profiles } from '#/db/schema'
import { releaseClaim, setOwnCountry } from '#/claims/claims'
import { effectiveCountry } from '#/db/queries'

const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'

let t: TestDb

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

async function claim(slug: string, userId: string) {
  const p = await playerBySlug(slug)
  await t.db.update(players).set({ userId }).where(eq(players.id, p.id))
  return p
}

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle] of [
    [USER_A, 'AceIRL'],
    [USER_B, 'Rival'],
  ]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
    await t.db.insert(profiles).values({ id, handle })
  }
})
afterEach(async () => {
  await t.client.close()
})

describe('setOwnCountry', () => {
  it('stores the holder’s stated country', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnCountry(t.db, USER_A, ace.id, 'JP')
    expect((await playerBySlug('ace')).countryCode).toBe('JP')
  })

  it('clears it again in one action, with no cooldown between changes', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnCountry(t.db, USER_A, ace.id, 'JP')
    await setOwnCountry(t.db, USER_A, ace.id, 'BR')
    await setOwnCountry(t.db, USER_A, ace.id, null)
    expect((await playerBySlug('ace')).countryCode).toBeNull()
  })

  it('refuses a write from anyone but the claim holder', async () => {
    const ace = await claim('ace', USER_A)
    await expect(setOwnCountry(t.db, USER_B, ace.id, 'BR')).rejects.toThrow(
      /do not hold this claim/,
    )
    expect((await playerBySlug('ace')).countryCode).toBeNull()
  })

  it('refuses a write to an unclaimed player', async () => {
    const ace = await playerBySlug('ace')
    await expect(setOwnCountry(t.db, USER_A, ace.id, 'BR')).rejects.toThrow(
      /not claimed/,
    )
  })

  // A lowercase code beside an uppercase one is how a player drops out of
  // their own country's results.
  it('is refused by the database if a lowercase code ever reaches it', async () => {
    const ace = await claim('ace', USER_A)
    await expect(setOwnCountry(t.db, USER_A, ace.id, 'jp')).rejects.toThrow()
  })
})

describe('an unclaimed player carries no country', () => {
  it('is enforced by the read gate', () => {
    expect(effectiveCountry({ userId: null, countryCode: 'JP' })).toBeNull()
    expect(effectiveCountry({ userId: USER_A, countryCode: 'JP' })).toBe('JP')
  })

  // The gate alone would leave the value to resurrect on re-claim.
  it('is enforced again by deletion on release', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnCountry(t.db, USER_A, ace.id, 'JP')

    await releaseClaim(t.db, null, USER_A, ace.id)
    expect((await playerBySlug('ace')).countryCode).toBeNull()

    await claim('ace', USER_B)
    expect((await playerBySlug('ace')).countryCode).toBeNull()
  })
})
