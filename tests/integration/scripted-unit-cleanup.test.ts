import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import {
  modes,
  nations,
  patches,
  players,
  records,
  vehicleBr,
  vehicleSearchTerms,
  vehicles,
} from '#/db/schema'

/* freshDb() already applied 0010 to an empty catalog, so re-running the file is
   how it gets exercised against a populated one. */
const CLEANUP_SQL = readFileSync(
  fileURLToPath(
    new URL('../../drizzle/0010_remove_scripted_units.sql', import.meta.url),
  ),
  'utf8',
)

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await t.db
    .insert(nations)
    .values({ slug: 'usa', name: 'USA', sort: 1 })
    .onConflictDoNothing()
  await t.db.insert(modes).values({
    mode: 'grb',
    name: 'Ground RB',
    branch: 'ground',
    isLive: true,
    sort: 1,
  })
})
afterEach(async () => {
  await t.client.close()
})

async function addVehicle(externalId: string, slug: string): Promise<number> {
  const [nation] = await t.db
    .select()
    .from(nations)
    .where(eq(nations.slug, 'usa'))
  const [row] = await t.db
    .insert(vehicles)
    .values({
      externalId,
      name: externalId,
      slug,
      nationId: nation.id,
      branch: 'ground',
      class: 'spg',
    })
    .returning({ id: vehicles.id })
  await t.db.insert(vehicleBr).values({ vehicleId: row.id, mode: 'grb', br: 1 })
  await t.db
    .insert(vehicleSearchTerms)
    .values({ vehicleId: row.id, term: externalId })
  return row.id
}

describe('migration 0010 — scripted-unit cleanup', () => {
  it('hard-deletes the scripted units and everything keyed to them', async () => {
    await addVehicle('us_m8_scott_snowball', 'snowballer')
    await addVehicle('uav_quadcopter', 'uav-ravens-eye')
    const keeper = await addVehicle('us_m1_abrams', 'm1-abrams')

    await t.client.exec(CLEANUP_SQL)

    expect(await t.db.select().from(vehicles)).toEqual([
      expect.objectContaining({ id: keeper, externalId: 'us_m1_abrams' }),
    ])
    expect(await t.db.select().from(vehicleBr)).toEqual([
      expect.objectContaining({ vehicleId: keeper }),
    ])
    expect(await t.db.select().from(vehicleSearchTerms)).toEqual([
      expect.objectContaining({ vehicleId: keeper }),
    ])
  })

  it('refuses to run, naming the offender, if one has acquired a record', async () => {
    const doomed = await addVehicle('uav_quadcopter', 'uav-ravens-eye')
    await t.db.insert(patches).values({ version: '2.57' })
    const [player] = await t.db
      .insert(players)
      .values({ slug: 'someone', displayName: 'Someone' })
      .returning({ id: players.id })
    await t.db.insert(records).values({
      vehicleId: doomed,
      mode: 'grb',
      playerId: player.id,
      ignSnapshot: 'someone',
      kills: 12,
      patch: '2.57',
    })

    await expect(t.client.exec(CLEANUP_SQL)).rejects.toThrow(/uav_quadcopter/)

    // the guard fires before any delete — nothing was destroyed
    expect(await t.db.select().from(vehicles)).toHaveLength(1)
    expect(await t.db.select().from(vehicleBr)).toHaveLength(1)
  })

  it('is a no-op on a catalog that never held them', async () => {
    const keeper = await addVehicle('us_m1_abrams', 'm1-abrams')

    await t.client.exec(CLEANUP_SQL)

    expect(await t.db.select().from(vehicles)).toEqual([
      expect.objectContaining({ id: keeper }),
    ])
  })
})
