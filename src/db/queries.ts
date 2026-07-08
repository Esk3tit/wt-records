import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
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
  vehicleSearchTerms,
  vehicles,
} from '#/db/schema'
import { searchKey } from '#/lib/search-terms'
import { BROWSE_PAGE_SIZE, browseFilters } from '#/lib/browse-params'
import type { Acquisition, BrowseFilters } from '#/lib/browse-params'

const isCurrentVerified = and(
  eq(records.isCurrent, true),
  eq(records.status, 'verified'),
)

// The branch guard shared by every counted-record read: a record only counts
// when its mode's branch matches its vehicle's branch.
const modeMatchesBranch = and(
  eq(modes.mode, records.mode),
  eq(modes.branch, vehicles.branch),
)

// Every vehicle-facing read exposes the same tag facet (acquisition chips +
// removed), so no surface can drift to a partial set.
const vehicleTagFlags = {
  isEvent: vehicles.isEvent,
  isPremium: vehicles.isPremium,
  isSquadron: vehicles.isSquadron,
  isRemoved: vehicles.isRemoved,
}

// Runtime counterpart of vehicleTagFlags, for rows reshaped after the read.
function pickVehicleTags(r: {
  isEvent: boolean
  isPremium: boolean
  isSquadron: boolean
  isRemoved: boolean
}) {
  return {
    isEvent: r.isEvent,
    isPremium: r.isPremium,
    isSquadron: r.isSquadron,
    isRemoved: r.isRemoved,
  }
}

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
        remainingVehicles: globalStats.remainingVehicles,
        completionPct: globalStats.completionPct,
      })
      .from(globalStats)
      .where(eq(globalStats.mode, mode))
      .limit(1),
  )
}

// One shared projection + join chain for every landing read, so the
// counted-record definition (current+verified is applied per-use; the branch
// guard lives in the joins) can't drift between sections.
function countedRecordRows(db: Db) {
  return db
    .select({
      id: records.id,
      vehicleId: records.vehicleId,
      kills: records.kills,
      vehicleSlug: vehicles.slug,
      vehicleName: vehicles.name,
      ...vehicleTagFlags,
      nationName: nations.name,
      playerSlug: players.slug,
      displayName: players.displayName,
      ignSnapshot: records.ignSnapshot,
      displayNameSnapshot: records.displayNameSnapshot,
      verifiedAt: records.verifiedAt,
    })
    .from(records)
    .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
    .innerJoin(modes, modeMatchesBranch)
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
    .innerJoin(players, eq(players.id, records.playerId))
}

// UTC-pinned so the window always matches the UTC week label on the page,
// whatever the database session timezone is.
const WEEK_START = sql`date_trunc('week', now() at time zone 'utc') at time zone 'utc'`

export async function getModeLanding(db: Db, mode: string) {
  // The current title holder, joined beside every historical record of the
  // same (vehicle, mode) title so counting and holder lookup are one read.
  const holderRecord = alias(records, 'holder_record')
  const contestCount = sql<number>`count(*)::int`
  const [
    m,
    stats,
    leaders,
    topRecords,
    latestFeed,
    weekTop,
    queueRows,
    contestedTitles,
    nationRows,
    recentCurrent,
    longestStanding,
  ] = await Promise.all([
    getMode(db, mode),
    getModeStats(db, mode),
    getLeaderboard(db, mode, 8),
    countedRecordRows(db)
      .where(and(eq(records.mode, mode), isCurrentVerified))
      // Equal kills: first-to-achieve outranks (nulls first = migrated oldest).
      .orderBy(
        desc(records.kills),
        sql`${records.verifiedAt} asc nulls first`,
        asc(records.id),
      )
      .limit(5),
    // The feed logs entries as they were verified — superseded records were
    // still real entries when they landed, so is_current is not filtered.
    countedRecordRows(db)
      .where(and(eq(records.mode, mode), eq(records.status, 'verified')))
      .orderBy(sql`${records.verifiedAt} desc nulls last`, desc(records.id))
      .limit(8),
    countedRecordRows(db)
      .where(
        and(
          eq(records.mode, mode),
          eq(records.status, 'verified'),
          sql`${records.verifiedAt} >= ${WEEK_START}`,
        ),
      )
      .orderBy(desc(records.kills), asc(records.verifiedAt), asc(records.id))
      .limit(7),
    db
      .select({
        pending: sql<number>`count(*) filter (where ${records.status} = 'pending')::int`,
        verifiedThisWeek: sql<number>`count(*) filter (where ${records.status} = 'verified' and ${records.verifiedAt} >= ${WEEK_START})::int`,
        medianReviewSecs: sql<
          string | null
        >`extract(epoch from percentile_cont(0.5) within group (order by ${records.verifiedAt} - ${records.submittedAt}) filter (where ${records.status} = 'verified' and ${records.verifiedAt} is not null and ${records.submittedAt} is not null))`,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(modes, modeMatchesBranch)
      .where(eq(records.mode, mode)),
    // Contest count = every verified record ever set for the (vehicle, mode)
    // title, self-improvements included; one record is an uncontested holder.
    db
      .select({
        vehicleSlug: vehicles.slug,
        vehicleName: vehicles.name,
        ...vehicleTagFlags,
        nationName: nations.name,
        contests: contestCount,
        kills: holderRecord.kills,
        playerSlug: players.slug,
        displayName: players.displayName,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(modes, modeMatchesBranch)
      .innerJoin(nations, eq(nations.id, vehicles.nationId))
      .innerJoin(
        holderRecord,
        and(
          eq(holderRecord.vehicleId, records.vehicleId),
          eq(holderRecord.mode, records.mode),
          eq(holderRecord.isCurrent, true),
          eq(holderRecord.status, 'verified'),
        ),
      )
      .innerJoin(players, eq(players.id, holderRecord.playerId))
      .where(and(eq(records.mode, mode), eq(records.status, 'verified')))
      .groupBy(vehicles.id, nations.id, holderRecord.id, players.id)
      .having(sql`${contestCount} >= 2`)
      .orderBy(desc(contestCount), asc(vehicles.name), asc(vehicles.slug))
      .limit(5),
    listNations(db, mode),
    countedRecordRows(db)
      .where(
        and(
          eq(records.mode, mode),
          isCurrentVerified,
          sql`${records.verifiedAt} >= now() - interval '30 days'`,
        ),
      )
      .orderBy(desc(records.verifiedAt))
      .limit(8),
    countedRecordRows(db)
      .where(
        and(
          eq(records.mode, mode),
          isCurrentVerified,
          sql`${records.verifiedAt} is not null`,
        ),
      )
      .orderBy(asc(records.verifiedAt), asc(records.id))
      .limit(3),
  ])

  const top = topRecords.length > 0 ? topRecords[0] : null
  const [historySteps, predecessors] = await Promise.all([
    top
      ? db
          .select({
            kills: records.kills,
            verifiedAt: records.verifiedAt,
            displayName: players.displayName,
            playerSlug: players.slug,
          })
          .from(records)
          .innerJoin(players, eq(players.id, records.playerId))
          .where(
            and(
              eq(records.vehicleId, top.vehicleId),
              eq(records.mode, mode),
              eq(records.status, 'verified'),
            ),
          )
          .orderBy(sql`${records.verifiedAt} asc nulls first`, asc(records.id))
      : Promise.resolve([]),
    recentCurrent.length > 0
      ? db
          .selectDistinctOn([records.vehicleId], {
            vehicleId: records.vehicleId,
            kills: records.kills,
            displayName: players.displayName,
            playerSlug: players.slug,
          })
          .from(records)
          .innerJoin(players, eq(players.id, records.playerId))
          .where(
            and(
              inArray(
                records.vehicleId,
                recentCurrent.map((r) => r.vehicleId),
              ),
              eq(records.mode, mode),
              eq(records.status, 'verified'),
              eq(records.isCurrent, false),
            ),
          )
          .orderBy(asc(records.vehicleId), desc(records.kills))
      : Promise.resolve([]),
  ])

  const beatenBySlug = new Map(predecessors.map((p) => [p.vehicleId, p]))
  const fallen = recentCurrent
    .flatMap((r) => {
      const prev = beatenBySlug.get(r.vehicleId)
      if (!prev) return []
      return [
        {
          vehicleSlug: r.vehicleSlug,
          vehicleName: r.vehicleName,
          ...pickVehicleTags(r),
          oldKills: prev.kills,
          oldHolder: prev.displayName,
          oldHolderSlug: prev.playerSlug,
          newKills: r.kills,
          newHolder: r.displayName,
          newHolderSlug: r.playerSlug,
          verifiedAt: r.verifiedAt,
        },
      ]
    })
    .slice(0, 4)

  const queue = one(queueRows)
  return {
    modeName: m ? m.name : null,
    stats,
    leaders,
    topRecords,
    latestFeed,
    weekTop,
    verifyQueue: queue
      ? {
          pending: queue.pending,
          verifiedThisWeek: queue.verifiedThisWeek,
          medianReviewSecs:
            queue.medianReviewSecs == null
              ? null
              : Number(queue.medianReviewSecs),
        }
      : { pending: 0, verifiedThisWeek: 0, medianReviewSecs: null },
    contestedTitles,
    nations: nationRows ?? [],
    // The chart needs a progression; a single point is not a story.
    historySteps: historySteps.length >= 2 ? historySteps : [],
    fallen,
    longestStanding,
  }
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

// One row shape for every catalog surface (nation sheet, Browse): vehicle +
// tags + this mode's BR + Current record or open bounty.
const catalogRowShape = {
  vehicleSlug: vehicles.slug,
  vehicleName: vehicles.name,
  class: vehicles.class,
  rank: vehicles.rank,
  isDifficult: vehicles.isDifficult,
  ...vehicleTagFlags,
  nationSlug: nations.slug,
  nationName: nations.name,
  br: vehicleBr.br,
  kills: records.kills,
  runBr: records.runBr,
  playerSlug: players.slug,
  displayName: players.displayName,
  ignSnapshot: records.ignSnapshot,
  displayNameSnapshot: records.displayNameSnapshot,
}

const ACQ_CONDITIONS: Record<Acquisition, ReturnType<typeof and>> = {
  event: eq(vehicles.isEvent, true),
  premium: eq(vehicles.isPremium, true),
  squadron: eq(vehicles.isSquadron, true),
  removed: eq(vehicles.isRemoved, true),
  // Removed is orthogonal: a removed tech-tree vehicle is still tech-tree.
  'tech-tree': and(
    eq(vehicles.isEvent, false),
    eq(vehicles.isPremium, false),
    eq(vehicles.isSquadron, false),
  ),
}

function catalogConditions(
  branch: Branch,
  filters: BrowseFilters,
  nationId: number | null,
) {
  const conds = [eq(vehicles.branch, branch)]
  if (nationId != null) {
    conds.push(eq(vehicles.nationId, nationId))
  } else if (filters.nations.length > 0) {
    conds.push(inArray(nations.slug, filters.nations))
  }
  if (filters.classes.length > 0)
    conds.push(inArray(vehicles.class, filters.classes))
  if (filters.ranks.length > 0)
    conds.push(inArray(vehicles.rank, filters.ranks))
  if (filters.br)
    conds.push(
      sql`${vehicleBr.br} between ${filters.br.min} and ${filters.br.max}`,
    )
  if (filters.acq.length > 0)
    conds.push(or(...filters.acq.map((a) => ACQ_CONDITIONS[a]))!)
  if (filters.status === 'held') conds.push(sql`${records.id} is not null`)
  if (filters.status === 'open') conds.push(sql`${records.id} is null`)
  if (filters.q) {
    const key = searchKey(filters.q)
    conds.push(
      key
        ? sql`exists (select 1 from ${vehicleSearchTerms} where ${vehicleSearchTerms.vehicleId} = ${vehicles.id} and ${termMatch(key)})`
        : sql`false`,
    )
  }
  return and(...conds)
}

function catalogOrder(filters: BrowseFilters) {
  const named = filters.dir === 'desc' ? desc : asc
  switch (filters.sort) {
    case 'name':
      return [named(vehicles.name)]
    case 'br':
      return [
        filters.dir === 'desc'
          ? sql`${vehicleBr.br} desc nulls last`
          : sql`${vehicleBr.br} asc nulls last`,
        asc(vehicles.name),
      ]
    case 'kills':
      return [
        filters.dir === 'desc'
          ? sql`${records.kills} desc nulls last`
          : sql`${records.kills} asc nulls last`,
        asc(vehicles.name),
      ]
    default: {
      const key = filters.q ? searchKey(filters.q) : ''
      if (!key) return [asc(vehicles.name)]
      const pos = sql`(select min(position(${key} in t.term)) from ${vehicleSearchTerms} t where t.vehicle_id = ${vehicles.id} and position(${key} in t.term) > 0)`
      const len = sql`(select min(length(t.term)) from ${vehicleSearchTerms} t where t.vehicle_id = ${vehicles.id} and position(${key} in t.term) > 0)`
      return [sql`${pos} is null`, pos, len, asc(vehicles.name)]
    }
  }
}

/** Filter-control options for a mode: only values that exist in its catalog,
 * so the UI never offers a dead filter. */
export async function browseFacets(db: Db, mode: string) {
  const m = await getMode(db, mode)
  if (!m) return null
  const [nationRows, brRows, rankRows, classRows] = await Promise.all([
    db
      .selectDistinct({
        slug: nations.slug,
        name: nations.name,
        sort: nations.sort,
      })
      .from(nations)
      .innerJoin(vehicles, eq(vehicles.nationId, nations.id))
      .where(eq(vehicles.branch, m.branch))
      .orderBy(asc(nations.sort)),
    db
      .selectDistinct({ br: vehicleBr.br })
      .from(vehicleBr)
      .where(eq(vehicleBr.mode, mode))
      .orderBy(asc(vehicleBr.br)),
    db
      .selectDistinct({ rank: vehicles.rank })
      .from(vehicles)
      .where(and(eq(vehicles.branch, m.branch), isNotNull(vehicles.rank)))
      .orderBy(asc(vehicles.rank)),
    db
      .selectDistinct({ class: vehicles.class })
      .from(vehicles)
      .where(eq(vehicles.branch, m.branch))
      .orderBy(asc(vehicles.class)),
  ])
  return {
    nations: nationRows.map((n) => ({ slug: n.slug, name: n.name })),
    brSteps: brRows.map((r) => r.br),
    ranks: rankRows.map((r) => r.rank!),
    classes: classRows.map((r) => r.class),
  }
}

/** The Browse page query: the mode's whole eligibility denominator, filtered
 * and paginated. A page past the end clamps to the last page. */
export async function browseVehicles(
  db: Db,
  mode: string,
  filters: BrowseFilters,
) {
  const m = await getMode(db, mode)
  if (!m) return null
  const conds = catalogConditions(m.branch, filters, null)

  const [{ total }] = await db
    .select({ total: count() })
    .from(vehicles)
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
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
    .where(conds)
  const pageCount = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE))
  const page = Math.min(Math.max(1, filters.page), pageCount)

  const rows = await db
    .select(catalogRowShape)
    .from(vehicles)
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
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
    .where(conds)
    .orderBy(...catalogOrder(filters))
    .limit(BROWSE_PAGE_SIZE)
    .offset((page - 1) * BROWSE_PAGE_SIZE)

  return { rows, total, page, pageCount }
}

export async function getNationSheet(
  db: Db,
  mode: string,
  slug: string,
  filters: BrowseFilters = browseFilters({}),
) {
  // The nation (by slug) and mode lookups are independent — run together.
  const [nationRows, m] = await Promise.all([
    db.select().from(nations).where(eq(nations.slug, slug)).limit(1),
    getMode(db, mode),
  ])
  const nation = one(nationRows)
  if (!nation) return null
  if (!m) return null

  const rows = await db
    .select(catalogRowShape)
    .from(vehicles)
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
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
    .where(catalogConditions(m.branch, filters, nation.id))
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
        ...vehicleTagFlags,
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
        ...vehicleTagFlags,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      // Same counted-record definition as the stats views: live mode + branch
      // match, so an off-branch record (invalid data) never renders here either.
      .innerJoin(modes, and(modeMatchesBranch, eq(modes.isLive, true)))
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

// word_similarity, not similarity: the query key is much shorter than a
// collapsed term, and plain similarity punishes the length difference so
// hard that one-typo queries ("tigre") fall below any usable floor.
const SIMILARITY_FLOOR = 0.3
// Below this, single-trigram extents let any term sharing a first letter
// clear the floor ("m4" matches every m-vehicle), so short keys stay exact.
const MIN_FUZZY_KEY_LENGTH = 4

// The one term-match rule shared by every search surface: exact substring,
// plus the typo tier for keys long enough that trigrams discriminate.
function termMatch(key: string) {
  const isExact = sql`position(${key} in ${vehicleSearchTerms.term}) > 0`
  return key.length >= MIN_FUZZY_KEY_LENGTH
    ? or(
        isExact,
        sql`word_similarity(${key}, ${vehicleSearchTerms.term}) > ${SIMILARITY_FLOOR}`,
      )
    : isExact
}

type Branch = (typeof vehicles.branch.enumValues)[number]

/** Two-tier vehicle matcher over precomputed search terms:
 * exact-substring hits rank first (match position, then term length, then
 * name), pg_trgm word-similarity catches typos below them. With `scope`,
 * results are limited to one branch and carry that mode's BR. */
export function searchVehicles(
  db: Db,
  q: string,
  limit: number,
  scope?: { branch: Branch; mode: string },
) {
  const key = searchKey(q)
  if (!key) return Promise.resolve([])
  const isExact = sql`position(${key} in ${vehicleSearchTerms.term}) > 0`
  const bestPos = sql<number>`min(case when ${isExact} then position(${key} in ${vehicleSearchTerms.term}) end)`
  const bestLen = sql<number>`min(case when ${isExact} then length(${vehicleSearchTerms.term}) end)`
  const bestSim = sql<number>`max(word_similarity(${key}, ${vehicleSearchTerms.term}))`
  return db
    .select({
      slug: vehicles.slug,
      name: vehicles.name,
      branch: vehicles.branch,
      nation: nations.name,
      br: vehicleBr.br,
      ...vehicleTagFlags,
    })
    .from(vehicles)
    .innerJoin(
      vehicleSearchTerms,
      eq(vehicleSearchTerms.vehicleId, vehicles.id),
    )
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
    .leftJoin(
      vehicleBr,
      and(
        eq(vehicleBr.vehicleId, vehicles.id),
        eq(vehicleBr.mode, scope?.mode ?? ''),
      ),
    )
    .where(
      scope
        ? and(termMatch(key), eq(vehicles.branch, scope.branch))
        : termMatch(key),
    )
    .groupBy(vehicles.id, nations.id, vehicleBr.br)
    .orderBy(
      sql`${bestPos} is null`,
      bestPos,
      bestLen,
      desc(bestSim),
      asc(vehicles.name),
    )
    .limit(limit)
}

/** Hero Lookup suggestions: the mode's branch only, with that mode's BR. */
export async function lookupVehicles(db: Db, mode: string, q: string) {
  const m = await getMode(db, mode)
  if (!m) return []
  return searchVehicles(db, q, 8, { branch: m.branch, mode })
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
    searchVehicles(db, term, 10),
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
        nation: v.nation,
        ...pickVehicleTags(v),
        linkMode: pref && liveModes.has(pref) ? pref : null,
      }
    }),
  }
}
