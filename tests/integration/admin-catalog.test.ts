import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { modeMinKills, modes, patches, vehicles } from '#/db/schema'
import {
  addPatch,
  listAdminVehicles,
  listPatchOptions,
  listRulesConfig,
  setVehicleDifficult,
  updateDifficultMinKills,
  updateModeRules,
  updateModeMinKills,
} from '#/admin/catalog'
import { listAudit } from '#/admin/audit'

const MOD = '00000000-0000-4000-8000-000000000001'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  await t.client.query('insert into auth.users (id) values ($1)', [MOD])
})
afterEach(async () => {
  await t.client.close()
})

describe('setVehicleDifficult', () => {
  it('flips the flag and audits before/after', async () => {
    const [panther] = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.slug, 'panther-d'))
    expect(panther.isDifficult).toBe(false)

    await setVehicleDifficult(t.db, MOD, panther.id, true)
    const [after] = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, panther.id))
    expect(after.isDifficult).toBe(true)

    const audit = await listAudit(t.db, { entity: 'vehicle' })
    const row = audit.rows.find((r) => r.action === 'vehicle.set_difficult')!
    expect(row.diff).toMatchObject({
      before: { isDifficult: false },
      after: { isDifficult: true },
    })
  })

  it('is a no-op without an audit row when unchanged', async () => {
    const [tiger] = await t.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.slug, 'tiger-ii-h'))
    await setVehicleDifficult(t.db, MOD, tiger.id, true)
    const audit = await listAudit(t.db, { entity: 'vehicle' })
    expect(audit.rows).toHaveLength(0)
  })
})

describe('rules updates', () => {
  it('updates only the changed matrix cells and audits them', async () => {
    await updateModeMinKills(t.db, MOD, 'grb', [
      { class: 'medium', minKills: 12 },
      { class: 'heavy', minKills: 10 }, // unchanged
    ])
    const [medium] = await t.db
      .select()
      .from(modeMinKills)
      .where(
        and(eq(modeMinKills.mode, 'grb'), eq(modeMinKills.class, 'medium')),
      )
    expect(medium.minKills).toBe(12)

    const audit = await listAudit(t.db, { entity: 'rules' })
    const row = audit.rows.find((r) => r.action === 'rules.update_min_kills')!
    expect(row.diff).toMatchObject({
      before: { medium: 10 },
      after: { medium: 12 },
    })
    expect((row.diff as { before: object }).before).not.toHaveProperty('heavy')
  })

  it('inserts a matrix cell that did not exist yet', async () => {
    await updateModeMinKills(t.db, MOD, 'gab', [
      { class: 'medium', minKills: 9 },
    ])
    const [row] = await t.db
      .select()
      .from(modeMinKills)
      .where(
        and(eq(modeMinKills.mode, 'gab'), eq(modeMinKills.class, 'medium')),
      )
    expect(row.minKills).toBe(9)
  })

  it('skips the audit row when nothing changed', async () => {
    await updateModeMinKills(t.db, MOD, 'grb', [
      { class: 'heavy', minKills: 10 },
    ])
    expect((await listAudit(t.db, { entity: 'rules' })).rows).toHaveLength(0)
  })

  it('updateModeRules is atomic: a bad override rolls back the matrix cells', async () => {
    await expect(
      updateModeRules(t.db, MOD, 'grb', {
        entries: [{ class: 'medium', minKills: 12 }],
        difficultMinKills: 3.5,
      }),
    ).rejects.toThrow(/positive integer/i)
    const [medium] = await t.db
      .select()
      .from(modeMinKills)
      .where(
        and(eq(modeMinKills.mode, 'grb'), eq(modeMinKills.class, 'medium')),
      )
    expect(medium.minKills).toBe(10)
    expect((await listAudit(t.db, { entity: 'rules' })).rows).toHaveLength(0)
  })

  it('updates the per-mode difficult override', async () => {
    await updateDifficultMinKills(t.db, MOD, 'grb', 6)
    const [m] = await t.db.select().from(modes).where(eq(modes.mode, 'grb'))
    expect(m.difficultMinKills).toBe(6)
    const audit = await listAudit(t.db, { entity: 'rules' })
    const row = audit.rows.find(
      (r) => r.action === 'rules.update_difficult_min_kills',
    )!
    expect(row.diff).toMatchObject({ before: { grb: 5 }, after: { grb: 6 } })
  })

  it('listRulesConfig exposes every mode matrix for the editor', async () => {
    const config = await listRulesConfig(t.db)
    const grb = config.find((m) => m.mode === 'grb')!
    expect(grb.difficultMinKills).toBe(5)
    expect(grb.thresholds.find((c) => c.class === 'medium')?.minKills).toBe(10)
  })
})

describe('patches', () => {
  it('adds a patch and audits it', async () => {
    await addPatch(t.db, MOD, {
      version: '2.54',
      name: 'Firebirds',
      releasedAt: new Date('2026-07-10T00:00:00Z'),
    })
    const [row] = await t.db
      .select()
      .from(patches)
      .where(eq(patches.version, '2.54'))
    expect(row.name).toBe('Firebirds')
    const audit = await listAudit(t.db, { entity: 'patch' })
    expect(audit.rows[0].action).toBe('patch.create')
  })

  it('refuses a duplicate or empty version', async () => {
    await expect(addPatch(t.db, MOD, { version: '2.53' })).rejects.toThrow(
      /exists/i,
    )
    await expect(addPatch(t.db, MOD, { version: ' ' })).rejects.toThrow()
  })

  it('lists newest-first so the dropdown defaults to latest', async () => {
    await addPatch(t.db, MOD, {
      version: '2.54',
      releasedAt: new Date('2026-07-10T00:00:00Z'),
    })
    const options = await listPatchOptions(t.db)
    expect(options[0].version).toBe('2.54')
    // seed patches have no releasedAt — they sort after dated ones by version:
    expect(options.map((p) => p.version)).toContain('2.49')
  })
})

describe('listAdminVehicles', () => {
  it('searches by name and reports the difficult flag', async () => {
    const result = await listAdminVehicles(t.db, { q: 'tiger' })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].slug).toBe('tiger-ii-h')
    expect(result.rows[0].isDifficult).toBe(true)
  })

  it('filters to difficult-only', async () => {
    const result = await listAdminVehicles(t.db, { difficultOnly: true })
    expect(result.rows.map((v) => v.slug)).toEqual(['tiger-ii-h'])
  })
})
