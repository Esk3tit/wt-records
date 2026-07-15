import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import {
  auditLog,
  playerAliases,
  players,
  recordProof,
  records,
  vehicles,
} from '#/db/schema'
import {
  attachProofs,
  createRecord,
  demoteRecord,
  getAdminRecord,
  listAdminRecords,
  makeCurrentRecord,
  previewTitleChange,
  retireRecord,
  reverifyRecord,
  updateRecord,
} from '#/admin/records'
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

async function vehicleId(slug: string): Promise<number> {
  const [v] = await t.db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.slug, slug))
  return v.id
}

async function playerId(slug: string): Promise<number> {
  const [p] = await t.db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.slug, slug))
  return p.id
}

async function currentRecord(vehId: number) {
  const rows = await t.db
    .select()
    .from(records)
    .where(
      and(
        eq(records.vehicleId, vehId),
        eq(records.mode, 'grb'),
        eq(records.isCurrent, true),
      ),
    )
  return rows[0] ?? null
}

const PROOF = [{ kind: 'scoreboard' as const, storagePath: 'entries/a.webp' }]

type EntryInput = Parameters<typeof createRecord>[2]

function entry(
  overrides: Partial<EntryInput> & { vehicleId: number },
): EntryInput {
  return {
    mode: 'grb',
    playerId: null,
    newPlayerName: null,
    ignSnapshot: 'Ace',
    kills: 15,
    patch: '2.53',
    runBr: null,
    proofs: PROOF,
    ...overrides,
  }
}

describe('createRecord', () => {
  it('lands direct-to-verified, takes the title, demotes the incumbent', async () => {
    const veh = await vehicleId('m4a1')
    const ace = await playerId('ace')
    const before = await currentRecord(veh)

    const result = await createRecord(
      t.db,
      MOD,
      entry({ vehicleId: veh, playerId: ace, kills: 15 }),
    )

    expect(result.isCurrent).toBe(true)
    expect(result.demotedRecordId).toBe(before.id)

    const now = await currentRecord(veh)
    expect(now.id).toBe(result.recordId)
    expect(now.status).toBe('verified')
    expect(now.verifiedById).toBe(MOD)
    expect(now.verifiedAt).toBeInstanceOf(Date)
    // stamped server-side from the player row, never client input:
    expect(now.displayNameSnapshot).toBe('Ace')

    const [demoted] = await t.db
      .select()
      .from(records)
      .where(eq(records.id, before.id))
    expect(demoted.isCurrent).toBe(false)
    expect(demoted.status).toBe('verified')
  })

  it('does not supersede on an equal score (first-to-achieve keeps it)', async () => {
    const veh = await vehicleId('m4a1')
    const ace = await playerId('ace')
    const before = await currentRecord(veh)

    const result = await createRecord(
      t.db,
      MOD,
      entry({ vehicleId: veh, playerId: ace, kills: 14 }),
    )

    expect(result.isCurrent).toBe(false)
    expect(result.demotedRecordId).toBeNull()
    expect((await currentRecord(veh)).id).toBe(before.id)
  })

  it('takes an open bounty without demoting anyone', async () => {
    const veh = await vehicleId('m18-gmc')
    const ace = await playerId('ace')
    const result = await createRecord(
      t.db,
      MOD,
      entry({ vehicleId: veh, playerId: ace, kills: 9 }),
    )
    expect(result.isCurrent).toBe(true)
    expect(result.demotedRecordId).toBeNull()
  })

  it('creates a player inline with a unique slug and audits it', async () => {
    const veh = await vehicleId('m18-gmc')
    const result = await createRecord(
      t.db,
      MOD,
      entry({
        vehicleId: veh,
        newPlayerName: 'Ace', // collides with the existing Ace
        ignSnapshot: 'AceIGN',
        kills: 9,
      }),
    )
    const [created] = await t.db
      .select()
      .from(players)
      .where(eq(players.id, result.playerId))
    expect(created.displayName).toBe('Ace')
    expect(created.slug).toBe('ace-2')

    const audit = await listAudit(t.db, { entity: 'player' })
    expect(audit.rows.map((r) => r.action)).toContain('player.create')
  })

  it('auto-adds an unknown IGN as a submission alias', async () => {
    const veh = await vehicleId('m18-gmc')
    const ace = await playerId('ace')
    await createRecord(
      t.db,
      MOD,
      entry({ vehicleId: veh, playerId: ace, ignSnapshot: 'xX_Ace_Xx' }),
    )
    const aliases = await t.db
      .select()
      .from(playerAliases)
      .where(
        and(
          eq(playerAliases.playerId, ace),
          eq(playerAliases.name, 'xX_Ace_Xx'),
        ),
      )
    expect(aliases).toHaveLength(1)
    expect(aliases[0].kind).toBe('ign')
    expect(aliases[0].source).toBe('submission')
  })

  it('saves below the qualifying threshold but flags it in the audit diff', async () => {
    const veh = await vehicleId('m18-gmc') // spg → grb minKills 7
    const ace = await playerId('ace')
    const result = await createRecord(
      t.db,
      MOD,
      entry({ vehicleId: veh, playerId: ace, kills: 3 }),
    )
    expect(result.belowThreshold).toBe(true)

    const audit = await listAudit(t.db, { entity: 'record' })
    const row = audit.rows.find((r) => r.action === 'record.create')!
    expect(row.diff).toMatchObject({ context: { belowThreshold: true } })
  })

  it('uses the difficult override for difficult vehicles', async () => {
    const veh = await vehicleId('tiger-ii-h') // difficult, override 5
    const ace = await playerId('ace')
    const result = await createRecord(
      t.db,
      MOD,
      entry({ vehicleId: veh, playerId: ace, kills: 9 }),
    )
    expect(result.belowThreshold).toBe(false)
  })

  it('refuses to save without at least one proof', async () => {
    const veh = await vehicleId('m18-gmc')
    const ace = await playerId('ace')
    await expect(
      createRecord(
        t.db,
        MOD,
        entry({ vehicleId: veh, playerId: ace, proofs: [] }),
      ),
    ).rejects.toThrow(/proof/i)
    expect(await currentRecord(veh)).toBeNull()
  })

  it('inserts proof rows in order, video as URL-only', async () => {
    const veh = await vehicleId('m18-gmc')
    const ace = await playerId('ace')
    const result = await createRecord(
      t.db,
      MOD,
      entry({
        vehicleId: veh,
        playerId: ace,
        proofs: [
          { kind: 'scoreboard', storagePath: 'entries/a.webp' },
          {
            kind: 'end_game',
            storagePath: 'entries/b.webp',
            originalUrl: 'https://discord.com/x.png',
          },
          { kind: 'video', originalUrl: 'https://youtu.be/x' },
        ],
      }),
    )
    const proofs = await t.db
      .select()
      .from(recordProof)
      .where(eq(recordProof.recordId, result.recordId))
      .orderBy(asc(recordProof.sort))
    expect(proofs.map((p) => p.kind)).toEqual([
      'scoreboard',
      'end_game',
      'video',
    ])
    expect(proofs[2].storagePath).toBeNull()
    expect(proofs[1].originalUrl).toBe('https://discord.com/x.png')
  })

  it('writes one record.create audit row with the demote context', async () => {
    const veh = await vehicleId('m4a1')
    const ace = await playerId('ace')
    const before = await currentRecord(veh)
    await createRecord(t.db, MOD, entry({ vehicleId: veh, playerId: ace }))

    const audit = await listAudit(t.db, { entity: 'record' })
    const creates = audit.rows.filter((r) => r.action === 'record.create')
    expect(creates).toHaveLength(1)
    expect(creates[0].actorId).toBe(MOD)
    expect(creates[0].diff).toMatchObject({
      context: { demotedRecordId: before.id },
    })
  })
})

describe('updateRecord', () => {
  it('recomputes the title when a kills edit dethrones the holder', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh) // Ace 14
    const result = await updateRecord(t.db, MOD, current.id, { kills: 10 })

    const now = await currentRecord(veh)
    expect(now.kills).toBe(12) // Maverick's 12 becomes rightful
    expect(result.promotedRecordId).toBe(now.id)

    const audit = await listAudit(t.db, { entity: 'record' })
    const row = audit.rows.find((r) => r.action === 'record.update')!
    expect(row.diff).toMatchObject({
      before: { kills: 14 },
      after: { kills: 10 },
    })
  })

  it('records only changed fields in the diff', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    await updateRecord(t.db, MOD, current.id, { runBr: 4.0, kills: 14 })
    const audit = await listAudit(t.db, { entity: 'record' })
    const row = audit.rows.find((r) => r.action === 'record.update')!
    expect(row.diff).toMatchObject({
      before: { runBr: 3.7 },
      after: { runBr: 4 },
    })
    expect((row.diff as { before: object }).before).not.toHaveProperty('kills')
  })

  it('reassigns the holder without touching snapshots', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    const floppa = await playerId('floppa')
    await updateRecord(t.db, MOD, current.id, { playerId: floppa })
    const [row] = await t.db
      .select()
      .from(records)
      .where(eq(records.id, current.id))
    expect(row.playerId).toBe(floppa)
    expect(row.ignSnapshot).toBe('Ace')
    expect(row.displayNameSnapshot).toBe('Ace')
  })
})

describe('retireRecord / reverifyRecord', () => {
  it('retires softly: promotes the next-best and keeps row + proofs', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh) // Ace 14
    const result = await retireRecord(t.db, MOD, current.id, 'debunked proof')

    const [retired] = await t.db
      .select()
      .from(records)
      .where(eq(records.id, current.id))
    expect(retired.status).toBe('retired')
    expect(retired.isCurrent).toBe(false)

    const now = await currentRecord(veh)
    expect(now.kills).toBe(12)
    expect(result.promotedRecordId).toBe(now.id)

    const proofs = await t.db
      .select()
      .from(recordProof)
      .where(eq(recordProof.recordId, current.id))
    expect(proofs.length).toBeGreaterThan(0)

    const audit = await listAudit(t.db, { entity: 'record' })
    const row = audit.rows.find((r) => r.action === 'record.retire')!
    expect(row.diff).toMatchObject({
      context: { reason: 'debunked proof', promotedRecordId: now.id },
    })
  })

  it('requires a reason', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    await expect(retireRecord(t.db, MOD, current.id, '  ')).rejects.toThrow(
      /reason/i,
    )
  })

  it('re-verify restores the record and recomputes the title back', async () => {
    const veh = await vehicleId('m4a1')
    const original = await currentRecord(veh) // Ace 14
    await retireRecord(t.db, MOD, original.id, 'entered by mistake')
    await reverifyRecord(t.db, MOD, original.id)

    const now = await currentRecord(veh)
    expect(now.id).toBe(original.id)
    const [row] = await t.db
      .select()
      .from(records)
      .where(eq(records.id, original.id))
    expect(row.status).toBe('verified')
    // the official record date survives the round trip:
    expect(row.verifiedAt?.getTime()).toBe(original.verifiedAt?.getTime())

    const audit = await listAudit(t.db, { entity: 'record' })
    expect(audit.rows.map((r) => r.action)).toContain('record.reverify')
  })
})

describe('explicit corrective actions', () => {
  it('makeCurrentRecord forces a verified record current', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    const [maverick12] = await t.db
      .select()
      .from(records)
      .where(
        and(
          eq(records.vehicleId, veh),
          eq(records.mode, 'grb'),
          eq(records.kills, 12),
        ),
      )
    const result = await makeCurrentRecord(t.db, MOD, maverick12.id)
    expect(result.demotedRecordId).toBe(current.id)
    expect((await currentRecord(veh)).id).toBe(maverick12.id)
  })

  it('demoteRecord clears currency and promotes the next-best', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh) // Ace 14
    const result = await demoteRecord(t.db, MOD, current.id)
    const now = await currentRecord(veh)
    expect(now.kills).toBe(12)
    expect(result.promotedRecordId).toBe(now.id)
  })
})

describe('attachProofs', () => {
  it('appends proofs after the existing sort order and audits', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh) // has 2 proofs (sort 0,1)
    await attachProofs(t.db, MOD, current.id, [
      { kind: 'end_life', storagePath: 'entries/c.webp' },
    ])
    const proofs = await t.db
      .select()
      .from(recordProof)
      .where(eq(recordProof.recordId, current.id))
      .orderBy(asc(recordProof.sort))
    expect(proofs).toHaveLength(3)
    expect(proofs[2].sort).toBe(2)
    expect(proofs[2].kind).toBe('end_life')

    const audit = await listAudit(t.db, { entity: 'record' })
    expect(audit.rows.map((r) => r.action)).toContain('record.attach_proof')
  })

  it('rejects an empty attach', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    await expect(attachProofs(t.db, MOD, current.id, [])).rejects.toThrow()
  })
})

describe('previewTitleChange', () => {
  it('previews an entry that would demote the incumbent', async () => {
    const veh = await vehicleId('m4a1')
    const preview = await previewTitleChange(t.db, {
      kind: 'entry',
      mode: 'grb',
      vehicleId: veh,
      kills: 15,
    })
    expect(preview.wouldBeCurrent).toBe(true)
    expect(preview.demoted?.kills).toBe(14)
    expect(preview.demoted?.playerName).toBe('Ace')
    expect(preview.belowThreshold).toBe(false)
  })

  it('previews an equal-kills entry as not taking the title', async () => {
    const veh = await vehicleId('m4a1')
    const preview = await previewTitleChange(t.db, {
      kind: 'entry',
      mode: 'grb',
      vehicleId: veh,
      kills: 14,
    })
    expect(preview.wouldBeCurrent).toBe(false)
    expect(preview.demoted).toBeNull()
  })

  it('previews a retire promoting the runner-up', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    const preview = await previewTitleChange(t.db, {
      kind: 'retire',
      recordId: current.id,
    })
    expect(preview.promoted?.kills).toBe(12)
    expect(preview.promoted?.playerName).toBe('Maverick')
  })

  it('flags a below-threshold entry with its bar', async () => {
    const veh = await vehicleId('m18-gmc')
    const preview = await previewTitleChange(t.db, {
      kind: 'entry',
      mode: 'grb',
      vehicleId: veh,
      kills: 3,
    })
    expect(preview.belowThreshold).toBe(true)
    expect(preview.threshold).toBe(7)
  })
})

describe('admin reads', () => {
  it('listAdminRecords filters by status including retired', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    await retireRecord(t.db, MOD, current.id, 'cheating')

    const retired = await listAdminRecords(t.db, { status: 'retired' })
    expect(retired.rows).toHaveLength(1)
    expect(retired.rows[0].id).toBe(current.id)

    const verified = await listAdminRecords(t.db, { status: 'verified' })
    expect(verified.rows.map((r) => r.id)).not.toContain(current.id)
  })

  it('getAdminRecord returns proofs, siblings and lifecycle context', async () => {
    const veh = await vehicleId('m4a1')
    const current = await currentRecord(veh)
    const detail = await getAdminRecord(t.db, current.id)
    expect(detail!.record.id).toBe(current.id)
    expect(detail!.vehicle.slug).toBe('m4a1')
    expect(detail!.player.slug).toBe('ace')
    expect(detail!.proofs).toHaveLength(2)
    expect(detail!.siblings.map((s) => s.kills).sort()).toEqual([12, 9])
  })
})

describe('audit trail', () => {
  it('lists newest-first with entity filter and actor id', async () => {
    const veh = await vehicleId('m18-gmc')
    const ace = await playerId('ace')
    await createRecord(t.db, MOD, entry({ vehicleId: veh, playerId: ace }))
    const all = await listAudit(t.db, {})
    expect(all.rows[0].actorId).toBe(MOD)

    const playersOnly = await listAudit(t.db, { entity: 'player' })
    expect(playersOnly.rows.every((r) => r.entity === 'player')).toBe(true)
  })

  it('audit rows land in the same transaction as the write', async () => {
    // A failing insert (bad patch FK) must roll back the audit row with it.
    const veh = await vehicleId('m18-gmc')
    const ace = await playerId('ace')
    await expect(
      createRecord(
        t.db,
        MOD,
        entry({ vehicleId: veh, playerId: ace, patch: '9.99' }),
      ),
    ).rejects.toThrow()
    const rows = await t.db.select().from(auditLog)
    expect(rows).toHaveLength(0)
  })
})
