import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import {
  modeMinKills,
  modes,
  players,
  profiles,
  recordProof,
  records,
  vehicleBr,
  vehicles,
} from '#/db/schema'
import { qualifyingThreshold, rightfulHolder } from '#/lib/rules'
import type { ModeThresholds } from '#/lib/rules'
import { likeContains } from '#/lib/like'
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

async function vehicleModeContext(db: Db, mode: string, vehicleId: number) {
  const [vehicleRows, modeRows, minKillsRows] = await Promise.all([
    db
      .select({
        class: vehicles.class,
        isDifficult: vehicles.isDifficult,
        branch: vehicles.branch,
      })
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId)),
    db
      .select({
        difficultMinKills: modes.difficultMinKills,
        branch: modes.branch,
      })
      .from(modes)
      .where(eq(modes.mode, mode)),
    db
      .select({ class: modeMinKills.class, minKills: modeMinKills.minKills })
      .from(modeMinKills)
      .where(eq(modeMinKills.mode, mode)),
  ])
  const vehicle = vehicleRows.at(0)
  if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`)
  const m = modeRows.at(0)
  if (!m) throw new Error(`Unknown mode ${mode}`)
  const thresholds: ModeThresholds = {
    minKillsByClass: Object.fromEntries(
      minKillsRows.map((r) => [r.class, r.minKills]),
    ),
    difficultMinKills: m.difficultMinKills,
  }
  return {
    vehicle,
    mode: m,
    threshold: qualifyingThreshold(
      vehicle.class,
      vehicle.isDifficult,
      thresholds,
    ),
  }
}

async function thresholdFor(
  db: Db,
  mode: string,
  vehicleId: number,
): Promise<number | null> {
  return (await vehicleModeContext(db, mode, vehicleId)).threshold
}

/* ── Auto-title recompute ────────────────────────────────────── */

/** Serializes every isCurrent write for one (vehicle, mode). Row locks alone
    can't cover rows a racing transaction is still inserting; this key can. */
async function lockTitleKey(
  tx: Db,
  vehicleId: number,
  mode: string,
): Promise<void> {
  const key = `title:${vehicleId}:${mode}`
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`)
}

/** Re-derives isCurrent for a (vehicle, mode) from the rightful-holder rule.
    Returns which record lost and which gained currency (null = no change). */
async function recomputeTitle(
  tx: Db,
  vehicleId: number,
  mode: string,
): Promise<{ demotedId: number | null; promotedId: number | null }> {
  await lockTitleKey(tx, vehicleId, mode)
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
    .for('update')
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
    // A record only counts publicly when its mode's branch matches the
    // vehicle's (see modeMatchesBranch in queries) — refuse mismatches here
    // so a stale entry-form pick can't burn the title slot invisibly.
    const rules = await vehicleModeContext(tx, input.mode, input.vehicleId)
    if (rules.vehicle.branch !== rules.mode.branch) {
      throw new Error(
        `A ${rules.vehicle.branch} vehicle cannot hold a ${input.mode} record`,
      )
    }

    // FOR UPDATE so a concurrent merge can't tombstone the player between
    // this check and the insert (mergePlayers locks the same row).
    const player = input.playerId
      ? (
          await tx
            .select({
              id: players.id,
              displayName: players.displayName,
              mergedInto: players.mergedInto,
            })
            .from(players)
            .where(eq(players.id, input.playerId))
            .for('update')
        ).at(0)
      : await createPlayer(tx, actorId, newPlayerName!)
    if (!player) throw new Error(`Unknown player ${input.playerId}`)
    if ('mergedInto' in player && player.mergedInto != null) {
      throw new Error('Cannot enter a record for a merged player')
    }

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

    const { demotedId, promotedId } = await recomputeTitle(
      tx,
      input.vehicleId,
      input.mode,
    )
    const belowThreshold =
      rules.threshold != null && input.kills < rules.threshold

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

    return {
      recordId: created.id,
      playerId: player.id,
      isCurrent: promotedId === created.id,
      demotedRecordId: demotedId,
      belowThreshold,
    }
  })
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
  if (
    input.kills != null &&
    (!Number.isInteger(input.kills) || input.kills <= 0)
  ) {
    throw new Error('Kills must be a positive integer')
  }
  if (input.ignSnapshot != null) {
    const ign = input.ignSnapshot.trim()
    if (!ign) throw new Error('An IGN snapshot is required')
    input = { ...input, ignSnapshot: ign }
  }
  return db.transaction(async (tx) => {
    const existing = (
      await tx.select().from(records).where(eq(records.id, recordId))
    ).at(0)
    if (!existing) throw new Error(`Unknown record ${recordId}`)
    // pending/rejected belong to the future submission flow — only its
    // accept/decline step may touch them.
    if (existing.status !== 'verified' && existing.status !== 'retired') {
      throw new Error('Only verified or retired records can be edited')
    }

    if (input.playerId != null && input.playerId !== existing.playerId) {
      // Locked so a concurrent merge can't tombstone the player between
      // this check and the reassignment.
      const holder = (
        await tx
          .select({ mergedInto: players.mergedInto })
          .from(players)
          .where(eq(players.id, input.playerId))
          .for('update')
      ).at(0)
      if (!holder) throw new Error(`Unknown player ${input.playerId}`)
      if (holder.mergedInto != null) {
        throw new Error('Cannot reassign a record to a merged player')
      }
    }

    // displayNameSnapshot is deliberately NOT refreshed when playerId is
    // reassigned — snapshots record who the entry named at verification time.
    const fields = [
      'kills',
      'playerId',
      'ignSnapshot',
      'runBr',
      'patch',
    ] as const
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
      return {
        promotedRecordId: null,
        demotedRecordId: null,
        belowThreshold: false,
      }
    }

    await tx.update(records).set(patch).where(eq(records.id, recordId))

    let promotedId: number | null = null
    let demotedId: number | null = null
    if ('kills' in patch) {
      const outcome = await recomputeTitle(
        tx,
        existing.vehicleId,
        existing.mode,
      )
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
    return {
      promotedRecordId: promotedId,
      demotedRecordId: demotedId,
      belowThreshold,
    }
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
    const existing = (
      await tx.select().from(records).where(eq(records.id, recordId))
    ).at(0)
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

export async function reverifyRecord(
  db: Db,
  actorId: string,
  recordId: number,
) {
  return db.transaction(async (tx) => {
    const existing = (
      await tx.select().from(records).where(eq(records.id, recordId))
    ).at(0)
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
    const target = (
      await tx.select().from(records).where(eq(records.id, recordId))
    ).at(0)
    if (!target) throw new Error(`Unknown record ${recordId}`)
    if (target.status !== 'verified') {
      throw new Error('Only a verified record can be made current')
    }
    if (target.isCurrent) return { demotedRecordId: null }

    await lockTitleKey(tx, target.vehicleId, target.mode)
    const previous = (
      await tx
        .select({ id: records.id })
        .from(records)
        .where(
          and(
            eq(records.vehicleId, target.vehicleId),
            eq(records.mode, target.mode),
            eq(records.isCurrent, true),
          ),
        )
    ).at(0)
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
    const target = (
      await tx.select().from(records).where(eq(records.id, recordId))
    ).at(0)
    if (!target) throw new Error(`Unknown record ${recordId}`)
    if (!target.isCurrent) throw new Error('Record is not current')

    await lockTitleKey(tx, target.vehicleId, target.mode)
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
      .for('update')
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
    const existing = (
      await tx
        .select({ id: records.id })
        .from(records)
        .where(eq(records.id, recordId))
    ).at(0)
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
      diff: {
        context: { added: proofs.length, kinds: proofs.map((p) => p.kind) },
      },
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
    const existing = (
      await db.select().from(records).where(eq(records.id, req.recordId))
    ).at(0)
    if (!existing) throw new Error(`Unknown record ${req.recordId}`)
    vehicleId = existing.vehicleId
    mode = existing.mode
    subjectId = existing.id
    kills = req.kind === 'update' ? req.kills : existing.kills
  }

  const [rows, threshold] = await Promise.all([
    db
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
      .where(and(eq(records.vehicleId, vehicleId), eq(records.mode, mode))),
    thresholdFor(db, mode, vehicleId),
  ])

  const currentId = rows.find((r) => r.isCurrent)?.id ?? null

  // Candidacy mirrors what the write will do: only records that will be
  // status='verified' AFTER the change can hold the title.
  const candidates = rows
    .filter((r) => {
      if (r.id === subjectId) {
        if (req.kind === 'retire') return false
        if (req.kind === 'reverify') return true
        return r.status === 'verified'
      }
      return r.status === 'verified'
    })
    .map((r) =>
      r.id === subjectId && req.kind === 'update' ? { ...r, kills } : r,
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

  const belowThreshold = threshold != null && kills < threshold

  return { wouldBeCurrent, demoted, promoted, threshold, belowThreshold }
}

/* ── Admin reads ─────────────────────────────────────────────── */

/** Entry-form context after the vehicle typeahead: the current record (for
    supersede messaging) and the mode BR (runBr prefill). */
export async function getEntryContext(
  db: Db,
  mode: string,
  vehicleSlug: string,
) {
  const vehicle = (
    await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.slug, vehicleSlug))
      .limit(1)
  ).at(0)
  if (!vehicle) return null
  const [currentRows, brRows] = await Promise.all([
    db
      .select({
        id: records.id,
        kills: records.kills,
        verifiedAt: records.verifiedAt,
        playerName: players.displayName,
      })
      .from(records)
      .innerJoin(players, eq(players.id, records.playerId))
      .where(
        and(
          eq(records.vehicleId, vehicle.id),
          eq(records.mode, mode),
          eq(records.isCurrent, true),
          eq(records.status, 'verified'),
        ),
      ),
    db
      .select({ br: vehicleBr.br })
      .from(vehicleBr)
      .where(
        and(eq(vehicleBr.vehicleId, vehicle.id), eq(vehicleBr.mode, mode)),
      ),
  ])
  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    isDifficult: vehicle.isDifficult,
    class: vehicle.class,
    current: currentRows.at(0) ?? null,
    br: brRows.at(0)?.br ?? null,
  }
}

export type RecordStatusFilter = (typeof records.status.enumValues)[number]

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
    const like = likeContains(filters.q.trim())
    conds.push(
      or(
        ilike(vehicles.name, like),
        ilike(players.displayName, like),
        ilike(records.ignSnapshot, like),
      ),
    )
  }
  const where = conds.length ? and(...conds) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
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
      .where(where)
      .orderBy(sql`${records.verifiedAt} desc nulls last`, desc(records.id))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(players, eq(players.id, records.playerId))
      .where(where),
  ])
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit, total }
}

export async function getAdminRecord(db: Db, recordId: number) {
  const row = (
    await db
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
  ).at(0)
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
