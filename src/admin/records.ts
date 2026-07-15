import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import {
  modeMinKills,
  modes,
  players,
  profiles,
  recordProof,
  records,
  vehicles,
} from '#/db/schema'
import { qualifyingThreshold } from '#/lib/rules'
import type { ModeThresholds, VehicleClass } from '#/lib/rules'
import { rightfulHolder } from '#/admin/title'
import { writeAudit } from '#/admin/audit'
import { createPlayer, recordIgnAlias } from '#/admin/players'

export type ProofKind = (typeof recordProof.kind.enumValues)[number]

export interface ProofRowInput {
  kind: ProofKind
  storagePath?: string | null
  originalUrl?: string | null
}

export interface EntryInput {
  mode: string
  vehicleId: number
  playerId: number | null
  newPlayerName?: string | null
  ignSnapshot: string
  kills: number
  patch: string
  runBr?: number | null
  proofs: ProofRowInput[]
}

/* ── Qualifying threshold ────────────────────────────────────── */

async function thresholdFor(
  db: Db,
  mode: string,
  vehicleId: number,
): Promise<number | null> {
  const [vehicle] = await db
    .select({ class: vehicles.class, isDifficult: vehicles.isDifficult })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
  if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`)
  const [m] = await db
    .select({ difficultMinKills: modes.difficultMinKills })
    .from(modes)
    .where(eq(modes.mode, mode))
  if (!m) throw new Error(`Unknown mode ${mode}`)
  const rows = await db
    .select({ class: modeMinKills.class, minKills: modeMinKills.minKills })
    .from(modeMinKills)
    .where(eq(modeMinKills.mode, mode))
  const thresholds: ModeThresholds = {
    minKillsByClass: Object.fromEntries(
      rows.map((r) => [r.class, r.minKills]),
    ) as Partial<Record<VehicleClass, number>>,
    difficultMinKills: m.difficultMinKills,
  }
  return qualifyingThreshold(vehicle.class, vehicle.isDifficult, thresholds)
}

/* ── Auto-title recompute ────────────────────────────────────── */

/** Re-derives isCurrent for a (vehicle, mode) from the rightful-holder rule.
    Returns which record lost and which gained currency (null = no change). */
async function recomputeTitle(
  tx: Db,
  vehicleId: number,
  mode: string,
): Promise<{ demotedId: number | null; promotedId: number | null }> {
  const candidates = await tx
    .select({
      id: records.id,
      kills: records.kills,
      verifiedAt: records.verifiedAt,
      isCurrent: records.isCurrent,
    })
    .from(records)
    .where(
      and(
        eq(records.vehicleId, vehicleId),
        eq(records.mode, mode),
        eq(records.status, 'verified'),
      ),
    )
  const rightfulId = rightfulHolder(candidates)
  const previous = candidates.find((c) => c.isCurrent) ?? null
  if (previous?.id === rightfulId) return { demotedId: null, promotedId: null }

  // Clear before set: the partial unique index allows only one current row.
  if (previous) {
    await tx
      .update(records)
      .set({ isCurrent: false })
      .where(eq(records.id, previous.id))
  }
  if (rightfulId != null) {
    await tx
      .update(records)
      .set({ isCurrent: true })
      .where(eq(records.id, rightfulId))
  }
  return { demotedId: previous?.id ?? null, promotedId: rightfulId }
}

/* ── Lifecycle writes (each = one transaction incl. its audit row) ── */

export async function createRecord(db: Db, actorId: string, input: EntryInput) {
  const ign = input.ignSnapshot.trim()
  if (!ign) throw new Error('An IGN snapshot is required')
  if (!Number.isInteger(input.kills) || input.kills <= 0) {
    throw new Error('Kills must be a positive integer')
  }
  if (input.proofs.length === 0) {
    throw new Error('At least one proof is required to save a verified record')
  }
  for (const p of input.proofs) {
    if (!p.storagePath && !p.originalUrl) {
      throw new Error('A proof needs an uploaded file or a source URL')
    }
  }
  const newPlayerName = input.newPlayerName?.trim()
  if ((input.playerId == null) === !newPlayerName) {
    throw new Error('Pick an existing player or name a new one — exactly one')
  }

  return db.transaction(async (tx) => {
    const player = input.playerId
      ? (
          await tx
            .select({ id: players.id, displayName: players.displayName })
            .from(players)
            .where(eq(players.id, input.playerId))
        )[0]
      : await createPlayer(tx, actorId, newPlayerName!)
    if (!player) throw new Error(`Unknown player ${input.playerId}`)

    const addedAlias = await recordIgnAlias(tx, player.id, ign)

    const [created] = await tx
      .insert(records)
      .values({
        vehicleId: input.vehicleId,
        mode: input.mode,
        playerId: player.id,
        ignSnapshot: ign,
        displayNameSnapshot: player.displayName,
        kills: input.kills,
        runBr: input.runBr ?? null,
        patch: input.patch,
        status: 'verified',
        isCurrent: false,
        verifiedAt: new Date(),
        verifiedById: actorId,
      })
      .returning({ id: records.id })

    await tx.insert(recordProof).values(
      input.proofs.map((p, sort) => ({
        recordId: created.id,
        kind: p.kind,
        storagePath: p.storagePath ?? null,
        originalUrl: p.originalUrl ?? null,
        sort,
      })),
    )

    const { demotedId } = await recomputeTitle(tx, input.vehicleId, input.mode)
    const threshold = await thresholdFor(tx, input.mode, input.vehicleId)
    const belowThreshold = threshold != null && input.kills < threshold

    await writeAudit(tx, {
      actorId,
      action: 'record.create',
      entity: 'record',
      entityId: created.id,
      diff: {
        after: {
          mode: input.mode,
          vehicleId: input.vehicleId,
          playerId: player.id,
          ignSnapshot: ign,
          kills: input.kills,
          patch: input.patch,
          runBr: input.runBr ?? null,
        },
        context: {
          proofCount: input.proofs.length,
          ...(demotedId != null && { demotedRecordId: demotedId }),
          ...(belowThreshold && { belowThreshold: true }),
          ...(addedAlias && { addedIgnAlias: ign }),
        },
      },
    })

    const isCurrent = demotedId != null || (await isCurrentNow(tx, created.id))
    return {
      recordId: created.id,
      playerId: player.id,
      isCurrent,
      demotedRecordId: demotedId,
      belowThreshold,
    }
  })
}

async function isCurrentNow(tx: Db, recordId: number): Promise<boolean> {
  const [row] = await tx
    .select({ isCurrent: records.isCurrent })
    .from(records)
    .where(eq(records.id, recordId))
  return row.isCurrent
}

export interface RecordUpdateInput {
  kills?: number
  playerId?: number
  ignSnapshot?: string
  runBr?: number | null
  patch?: string
}

export async function updateRecord(
  db: Db,
  actorId: string,
  recordId: number,
  input: RecordUpdateInput,
) {
  if (input.kills != null && (!Number.isInteger(input.kills) || input.kills <= 0)) {
    throw new Error('Kills must be a positive integer')
  }
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(records)
      .where(eq(records.id, recordId))
    if (!existing) throw new Error(`Unknown record ${recordId}`)

    const fields = ['kills', 'playerId', 'ignSnapshot', 'runBr', 'patch'] as const
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    const patch: Record<string, unknown> = {}
    for (const f of fields) {
      const next = input[f]
      if (next !== undefined && next !== existing[f]) {
        before[f] = existing[f]
        after[f] = next
        patch[f] = next
      }
    }
    if (Object.keys(patch).length === 0) {
      return { promotedRecordId: null, demotedRecordId: null, belowThreshold: false }
    }

    await tx.update(records).set(patch).where(eq(records.id, recordId))

    let promotedId: number | null = null
    let demotedId: number | null = null
    if ('kills' in patch) {
      const outcome = await recomputeTitle(tx, existing.vehicleId, existing.mode)
      promotedId = outcome.promotedId
      demotedId = outcome.demotedId
    }
    const kills = (patch.kills as number | undefined) ?? existing.kills
    const threshold = await thresholdFor(tx, existing.mode, existing.vehicleId)
    const belowThreshold = threshold != null && kills < threshold

    await writeAudit(tx, {
      actorId,
      action: 'record.update',
      entity: 'record',
      entityId: recordId,
      diff: {
        before,
        after,
        context: {
          ...(promotedId != null && { promotedRecordId: promotedId }),
          ...(demotedId != null && { demotedRecordId: demotedId }),
          ...(belowThreshold && { belowThreshold: true }),
        },
      },
    })
    return { promotedRecordId: promotedId, demotedRecordId: demotedId, belowThreshold }
  })
}

export async function retireRecord(
  db: Db,
  actorId: string,
  recordId: number,
  reason: string,
) {
  const why = reason.trim()
  if (!why) throw new Error('A retire reason is required')
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(records)
      .where(eq(records.id, recordId))
    if (!existing) throw new Error(`Unknown record ${recordId}`)
    if (existing.status !== 'verified') {
      throw new Error('Only a verified record can be retired')
    }
    await tx
      .update(records)
      .set({ status: 'retired', isCurrent: false })
      .where(eq(records.id, recordId))
    const { promotedId } = await recomputeTitle(
      tx,
      existing.vehicleId,
      existing.mode,
    )
    await writeAudit(tx, {
      actorId,
      action: 'record.retire',
      entity: 'record',
      entityId: recordId,
      diff: {
        before: { status: 'verified' },
        after: { status: 'retired' },
        context: {
          reason: why,
          ...(promotedId != null && { promotedRecordId: promotedId }),
        },
      },
    })
    return { promotedRecordId: promotedId }
  })
}

export async function reverifyRecord(db: Db, actorId: string, recordId: number) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(records)
      .where(eq(records.id, recordId))
    if (!existing) throw new Error(`Unknown record ${recordId}`)
    if (existing.status !== 'retired') {
      throw new Error('Only a retired record can be re-verified')
    }
    // verifiedAt survives the round trip — it is the record's official date.
    await tx
      .update(records)
      .set({ status: 'verified' })
      .where(eq(records.id, recordId))
    const { demotedId } = await recomputeTitle(
      tx,
      existing.vehicleId,
      existing.mode,
    )
    await writeAudit(tx, {
      actorId,
      action: 'record.reverify',
      entity: 'record',
      entityId: recordId,
      diff: {
        before: { status: 'retired' },
        after: { status: 'verified' },
        context: {
          ...(demotedId != null && { demotedRecordId: demotedId }),
        },
      },
    })
    return { demotedRecordId: demotedId }
  })
}

export async function makeCurrentRecord(
  db: Db,
  actorId: string,
  recordId: number,
) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(records)
      .where(eq(records.id, recordId))
    if (!target) throw new Error(`Unknown record ${recordId}`)
    if (target.status !== 'verified') {
      throw new Error('Only a verified record can be made current')
    }
    if (target.isCurrent) return { demotedRecordId: null }

    const [previous] = await tx
      .select({ id: records.id })
      .from(records)
      .where(
        and(
          eq(records.vehicleId, target.vehicleId),
          eq(records.mode, target.mode),
          eq(records.isCurrent, true),
        ),
      )
    if (previous) {
      await tx
        .update(records)
        .set({ isCurrent: false })
        .where(eq(records.id, previous.id))
    }
    await tx
      .update(records)
      .set({ isCurrent: true })
      .where(eq(records.id, recordId))
    await writeAudit(tx, {
      actorId,
      action: 'record.make_current',
      entity: 'record',
      entityId: recordId,
      diff: {
        context: previous ? { demotedRecordId: previous.id } : {},
      },
    })
    return { demotedRecordId: previous?.id ?? null }
  })
}

export async function demoteRecord(db: Db, actorId: string, recordId: number) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(records)
      .where(eq(records.id, recordId))
    if (!target) throw new Error(`Unknown record ${recordId}`)
    if (!target.isCurrent) throw new Error('Record is not current')

    await tx
      .update(records)
      .set({ isCurrent: false })
      .where(eq(records.id, recordId))
    // Promote the rightful holder among the rest.
    const rest = await tx
      .select({
        id: records.id,
        kills: records.kills,
        verifiedAt: records.verifiedAt,
      })
      .from(records)
      .where(
        and(
          eq(records.vehicleId, target.vehicleId),
          eq(records.mode, target.mode),
          eq(records.status, 'verified'),
          sql`${records.id} <> ${recordId}`,
        ),
      )
    const promotedId = rightfulHolder(rest)
    if (promotedId != null) {
      await tx
        .update(records)
        .set({ isCurrent: true })
        .where(eq(records.id, promotedId))
    }
    await writeAudit(tx, {
      actorId,
      action: 'record.demote',
      entity: 'record',
      entityId: recordId,
      diff: {
        context: promotedId != null ? { promotedRecordId: promotedId } : {},
      },
    })
    return { promotedRecordId: promotedId }
  })
}

export async function attachProofs(
  db: Db,
  actorId: string,
  recordId: number,
  proofs: ProofRowInput[],
) {
  if (proofs.length === 0) throw new Error('Nothing to attach')
  for (const p of proofs) {
    if (!p.storagePath && !p.originalUrl) {
      throw new Error('A proof needs an uploaded file or a source URL')
    }
  }
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: records.id })
      .from(records)
      .where(eq(records.id, recordId))
    if (!existing) throw new Error(`Unknown record ${recordId}`)
    const [{ maxSort }] = await tx
      .select({ maxSort: sql<number | null>`max(${recordProof.sort})` })
      .from(recordProof)
      .where(eq(recordProof.recordId, recordId))
    const base = (maxSort ?? -1) + 1
    await tx.insert(recordProof).values(
      proofs.map((p, i) => ({
        recordId,
        kind: p.kind,
        storagePath: p.storagePath ?? null,
        originalUrl: p.originalUrl ?? null,
        sort: base + i,
      })),
    )
    await writeAudit(tx, {
      actorId,
      action: 'record.attach_proof',
      entity: 'record',
      entityId: recordId,
      diff: { context: { added: proofs.length, kinds: proofs.map((p) => p.kind) } },
    })
    return { added: proofs.length }
  })
}

/* ── Confirm-modal preview: what would this write do to the title? ── */

export type TitlePreviewRequest =
  | { kind: 'entry'; mode: string; vehicleId: number; kills: number }
  | { kind: 'update'; recordId: number; kills: number }
  | { kind: 'retire'; recordId: number }
  | { kind: 'reverify'; recordId: number }

interface PreviewRecord {
  id: number
  kills: number
  playerName: string
}

export interface TitlePreview {
  wouldBeCurrent: boolean
  demoted: PreviewRecord | null
  promoted: PreviewRecord | null
  threshold: number | null
  belowThreshold: boolean
}

const ENTRY_SENTINEL = Number.MAX_SAFE_INTEGER

export async function previewTitleChange(
  db: Db,
  req: TitlePreviewRequest,
): Promise<TitlePreview> {
  let vehicleId: number
  let mode: string
  let subjectId: number | null = null
  let kills: number

  if (req.kind === 'entry') {
    vehicleId = req.vehicleId
    mode = req.mode
    kills = req.kills
  } else {
    const [existing] = await db
      .select()
      .from(records)
      .where(eq(records.id, req.recordId))
    if (!existing) throw new Error(`Unknown record ${req.recordId}`)
    vehicleId = existing.vehicleId
    mode = existing.mode
    subjectId = existing.id
    kills = req.kind === 'update' ? req.kills : existing.kills
  }

  const rows = await db
    .select({
      id: records.id,
      kills: records.kills,
      verifiedAt: records.verifiedAt,
      isCurrent: records.isCurrent,
      status: records.status,
      playerName: players.displayName,
    })
    .from(records)
    .innerJoin(players, eq(players.id, records.playerId))
    .where(and(eq(records.vehicleId, vehicleId), eq(records.mode, mode)))

  const currentId = rows.find((r) => r.isCurrent)?.id ?? null

  // Build the hypothetical candidate set after the requested change.
  const candidates = rows
    .filter((r) => {
      if (r.id === subjectId) {
        return req.kind === 'retire' ? false : true
      }
      return r.status === 'verified'
    })
    .map((r) =>
      r.id === subjectId && req.kind === 'update'
        ? { ...r, kills }
        : r,
    )
  if (req.kind === 'entry') {
    candidates.push({
      id: ENTRY_SENTINEL,
      kills,
      verifiedAt: new Date(),
      isCurrent: false,
      status: 'verified',
      playerName: '',
    })
  }

  const rightfulId = rightfulHolder(candidates)
  const subject = req.kind === 'entry' ? ENTRY_SENTINEL : subjectId
  const wouldBeCurrent = rightfulId === subject

  const byId = new Map(rows.map((r) => [r.id, r]))
  const strip = (r: (typeof rows)[number] | undefined): PreviewRecord | null =>
    r ? { id: r.id, kills: r.kills, playerName: r.playerName } : null

  const demoted =
    rightfulId !== currentId && currentId != null && currentId !== subjectId
      ? strip(byId.get(currentId))
      : null
  const promoted =
    rightfulId != null &&
    rightfulId !== currentId &&
    rightfulId !== ENTRY_SENTINEL &&
    rightfulId !== subjectId
      ? strip(byId.get(rightfulId))
      : null

  const threshold = await thresholdFor(db, mode, vehicleId)
  const belowThreshold = threshold != null && kills < threshold

  return { wouldBeCurrent, demoted, promoted, threshold, belowThreshold }
}

/* ── Admin reads ─────────────────────────────────────────────── */

export type RecordStatusFilter =
  (typeof records.status.enumValues)[number]

export interface AdminRecordFilters {
  mode?: string
  status?: RecordStatusFilter
  q?: string
  limit?: number
  offset?: number
}

export async function listAdminRecords(db: Db, filters: AdminRecordFilters) {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  const conds = []
  if (filters.mode) conds.push(eq(records.mode, filters.mode))
  if (filters.status) conds.push(eq(records.status, filters.status))
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim().replace(/[\\%_]/g, '\\$&')}%`
    conds.push(
      or(
        ilike(vehicles.name, like),
        ilike(players.displayName, like),
        ilike(records.ignSnapshot, like),
      ),
    )
  }
  const rows = await db
    .select({
      id: records.id,
      mode: records.mode,
      kills: records.kills,
      status: records.status,
      isCurrent: records.isCurrent,
      patch: records.patch,
      runBr: records.runBr,
      verifiedAt: records.verifiedAt,
      vehicleName: vehicles.name,
      vehicleSlug: vehicles.slug,
      playerName: players.displayName,
      playerSlug: players.slug,
      ignSnapshot: records.ignSnapshot,
      verifierHandle: profiles.handle,
    })
    .from(records)
    .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
    .innerJoin(players, eq(players.id, records.playerId))
    .leftJoin(profiles, eq(profiles.id, records.verifiedById))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${records.verifiedAt} desc nulls last`, desc(records.id))
    .limit(limit + 1)
    .offset(offset)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}

export async function getAdminRecord(db: Db, recordId: number) {
  const [row] = await db
    .select({
      record: records,
      vehicle: {
        id: vehicles.id,
        name: vehicles.name,
        slug: vehicles.slug,
        class: vehicles.class,
        isDifficult: vehicles.isDifficult,
      },
      player: {
        id: players.id,
        displayName: players.displayName,
        slug: players.slug,
      },
      verifierHandle: profiles.handle,
    })
    .from(records)
    .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
    .innerJoin(players, eq(players.id, records.playerId))
    .leftJoin(profiles, eq(profiles.id, records.verifiedById))
    .where(eq(records.id, recordId))
  if (!row) return null

  const [proofs, siblings, threshold] = await Promise.all([
    db
      .select()
      .from(recordProof)
      .where(eq(recordProof.recordId, recordId))
      .orderBy(asc(recordProof.sort)),
    db
      .select({
        id: records.id,
        kills: records.kills,
        status: records.status,
        isCurrent: records.isCurrent,
        verifiedAt: records.verifiedAt,
        playerName: players.displayName,
      })
      .from(records)
      .innerJoin(players, eq(players.id, records.playerId))
      .where(
        and(
          eq(records.vehicleId, row.record.vehicleId),
          eq(records.mode, row.record.mode),
          sql`${records.id} <> ${recordId}`,
        ),
      )
      .orderBy(desc(records.kills)),
    thresholdFor(db, row.record.mode, row.record.vehicleId),
  ])

  return { ...row, proofs, siblings, threshold }
}
