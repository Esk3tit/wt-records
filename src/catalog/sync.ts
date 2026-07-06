import { and, count, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import * as schema from '#/db/schema'
import type { CatalogSnapshot, SourceVehicle } from '#/catalog/source'
import type { Branch } from '#/catalog/mapping'
import {
  CANONICAL_NATIONS,
  assignVehicleSlug,
  branchAndClassForType,
  modeBrField,
  nationForCountry,
  patchFromGameVersion,
} from '#/catalog/mapping'

export interface SyncOptions {
  /** Roll the whole run back after computing the summary. */
  dryRun?: boolean
  /** Abort if the snapshot has fewer vehicles — a partial source response
      must not mass-flag the catalog as removed. */
  minVehicles?: number
  /** Abort if a single run would flag more vehicles removed than this.
      Defaults to max(25, 5% of the existing catalog). */
  maxRemoved?: number
}

export interface SyncSummary {
  gameVersion: string
  patch: string
  inserted: number
  updated: number
  /** Previously synced vehicles absent from this snapshot. */
  removed: number
  /** Vehicles that were flagged removed and are back. */
  restored: number
  /** Vehicles skipped because no mode plays their branch (naval today). */
  skippedNoMode: number
  brRows: number
  warnings: Array<string>
}

const DEFAULT_MIN_VEHICLES = 1000
const CHUNK = 500

class DryRunRollback extends Error {
  constructor(readonly summary: SyncSummary) {
    super('dry run')
  }
}

/** Idempotent, transactional catalog sync: a source snapshot → vehicles,
    vehicle_br, nations, and the current patches row. */
export async function syncCatalog(
  db: Db,
  snapshot: CatalogSnapshot,
  options: SyncOptions = {},
): Promise<SyncSummary> {
  const minVehicles = options.minVehicles ?? DEFAULT_MIN_VEHICLES
  if (snapshot.vehicles.length < minVehicles) {
    throw new Error(
      `Snapshot has ${snapshot.vehicles.length} vehicles, below the ` +
        `${minVehicles} safety floor — refusing to sync a partial catalog`,
    )
  }

  try {
    return await db.transaction(async (tx) => {
      const summary = await apply(tx, snapshot, options)
      if (options.dryRun) throw new DryRunRollback(summary)
      return summary
    })
  } catch (e) {
    if (e instanceof DryRunRollback) return e.summary
    throw e
  }
}

interface MappedVehicle {
  source: SourceVehicle
  branch: Branch
  class: (typeof schema.vehicles.$inferInsert)['class']
  nationSlug: string
}

async function apply(
  tx: Db,
  snapshot: CatalogSnapshot,
  options: SyncOptions,
): Promise<SyncSummary> {
  const warnings: Array<string> = [...(snapshot.warnings ?? [])]
  const patch = patchFromGameVersion(snapshot.gameVersion)
  const syncedAt = new Date()

  await tx
    .insert(schema.patches)
    .values({ version: patch })
    .onConflictDoNothing()

  const modeRows = await tx.select().from(schema.modes)
  const playedBranches = new Set(modeRows.map((m) => m.branch))
  const brModesByBranch = new Map<
    string,
    Array<{ mode: string; field: 'arcadeBr' | 'realisticBr' | 'simulatorBr' }>
  >()
  for (const m of modeRows) {
    const field = modeBrField(m.mode)
    if (!field) {
      warnings.push(
        `mode "${m.mode}" has no BR-field mapping — its vehicle_br rows were not synced`,
      )
      continue
    }
    const group = brModesByBranch.get(m.branch) ?? []
    group.push({ mode: m.mode, field })
    brModesByBranch.set(m.branch, group)
  }

  const nationIdBySlug = await upsertNations(tx)

  // Deterministic processing order makes slug assignment reproducible.
  const sorted = [...snapshot.vehicles].sort((a, b) =>
    a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0,
  )
  // Pagination churn upstream can hand back the same unit twice; a duplicate
  // inside one insert statement aborts the whole transaction.
  const duplicates: Array<string> = []
  const seen = new Set<string>()
  const deduped = sorted.filter((v) => {
    if (seen.has(v.externalId)) {
      duplicates.push(v.externalId)
      return false
    }
    seen.add(v.externalId)
    return true
  })
  if (duplicates.length > 0) {
    warnings.push(
      `${duplicates.length} duplicate externalIds in the snapshot ` +
        `(kept first occurrence): ${duplicates.slice(0, 5).join(', ')}` +
        (duplicates.length > 5 ? ', …' : ''),
    )
  }

  let skippedNoMode = 0
  const mapped: Array<MappedVehicle> = []
  for (const v of deduped) {
    const bc = branchAndClassForType(v.vehicleType)
    if (!bc) {
      warnings.push(
        `unknown vehicle_type "${v.vehicleType}" (${v.externalId}) — skipped`,
      )
      continue
    }
    if (!playedBranches.has(bc.branch)) {
      skippedNoMode++
      continue
    }
    const nation = nationForCountry(v.country)
    if (!nation) {
      warnings.push(
        `unknown country "${v.country}" (${v.externalId}) — skipped`,
      )
      continue
    }
    mapped.push({
      source: v,
      branch: bc.branch,
      class: bc.class,
      nationSlug: nation.slug,
    })
  }

  const existing = await tx
    .select({
      id: schema.vehicles.id,
      externalId: schema.vehicles.externalId,
      slug: schema.vehicles.slug,
      branch: schema.vehicles.branch,
      isRemoved: schema.vehicles.isRemoved,
    })
    .from(schema.vehicles)
  const existingByExternalId = new Map(existing.map((v) => [v.externalId, v]))

  const takenSlugs = new Set(existing.map((v) => v.slug))
  const rows: Array<typeof schema.vehicles.$inferInsert> = []
  for (const { source, branch, class: cls, nationSlug } of mapped) {
    const prior = existingByExternalId.get(source.externalId)
    const slug =
      prior?.slug ??
      assignVehicleSlug(source.name, source.externalId, nationSlug, takenSlugs)
    if (!slug) {
      warnings.push(
        `nothing slugifiable in "${source.name}" (${source.externalId}) — skipped`,
      )
      continue
    }
    takenSlugs.add(slug)
    rows.push({
      externalId: source.externalId,
      name: source.name,
      slug,
      nationId: nationIdBySlug.get(nationSlug)!,
      branch,
      class: cls,
      rank: source.era,
      isPremium: source.isPremium,
      isSquadron: source.isSquadron,
      isEvent: source.event != null,
      isRemoved: false,
      imageUrl: source.imageUrl,
      lastSyncedAt: syncedAt,
    })
  }

  const inserted = rows.filter(
    (r) => !existingByExternalId.has(r.externalId),
  ).length
  const updated = rows.length - inserted
  const restored = rows.filter(
    (r) => existingByExternalId.get(r.externalId)?.isRemoved,
  ).length

  await warnOnBranchFlips(tx, rows, existingByExternalId, warnings)

  const idByExternalId = new Map<string, number>()
  for (const chunk of chunks(rows, CHUNK)) {
    const returned = await tx
      .insert(schema.vehicles)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.vehicles.externalId,
        // slug and isDifficult are deliberately absent: slugs are public URLs,
        // isDifficult is the manual rules overlay.
        set: {
          name: sql`excluded.name`,
          nationId: sql`excluded.nation_id`,
          branch: sql`excluded.branch`,
          class: sql`excluded.class`,
          rank: sql`excluded.rank`,
          isPremium: sql`excluded.is_premium`,
          isSquadron: sql`excluded.is_squadron`,
          isEvent: sql`excluded.is_event`,
          isRemoved: sql`excluded.is_removed`,
          imageUrl: sql`excluded.image_url`,
          lastSyncedAt: sql`excluded.last_synced_at`,
        },
      })
      .returning({
        id: schema.vehicles.id,
        externalId: schema.vehicles.externalId,
      })
    for (const r of returned) idByExternalId.set(r.externalId, r.id)
  }

  // Everything in this snapshot was just stamped with syncedAt, so "absent"
  // is one indexed-free predicate instead of a 3000-parameter NOT IN list.
  const removedRows =
    rows.length === 0
      ? []
      : await tx
          .update(schema.vehicles)
          .set({ isRemoved: true })
          .where(
            and(
              eq(schema.vehicles.isRemoved, false),
              // ISO string, not Date: raw-sql params skip the column's driver
              // mapping and postgres.js only serializes strings there
              sql`${schema.vehicles.lastSyncedAt} is distinct from ${syncedAt.toISOString()}::timestamptz`,
            ),
          )
          .returning({ id: schema.vehicles.id })
  const maxRemoved =
    options.maxRemoved ?? Math.max(25, Math.ceil(existing.length * 0.05))
  if (removedRows.length > maxRemoved) {
    throw new Error(
      `Sync would flag ${removedRows.length} vehicles removed ` +
        `(cap ${maxRemoved}) — mapping drift or a partial snapshot; aborting`,
    )
  }

  let brRowCount = 0
  for (const chunk of chunks(
    buildBrRows(mapped, brModesByBranch, idByExternalId, warnings),
    CHUNK,
  )) {
    brRowCount += chunk.length
    await tx
      .insert(schema.vehicleBr)
      .values(chunk)
      .onConflictDoUpdate({
        target: [schema.vehicleBr.vehicleId, schema.vehicleBr.mode],
        set: { br: sql`excluded.br` },
      })
  }

  // Invariant: a BR row's mode plays the vehicle's branch. Clears stale rows
  // after a vehicle changes branch upstream.
  await tx.execute(sql`
    delete from vehicle_br
    using vehicles v, modes m
    where vehicle_br.vehicle_id = v.id
      and vehicle_br.mode = m.mode
      and m.branch <> v.branch
  `)

  return {
    gameVersion: snapshot.gameVersion,
    patch,
    inserted,
    updated,
    removed: removedRows.length,
    restored,
    skippedNoMode,
    brRows: brRowCount,
    warnings,
  }
}

function buildBrRows(
  mapped: Array<MappedVehicle>,
  brModesByBranch: ReadonlyMap<
    string,
    Array<{ mode: string; field: 'arcadeBr' | 'realisticBr' | 'simulatorBr' }>
  >,
  idByExternalId: ReadonlyMap<string, number>,
  warnings: Array<string>,
): Array<typeof schema.vehicleBr.$inferInsert> {
  const rows: Array<typeof schema.vehicleBr.$inferInsert> = []
  for (const { source, branch } of mapped) {
    const vehicleId = idByExternalId.get(source.externalId)
    if (vehicleId == null) continue // skipped at slug assignment
    for (const { mode, field } of brModesByBranch.get(branch) ?? []) {
      const br = source[field]
      // numeric(3,1): anything non-finite or >= 100 would abort the whole run
      if (!Number.isFinite(br) || br <= 0 || br >= 100) {
        warnings.push(
          `invalid ${field} ${JSON.stringify(br)} (${source.externalId}) — vehicle_br row for ${mode} skipped`,
        )
        continue
      }
      rows.push({ vehicleId, mode, br })
    }
  }
  return rows
}

/** A branch flip strands the vehicle's records outside its modes' stats
    (views join on branch = mode branch) — worth a loud warning. */
async function warnOnBranchFlips(
  tx: Db,
  rows: Array<typeof schema.vehicles.$inferInsert>,
  existingByExternalId: ReadonlyMap<
    string,
    { id: number; branch: string; externalId: string }
  >,
  warnings: Array<string>,
): Promise<void> {
  const flipped = rows.flatMap((r) => {
    const prior = existingByExternalId.get(r.externalId)
    return prior && prior.branch !== r.branch
      ? [{ ...prior, newBranch: r.branch }]
      : []
  })
  if (flipped.length === 0) return
  const counts = await tx
    .select({ vehicleId: schema.records.vehicleId, records: count() })
    .from(schema.records)
    .where(
      inArray(
        schema.records.vehicleId,
        flipped.map((f) => f.id),
      ),
    )
    .groupBy(schema.records.vehicleId)
  const recordsByVehicle = new Map(counts.map((c) => [c.vehicleId, c.records]))
  for (const f of flipped) {
    const n = recordsByVehicle.get(f.id) ?? 0
    warnings.push(
      `branch changed ${f.branch} → ${f.newBranch} for ${f.externalId}` +
        (n > 0
          ? ` which holds ${n} record(s) now outside its mode's stats`
          : ''),
    )
  }
}

async function upsertNations(tx: Db): Promise<Map<string, number>> {
  const returned = await tx
    .insert(schema.nations)
    .values([...CANONICAL_NATIONS])
    .onConflictDoUpdate({
      target: schema.nations.slug,
      // backgroundUrl is a manual overlay — never synced over.
      set: { name: sql`excluded.name`, sort: sql`excluded.sort` },
    })
    .returning({ id: schema.nations.id, slug: schema.nations.slug })
  return new Map(returned.map((n) => [n.slug, n.id]))
}

function* chunks<T>(items: Array<T>, size: number): Generator<Array<T>> {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size)
  }
}
