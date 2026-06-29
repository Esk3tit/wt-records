import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { modes, nations, players, records, vehicles } from '#/db/schema'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
})
afterEach(async () => {
  await t.client.close()
})

async function seedBaseline() {
  await t.db
    .insert(modes)
    .values({
      mode: 'grb',
      name: 'Ground Realistic Battles',
      branch: 'ground',
      isLive: true,
    })
  const [usa] = await t.db
    .insert(nations)
    .values({ slug: 'usa', name: 'USA', sort: 1 })
    .returning()
  const [veh] = await t.db
    .insert(vehicles)
    .values({
      externalId: 'm4a1',
      name: 'M4A1',
      slug: 'm4a1',
      nationId: usa.id,
      branch: 'ground',
      class: 'medium',
    })
    .returning()
  const [veh2] = await t.db
    .insert(vehicles)
    .values({
      externalId: 'tiger',
      name: 'Tiger',
      slug: 'tiger',
      nationId: usa.id,
      branch: 'ground',
      class: 'heavy',
    })
    .returning()
  const [ply] = await t.db
    .insert(players)
    .values({ slug: 'ace', displayName: 'Ace' })
    .returning()
  return { veh, veh2, ply }
}

describe('records constraints (committed migrations replayed on PGlite)', () => {
  it('applies every migration and accepts a current verified record', async () => {
    const { veh, ply } = await seedBaseline()
    await t.db
      .insert(records)
      .values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        kills: 12,
        status: 'verified',
        isCurrent: true,
      })
    expect(await t.db.select().from(records)).toHaveLength(1)
  })

  it('rejects a second CURRENT verified record for the same (vehicle, mode)', async () => {
    const { veh, ply } = await seedBaseline()
    const base = {
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ply.id,
      ignSnapshot: 'Ace',
      status: 'verified' as const,
      isCurrent: true,
    }
    await t.db.insert(records).values({ ...base, kills: 12 })
    await expect(
      t.db.insert(records).values({ ...base, kills: 15 }),
    ).rejects.toThrow()
  })

  it('allows superseded history (is_current = false) alongside the current row', async () => {
    const { veh, ply } = await seedBaseline()
    const base = {
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ply.id,
      ignSnapshot: 'Ace',
      status: 'verified' as const,
    }
    await t.db.insert(records).values({ ...base, kills: 10, isCurrent: false })
    await t.db.insert(records).values({ ...base, kills: 12, isCurrent: true })
    expect(await t.db.select().from(records)).toHaveLength(2)
  })

  it('enforces is_current ⇒ verified via the CHECK constraint', async () => {
    const { veh, ply } = await seedBaseline()
    await expect(
      t.db.insert(records).values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        kills: 12,
        status: 'pending',
        isCurrent: true,
      }),
    ).rejects.toThrow()
  })

  it('allows a pending submission when it is not current', async () => {
    const { veh, ply } = await seedBaseline()
    await t.db.insert(records).values({
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ply.id,
      ignSnapshot: 'Ace',
      kills: 12,
      status: 'pending',
      isCurrent: false,
    })
    expect(await t.db.select().from(records)).toHaveLength(1)
  })

  it('allows a current verified record for each distinct vehicle', async () => {
    const { veh, veh2, ply } = await seedBaseline()
    await t.db
      .insert(records)
      .values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        kills: 12,
        status: 'verified',
        isCurrent: true,
      })
    await t.db
      .insert(records)
      .values({
        vehicleId: veh2.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        kills: 9,
        status: 'verified',
        isCurrent: true,
      })
    expect(await t.db.select().from(records)).toHaveLength(2)
  })

  it('rejects a non-positive kill count', async () => {
    const { veh, ply } = await seedBaseline()
    await expect(
      t.db.insert(records).values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        kills: 0,
      }),
    ).rejects.toThrow()
  })
})
