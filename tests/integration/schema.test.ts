import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import {
  modes,
  nations,
  patches,
  players,
  recordProof,
  records,
  vehicles,
} from '#/db/schema'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
})
afterEach(async () => {
  await t.client.close()
})

async function seedBaseline() {
  await t.db.insert(modes).values({
    mode: 'grb',
    name: 'Ground Realistic Battles',
    branch: 'ground',
    isLive: true,
  })
  await t.db.insert(patches).values({ version: '2.53' })
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
    await t.db.insert(records).values({
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ply.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
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
      patch: '2.53',
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
      patch: '2.53',
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
        patch: '2.53',
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
      patch: '2.53',
      kills: 12,
      status: 'pending',
      isCurrent: false,
    })
    expect(await t.db.select().from(records)).toHaveLength(1)
  })

  it('allows a current verified record for each distinct vehicle', async () => {
    const { veh, veh2, ply } = await seedBaseline()
    await t.db.insert(records).values({
      vehicleId: veh.id,
      mode: 'grb',
      playerId: ply.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
      kills: 12,
      status: 'verified',
      isCurrent: true,
    })
    await t.db.insert(records).values({
      vehicleId: veh2.id,
      mode: 'grb',
      playerId: ply.id,
      ignSnapshot: 'Ace',
      patch: '2.53',
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
        patch: '2.53',
        kills: 0,
      }),
    ).rejects.toThrow()
  })

  it('rejects a record on an unregistered patch version', async () => {
    const { veh, ply } = await seedBaseline()
    await expect(
      t.db.insert(records).values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        patch: '9.99',
        kills: 12,
      }),
    ).rejects.toThrow()
  })

  it('rejects a record without a patch', async () => {
    const { veh, ply } = await seedBaseline()
    await expect(
      // @ts-expect-error patch is required at the type level too
      t.db.insert(records).values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        kills: 12,
      }),
    ).rejects.toThrow()
  })

  it('rejects a proof row with neither a storage path nor a source URL', async () => {
    const { veh, ply } = await seedBaseline()
    const [rec] = await t.db
      .insert(records)
      .values({
        vehicleId: veh.id,
        mode: 'grb',
        playerId: ply.id,
        ignSnapshot: 'Ace',
        patch: '2.53',
        kills: 12,
        status: 'verified',
        isCurrent: true,
      })
      .returning()
    await expect(
      t.db.insert(recordProof).values({ recordId: rec.id, kind: 'scoreboard' }),
    ).rejects.toThrow()
  })
})

describe('anon read surface', () => {
  it('pairs the records anon policy with its column-scoped SELECT grant', async () => {
    const { rows } = await t.client.query<{ column: string; granted: boolean }>(
      `select c.column_name as column,
              has_column_privilege('anon', 'public.records', c.column_name, 'select') as granted
       from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'records'`,
    )
    const granted = new Map(rows.map((r) => [r.column, r.granted]))
    // The signal-only subscription needs exactly these; everything else stays
    // closed to the anon key's Data API (verifier/submitter identities).
    expect(granted.get('id')).toBe(true)
    expect(granted.get('mode')).toBe(true)
    for (const closed of ['verified_by_id', 'submitted_by_id', 'kills']) {
      expect(granted.get(closed), closed).toBe(false)
    }
  })

  it('every table carrying an anon policy has the SELECT privilege Realtime needs', async () => {
    const { rows } = await t.client.query<{ tablename: string }>(
      `select distinct c.relname as tablename
       from pg_policy p join pg_class c on c.oid = p.polrelid
       where p.polroles @> array['anon'::regrole::oid]`,
    )
    for (const { tablename } of rows) {
      const { rows: cols } = await t.client.query<{ any_select: boolean }>(
        `select bool_or(has_column_privilege('anon', $1::regclass, column_name, 'select')) as any_select
         from information_schema.columns
         where table_schema = 'public' and table_name = $2`,
        [`public.${tablename}`, tablename],
      )
      // A policy without any SELECT privilege = Realtime silently delivers
      // nothing while the subscribe still succeeds.
      expect(cols[0].any_select, tablename).toBe(true)
    }
  })
})
