import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import {
  modeMinKills,
  modes,
  nations,
  playerAliases,
  players,
  recordProof,
  records,
  vehicleBr,
  vehicles,
} from '#/db/schema'

const isCurrentVerified = and(eq(records.isCurrent, true), eq(records.status, 'verified'))
const notRemoved = eq(vehicles.isRemoved, false)

// The schema runs without noUncheckedIndexedAccess, so a destructured first row
// is typed as always-present; this makes "row might be missing" explicit.
function one<T>(rows: T[]): T | null {
  return rows.length > 0 ? rows[0] : null
}

export function listModes(db: Db) {
  return db.select().from(modes).orderBy(asc(modes.sort))
}

export async function getMode(db: Db, mode: string) {
  return one(await db.select().from(modes).where(eq(modes.mode, mode)).limit(1))
}

export function getLeaderboard(db: Db, mode: string, limit?: number) {
  const q = db
    .select({
      slug: players.slug,
      displayName: players.displayName,
      records: sql<number>`count(*)::int`,
    })
    .from(records)
    .innerJoin(players, eq(players.id, records.playerId))
    .innerJoin(vehicles, and(eq(vehicles.id, records.vehicleId), notRemoved))
    .where(and(eq(records.mode, mode), isCurrentVerified))
    .groupBy(players.id, players.slug, players.displayName)
    .orderBy(desc(sql`count(*)`), asc(players.displayName))
  return limit == null ? q : q.limit(limit)
}

export async function getModeStats(db: Db, mode: string) {
  const m = await getMode(db, mode)
  if (!m) return null
  const current = and(eq(records.mode, mode), isCurrentVerified)

  const [totals] = await db
    .select({
      records: sql<number>`count(*)::int`,
      holders: sql<number>`count(distinct ${records.playerId})::int`,
      coveredVehicles: sql<number>`count(distinct ${records.vehicleId})::int`,
    })
    .from(records)
    .innerJoin(vehicles, and(eq(vehicles.id, records.vehicleId), notRemoved))
    .where(current)

  const [{ eligibleVehicles }] = await db
    .select({ eligibleVehicles: sql<number>`count(*)::int` })
    .from(vehicles)
    .where(and(eq(vehicles.branch, m.branch), notRemoved))

  return { ...totals, eligibleVehicles }
}

export async function getModeHome(db: Db, mode: string) {
  const [stats, leaders, latestRows] = await Promise.all([
    getModeStats(db, mode),
    getLeaderboard(db, mode, 5),
    db
      .select({
        kills: records.kills,
        vehicleSlug: vehicles.slug,
        vehicleName: vehicles.name,
        playerSlug: players.slug,
        displayName: players.displayName,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(vehicles, and(eq(vehicles.id, records.vehicleId), notRemoved))
      .innerJoin(players, eq(players.id, records.playerId))
      .where(and(eq(records.mode, mode), isCurrentVerified))
      // verified_at is nullable (migrated rows have none); DESC alone sorts
      // NULLS FIRST, which would rank those stale rows as "latest".
      .orderBy(sql`${records.verifiedAt} desc nulls last`, desc(records.id))
      .limit(1),
  ])
  return { stats, leaders, latest: one(latestRows) }
}

export async function listNations(db: Db, mode: string) {
  const m = await getMode(db, mode)
  if (!m) return null
  return db
    .select({
      slug: nations.slug,
      name: nations.name,
      eligibleVehicles: sql<number>`count(distinct ${vehicles.id})::int`,
      coveredVehicles: sql<number>`count(distinct ${records.vehicleId})::int`,
    })
    .from(nations)
    .leftJoin(
      vehicles,
      and(eq(vehicles.nationId, nations.id), eq(vehicles.branch, m.branch), notRemoved),
    )
    .leftJoin(
      records,
      and(eq(records.vehicleId, vehicles.id), eq(records.mode, mode), isCurrentVerified),
    )
    .groupBy(nations.id, nations.slug, nations.name, nations.sort)
    .orderBy(asc(nations.sort))
}

export async function getNationSheet(db: Db, mode: string, slug: string) {
  const nation = one(
    await db.select().from(nations).where(eq(nations.slug, slug)).limit(1),
  )
  if (!nation) return null
  const m = await getMode(db, mode)
  if (!m) return null

  const rows = await db
    .select({
      vehicleSlug: vehicles.slug,
      vehicleName: vehicles.name,
      class: vehicles.class,
      rank: vehicles.rank,
      isDifficult: vehicles.isDifficult,
      br: vehicleBr.br,
      kills: records.kills,
      runBr: records.runBr,
      playerSlug: players.slug,
      displayName: players.displayName,
      ignSnapshot: records.ignSnapshot,
      displayNameSnapshot: records.displayNameSnapshot,
    })
    .from(vehicles)
    .leftJoin(vehicleBr, and(eq(vehicleBr.vehicleId, vehicles.id), eq(vehicleBr.mode, mode)))
    .leftJoin(
      records,
      and(eq(records.vehicleId, vehicles.id), eq(records.mode, mode), isCurrentVerified),
    )
    .leftJoin(players, eq(players.id, records.playerId))
    .where(and(eq(vehicles.nationId, nation.id), eq(vehicles.branch, m.branch), notRemoved))
    .orderBy(asc(vehicles.rank), asc(vehicles.name))

  return { nation, rows }
}

export async function getVehicle(db: Db, mode: string, slug: string) {
  const m = await getMode(db, mode)
  if (!m) return null

  // Vehicle pages are mode-scoped: a vehicle is only in-scope for a mode whose
  // branch it belongs to, and never once removed.
  const vehicle = one(
    await db
      .select({
        id: vehicles.id,
        name: vehicles.name,
        slug: vehicles.slug,
        class: vehicles.class,
        rank: vehicles.rank,
        isDifficult: vehicles.isDifficult,
        nationSlug: nations.slug,
        nationName: nations.name,
      })
      .from(vehicles)
      .innerJoin(nations, eq(nations.id, vehicles.nationId))
      .where(and(eq(vehicles.slug, slug), eq(vehicles.branch, m.branch), notRemoved))
      .limit(1),
  )
  if (!vehicle) return null

  const brRow = one(
    await db
      .select({ br: vehicleBr.br })
      .from(vehicleBr)
      .where(and(eq(vehicleBr.vehicleId, vehicle.id), eq(vehicleBr.mode, mode)))
      .limit(1),
  )

  const current = one(
    await db
      .select({
        recordId: records.id,
        kills: records.kills,
        runBr: records.runBr,
        patch: records.patch,
        playerSlug: players.slug,
        displayName: players.displayName,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(players, eq(players.id, records.playerId))
      .where(and(eq(records.vehicleId, vehicle.id), eq(records.mode, mode), isCurrentVerified))
      .limit(1),
  )

  const proofs = current
    ? await db
        .select()
        .from(recordProof)
        .where(eq(recordProof.recordId, current.recordId))
        .orderBy(asc(recordProof.sort))
    : []

  return { vehicle, br: brRow ? brRow.br : null, current, proofs }
}

export async function getPlayer(db: Db, slug: string) {
  const player = one(
    await db.select().from(players).where(eq(players.slug, slug)).limit(1),
  )
  if (!player) return null

  const aliases = await db
    .select({ name: playerAliases.name })
    .from(playerAliases)
    .where(eq(playerAliases.playerId, player.id))
    .orderBy(asc(playerAliases.firstSeen))

  // Only surface records for live modes and non-removed vehicles, matching the
  // coming-soon gate and removed-vehicle exclusion applied elsewhere.
  const recs = await db
    .select({
      mode: records.mode,
      kills: records.kills,
      vehicleSlug: vehicles.slug,
      vehicleName: vehicles.name,
      ignSnapshot: records.ignSnapshot,
      displayNameSnapshot: records.displayNameSnapshot,
    })
    .from(records)
    .innerJoin(vehicles, and(eq(vehicles.id, records.vehicleId), notRemoved))
    .innerJoin(modes, and(eq(modes.mode, records.mode), eq(modes.isLive, true)))
    .where(and(eq(records.playerId, player.id), isCurrentVerified))
    .orderBy(asc(records.mode), desc(records.kills))

  return { player, aliases: aliases.map((a) => a.name), records: recs }
}

export async function getRules(db: Db, mode: string) {
  const m = await getMode(db, mode)
  if (!m) return null
  // /rules/$mode sits outside the /$mode gate, so honour coming-soon here too:
  // don't fetch or expose thresholds for a non-live mode.
  if (!m.isLive) return { mode: m, thresholds: [] }
  const thresholds = await db
    .select()
    .from(modeMinKills)
    .where(eq(modeMinKills.mode, mode))
    .orderBy(asc(modeMinKills.class))
  return { mode: m, thresholds }
}

export async function search(db: Db, q: string) {
  const term = q.trim()
  if (!term) return { players: [], vehicles: [] }
  // Escape LIKE metacharacters so '_' / '%' in gamertags match literally.
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`
  const [foundPlayers, foundVehicles] = await Promise.all([
    db
      .select({ slug: players.slug, displayName: players.displayName })
      .from(players)
      .where(ilike(players.displayName, like))
      .orderBy(asc(players.displayName))
      .limit(10),
    db
      .select({ slug: vehicles.slug, name: vehicles.name, branch: vehicles.branch })
      .from(vehicles)
      .where(and(ilike(vehicles.name, like), notRemoved))
      .orderBy(asc(vehicles.name))
      .limit(10),
  ])
  return { players: foundPlayers, vehicles: foundVehicles }
}
