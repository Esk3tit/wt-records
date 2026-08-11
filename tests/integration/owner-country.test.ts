import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { playerClaims, players, profiles } from '#/db/schema'
import { approveClaim, revokeClaim } from '#/claims/claims'
import { setOwnCountry } from '#/claims/owner'
import { effectiveCountry } from '#/db/queries'

const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'
const MOD = '00000000-0000-4000-8000-00000000000c'

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
    [MOD, 'Warden'],
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
  it('is enforced again by deletion on revoke', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnCountry(t.db, USER_A, ace.id, 'JP')

    await revokeClaim(t.db, null, MOD, ace.id, 'asked to leave')
    expect((await playerBySlug('ace')).countryCode).toBeNull()

    await claim('ace', USER_B)
    expect((await playerBySlug('ace')).countryCode).toBeNull()
  })

  // Deleting an auth user nulls user_id by FK without ever running unclaim(),
  // so approve is the only thing between that row and its next claimant.
  it('is not inherited by the next claimant when the FK cleared user_id', async () => {
    const ace = await claim('ace', USER_A)
    await setOwnCountry(t.db, USER_A, ace.id, 'JP')
    await t.db
      .update(players)
      .set({ userId: null })
      .where(eq(players.id, ace.id))

    const [pending] = await t.db
      .insert(playerClaims)
      .values({ playerId: ace.id, userId: USER_B })
      .returning({ id: playerClaims.id })
    await approveClaim(t.db, null, MOD, pending.id)

    const claimed = await playerBySlug('ace')
    expect(claimed.userId).toBe(USER_B)
    expect(claimed.countryCode).toBeNull()
  })
})
