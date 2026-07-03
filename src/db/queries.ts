import { and, asc, desc, eq, ilike } from 'drizzle-orm'
import type { Db } from '#/db'
import {
  globalStats,
  leaderboard,
  modeMinKills,
  modes,
  nationStats,
  nations,
  playerAliases,
  players,
  recordProof,
  records,
  vehicleBr,
  vehicles,
} from '#/db/schema'

const isCurrentVerified = and(
  eq(records.isCurrent, true),
  eq(records.status, 'verified'),
)

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
      slug: leaderboard.slug,
      displayName: leaderboard.displayName,
      records: leaderboard.records,
    })
    .from(leaderboard)
    .where(eq(leaderboard.mode, mode))
    .orderBy(desc(leaderboard.records), asc(leaderboard.displayName))
  return limit == null ? q : q.limit(limit)
}

export async function getModeStats(db: Db, mode: string) {
  // global_stats has one row per mode; no row = unknown mode.
  return one(
    await db
      .select({
        records: globalStats.records,
        holders: globalStats.holders,
        coveredVehicles: globalStats.coveredVehicles,
        eligibleVehicles: globalStats.eligibleVehicles,
        completionPct: globalStats.completionPct,
      })
      .from(globalStats)
      .where(eq(globalStats.mode, mode))
      .limit(1),
  )
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
        isRemoved: vehicles.isRemoved,
        playerSlug: players.slug,
        displayName: players.displayName,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(players, eq(players.id, records.playerId))
      // global_stats owns the "latest" ordering (verified_at nulls last, id).
      .where(
        eq(
          records.id,
          db
            .select({ id: globalStats.latestRecordId })
            .from(globalStats)
            .where(eq(globalStats.mode, mode)),
        ),
      ),
  ])
  return { stats, leaders, latest: one(latestRows) }
}

export async function listNations(db: Db, mode: string) {
  // The mode existence check and the stats read are independent — run together.
  const [m, rows] = await Promise.all([
    getMode(db, mode),
    db
      .select({
        slug: nationStats.slug,
        name: nationStats.name,
        eligibleVehicles: nationStats.eligibleVehicles,
        coveredVehicles: nationStats.coveredVehicles,
        completionPct: nationStats.completionPct,
      })
      .from(nationStats)
      .where(eq(nationStats.mode, mode))
      .orderBy(asc(nationStats.sort)),
  ])
  return m ? rows : null
}

export async function getNationSheet(db: Db, mode: string, slug: string) {
  // The nation (by slug) and mode lookups are independent — run together.
  const [nationRows, m] = await Promise.all([
    db.select().from(nations).where(eq(nations.slug, slug)).limit(1),
    getMode(db, mode),
  ])
  const nation = one(nationRows)
  if (!nation) return null
  if (!m) return null

  const rows = await db
    .select({
      vehicleSlug: vehicles.slug,
      vehicleName: vehicles.name,
      class: vehicles.class,
      rank: vehicles.rank,
      isDifficult: vehicles.isDifficult,
      isRemoved: vehicles.isRemoved,
      br: vehicleBr.br,
      kills: records.kills,
      runBr: records.runBr,
      playerSlug: players.slug,
      displayName: players.displayName,
      ignSnapshot: records.ignSnapshot,
      displayNameSnapshot: records.displayNameSnapshot,
    })
    .from(vehicles)
    .leftJoin(
      vehicleBr,
      and(eq(vehicleBr.vehicleId, vehicles.id), eq(vehicleBr.mode, mode)),
    )
    .leftJoin(
      records,
      and(
        eq(records.vehicleId, vehicles.id),
        eq(records.mode, mode),
        isCurrentVerified,
      ),
    )
    .leftJoin(players, eq(players.id, records.playerId))
    .where(and(eq(vehicles.nationId, nation.id), eq(vehicles.branch, m.branch)))
    .orderBy(asc(vehicles.rank), asc(vehicles.name))

  return { nation, rows }
}

export async function getVehicle(db: Db, mode: string, slug: string) {
  const m = await getMode(db, mode)
  if (!m) return null

  // Vehicle pages are mode-scoped: a vehicle is only in-scope for a mode whose
  // branch it belongs to. Removed vehicles still render (with an indicator).
  const vehicle = one(
    await db
      .select({
        id: vehicles.id,
        name: vehicles.name,
        slug: vehicles.slug,
        class: vehicles.class,
        rank: vehicles.rank,
        isDifficult: vehicles.isDifficult,
        isRemoved: vehicles.isRemoved,
        nationSlug: nations.slug,
        nationName: nations.name,
      })
      .from(vehicles)
      .innerJoin(nations, eq(nations.id, vehicles.nationId))
      .where(and(eq(vehicles.slug, slug), eq(vehicles.branch, m.branch)))
      .limit(1),
  )
  if (!vehicle) return null

  // BR and current record both depend only on vehicle.id + mode — run together.
  const [brRows, currentRows] = await Promise.all([
    db
      .select({ br: vehicleBr.br })
      .from(vehicleBr)
      .where(and(eq(vehicleBr.vehicleId, vehicle.id), eq(vehicleBr.mode, mode)))
      .limit(1),
    db
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
      .where(
        and(
          eq(records.vehicleId, vehicle.id),
          eq(records.mode, mode),
          isCurrentVerified,
        ),
      )
      .limit(1),
  ])
  const brRow = one(brRows)
  const current = one(currentRows)

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

  // Aliases and records both depend only on player.id — run together.
  // Records in non-live modes stay hidden (coming-soon gate); removed vehicles
  // still show, flagged with isRemoved.
  const [aliases, recs] = await Promise.all([
    db
      .select({ name: playerAliases.name })
      .from(playerAliases)
      .where(eq(playerAliases.playerId, player.id))
      .orderBy(asc(playerAliases.firstSeen)),
    db
      .select({
        mode: records.mode,
        kills: records.kills,
        vehicleSlug: vehicles.slug,
        vehicleName: vehicles.name,
        isRemoved: vehicles.isRemoved,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(
        modes,
        and(eq(modes.mode, records.mode), eq(modes.isLive, true)),
      )
      .where(and(eq(records.playerId, player.id), isCurrentVerified))
      .orderBy(asc(records.mode), desc(records.kills)),
  ])

  return { player, aliases: aliases.map((a) => a.name), records: recs }
}

export async function getRules(db: Db, mode: string) {
  const m = await getMode(db, mode)
  if (!m) return null
  // /rules/$mode sits outside the /$mode gate. For a non-live mode expose only
  // what ComingSoon needs — never the staged rules content or thresholds.
  const base = { mode: m.mode, name: m.name, isLive: m.isLive }
  if (!m.isLive) {
    return {
      mode: { ...base, rulesMd: null, difficultMinKills: null },
      thresholds: [],
    }
  }
  const thresholds = await db
    .select()
    .from(modeMinKills)
    .where(eq(modeMinKills.mode, mode))
    .orderBy(asc(modeMinKills.class))
  return {
    mode: {
      ...base,
      rulesMd: m.rulesMd,
      difficultMinKills: m.difficultMinKills,
    },
    thresholds,
  }
}

// A branch's realistic-battles mode. A search result only links here when that
// mode is live — naval has none, and air stays unlinked until ARB launches, so
// results never lead to a coming-soon placeholder.
const BRANCH_MODE: Record<'ground' | 'air' | 'naval', string | undefined> = {
  ground: 'grb',
  air: 'arb',
  naval: undefined,
}

export async function search(db: Db, q: string) {
  const term = q.trim()
  if (!term) return { players: [], vehicles: [] }
  // Escape LIKE metacharacters so '_' / '%' in gamertags match literally.
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`
  const [foundPlayers, foundVehicles, liveRows] = await Promise.all([
    db
      .select({ slug: players.slug, displayName: players.displayName })
      .from(players)
      .where(ilike(players.displayName, like))
      .orderBy(asc(players.displayName))
      .limit(10),
    db
      .select({
        slug: vehicles.slug,
        name: vehicles.name,
        branch: vehicles.branch,
        isRemoved: vehicles.isRemoved,
      })
      .from(vehicles)
      .where(ilike(vehicles.name, like))
      .orderBy(asc(vehicles.name))
      .limit(10),
    db.select({ mode: modes.mode }).from(modes).where(eq(modes.isLive, true)),
  ])
  const liveModes = new Set(liveRows.map((r) => r.mode))
  return {
    players: foundPlayers,
    vehicles: foundVehicles.map((v) => {
      const pref = BRANCH_MODE[v.branch]
      return {
        slug: v.slug,
        name: v.name,
        isRemoved: v.isRemoved,
        linkMode: pref && liveModes.has(pref) ? pref : null,
      }
    }),
  }
}
