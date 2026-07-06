import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import { resetFixture, seed } from '#/db/seed'
import { seedDemo } from '#/db/seed-demo'
import { records, vehicles } from '#/db/schema'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
})
afterEach(async () => {
  await t.client.close()
})

describe('seed fixture', () => {
  it('loads vehicles and records against the migrated schema', async () => {
    expect(await t.db.select().from(vehicles)).toHaveLength(7)
    expect((await t.db.select().from(records)).length).toBeGreaterThanOrEqual(5)
  })

  it('has at most one current record per (vehicle, mode)', async () => {
    const current = await t.db
      .select()
      .from(records)
      .where(eq(records.isCurrent, true))
    const keys = current.map((r) => `${r.vehicleId}:${r.mode}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('preserves superseded history', async () => {
    const history = await t.db
      .select()
      .from(records)
      .where(eq(records.isCurrent, false))
    expect(history.length).toBeGreaterThanOrEqual(1)
  })

  // Guards the resetFixture truncate list: a fixture root missing from it
  // (e.g. a newly seeded table) makes the re-seed hit a duplicate key.
  it('re-seeds cleanly after resetFixture (full fixture + demo)', async () => {
    await seedDemo(t.db)
    await resetFixture(t.db)
    await seed(t.db)
    await seedDemo(t.db)
    expect((await t.db.select().from(records)).length).toBeGreaterThanOrEqual(5)
  })
})
