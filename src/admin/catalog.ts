import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { modeMinKills, modes, nations, patches, vehicles } from '#/db/schema'
import type { VehicleClass } from '#/lib/vehicle-classes'
import { writeAudit } from '#/admin/audit'

/* The vehicle editor exposes ONLY isDifficult — catalog sync owns everything
   else (ADR 0004). Rules edits never recompute existing records. */

export async function setVehicleDifficult(
  db: Db,
  actorId: string,
  vehicleId: number,
  isDifficult: boolean,
) {
  return db.transaction(async (tx) => {
    const [vehicle] = await tx
      .select({ id: vehicles.id, isDifficult: vehicles.isDifficult })
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
    if (!vehicle) throw new Error(`Unknown vehicle ${vehicleId}`)
    if (vehicle.isDifficult === isDifficult) return { changed: false }
    await tx
      .update(vehicles)
      .set({ isDifficult })
      .where(eq(vehicles.id, vehicleId))
    await writeAudit(tx, {
      actorId,
      action: 'vehicle.set_difficult',
      entity: 'vehicle',
      entityId: vehicleId,
      diff: {
        before: { isDifficult: vehicle.isDifficult },
        after: { isDifficult },
      },
    })
    return { changed: true }
  })
}

export async function updateModeMinKills(
  db: Db,
  actorId: string,
  mode: string,
  entries: { class: VehicleClass; minKills: number }[],
) {
  for (const e of entries) {
    if (!Number.isInteger(e.minKills) || e.minKills <= 0) {
      throw new Error('Min kills must be a positive integer')
    }
  }
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ class: modeMinKills.class, minKills: modeMinKills.minKills })
      .from(modeMinKills)
      .where(eq(modeMinKills.mode, mode))
    const current = new Map(existing.map((r) => [r.class, r.minKills]))

    const before: Record<string, number | null> = {}
    const after: Record<string, number> = {}
    for (const e of entries) {
      const prev = current.get(e.class)
      if (prev === e.minKills) continue
      before[e.class] = prev ?? null
      after[e.class] = e.minKills
      if (prev == null) {
        await tx
          .insert(modeMinKills)
          .values({ mode, class: e.class, minKills: e.minKills })
      } else {
        await tx
          .update(modeMinKills)
          .set({ minKills: e.minKills })
          .where(
            and(eq(modeMinKills.mode, mode), eq(modeMinKills.class, e.class)),
          )
      }
    }
    if (Object.keys(after).length === 0) return { changed: false }
    await writeAudit(tx, {
      actorId,
      action: 'rules.update_min_kills',
      entity: 'rules',
      entityId: mode,
      diff: { before, after },
    })
    return { changed: true }
  })
}

export async function updateDifficultMinKills(
  db: Db,
  actorId: string,
  mode: string,
  value: number | null,
) {
  if (value != null && (!Number.isInteger(value) || value <= 0)) {
    throw new Error('Difficult min kills must be a positive integer or unset')
  }
  return db.transaction(async (tx) => {
    const [m] = await tx
      .select({ difficultMinKills: modes.difficultMinKills })
      .from(modes)
      .where(eq(modes.mode, mode))
    if (!m) throw new Error(`Unknown mode ${mode}`)
    if (m.difficultMinKills === value) return { changed: false }
    await tx
      .update(modes)
      .set({ difficultMinKills: value })
      .where(eq(modes.mode, mode))
    await writeAudit(tx, {
      actorId,
      action: 'rules.update_difficult_min_kills',
      entity: 'rules',
      entityId: mode,
      diff: {
        before: { [mode]: m.difficultMinKills },
        after: { [mode]: value },
      },
    })
    return { changed: true }
  })
}

export async function listRulesConfig(db: Db) {
  const [allModes, allThresholds] = await Promise.all([
    db.select().from(modes).orderBy(asc(modes.sort)),
    db.select().from(modeMinKills).orderBy(asc(modeMinKills.class)),
  ])
  return allModes.map((m) => ({
    mode: m.mode,
    name: m.name,
    isLive: m.isLive,
    difficultMinKills: m.difficultMinKills,
    thresholds: allThresholds.filter((t) => t.mode === m.mode),
  }))
}

/* ── Patches ─────────────────────────────────────────────────── */

export async function addPatch(
  db: Db,
  actorId: string,
  input: { version: string; name?: string | null; releasedAt?: Date | null },
) {
  const version = input.version.trim()
  if (!version) throw new Error('A patch version is required')
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ version: patches.version })
      .from(patches)
      .where(eq(patches.version, version))
    if (existing.length > 0) throw new Error(`Patch ${version} already exists`)
    await tx.insert(patches).values({
      version,
      name: input.name?.trim() || null,
      releasedAt: input.releasedAt ?? null,
    })
    await writeAudit(tx, {
      actorId,
      action: 'patch.create',
      entity: 'patch',
      entityId: version,
      diff: {
        after: {
          version,
          name: input.name?.trim() || null,
          releasedAt: input.releasedAt?.toISOString() ?? null,
        },
      },
    })
    return { version }
  })
}

/** Newest-first for the entry form's dropdown — its first option is the
    default, so "defaults to latest" falls out of the ordering. */
export function listPatchOptions(db: Db) {
  return db
    .select()
    .from(patches)
    .orderBy(sql`${patches.releasedAt} desc nulls last`, desc(patches.version))
}

/* ── Vehicle list for the catalog editor ─────────────────────── */

export async function listAdminVehicles(
  db: Db,
  opts: {
    q?: string
    difficultOnly?: boolean
    limit?: number
    offset?: number
  },
) {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const conds = []
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim().replace(/[\\%_]/g, '\\$&')}%`
    conds.push(ilike(vehicles.name, like))
  }
  if (opts.difficultOnly) conds.push(eq(vehicles.isDifficult, true))
  const rows = await db
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      name: vehicles.name,
      branch: vehicles.branch,
      class: vehicles.class,
      rank: vehicles.rank,
      isDifficult: vehicles.isDifficult,
      isRemoved: vehicles.isRemoved,
      nation: nations.name,
    })
    .from(vehicles)
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(vehicles.name))
    .limit(limit + 1)
    .offset(offset)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}
