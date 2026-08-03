import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import { resetFixture, seed } from '#/db/seed'
import { seedDemo } from '#/db/seed-demo'
import { records, vehicleSearchTerms, vehicles } from '#/db/schema'
import { isToday } from '#/lib/dates'

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

  it('demo dressing covers the acquisition-flag matrix', async () => {
    await seedDemo(t.db)
    const all = await t.db.select().from(vehicles)
    const treeOnly = (v: (typeof all)[number]) =>
      !v.isEvent && !v.isPremium && !v.isSquadron
    expect(all.some(treeOnly)).toBe(true)
    expect(all.some((v) => v.isEvent && v.isPremium)).toBe(true)
    expect(all.some((v) => v.isSquadron)).toBe(true)
    expect(all.some((v) => v.isEvent && v.isRemoved)).toBe(true)
  })

  // The feed's recency accent renders only for a record verified today, and the
  // ink sweep on /grb is the only thing measuring it — no such record, no cover.
  // Dated at the run itself, not merely inside today: a record hours old lands
  // today or yesterday by the hour the seed happens to run at.
  it('dates one demo record at the seed run, so today at any hour', async () => {
    const seededAt = new Date()
    await seedDemo(t.db)
    const sinceRun = (await t.db.select().from(records)).filter(
      (r) =>
        r.status === 'verified' && r.verifiedAt && r.verifiedAt >= seededAt,
    )
    expect(sinceRun).not.toEqual([])
    expect(sinceRun.every((r) => isToday(r.verifiedAt!))).toBe(true)
  })

  it('writes search terms for every fixture and demo vehicle', async () => {
    await seedDemo(t.db)
    const all = await t.db.select().from(vehicles)
    const withTerms = new Set(
      (await t.db.select().from(vehicleSearchTerms)).map((r) => r.vehicleId),
    )
    expect(all.filter((v) => !withTerms.has(v.id))).toEqual([])
    const tiger = all.find((v) => v.name === 'Tiger II (H)')!
    const tigerTerms = (
      await t.db
        .select()
        .from(vehicleSearchTerms)
        .where(eq(vehicleSearchTerms.vehicleId, tiger.id))
    ).map((r) => r.term)
    expect(tigerTerms).toEqual(expect.arrayContaining(['tigeriih', 'tiger2h']))
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
