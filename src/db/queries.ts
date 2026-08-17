import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '#/db'
import { one } from '#/db/rows'
import {
  globalStats,
  leaderboard,
  modeMinKills,
  modes,
  nationStats,
  nations,
  patches,
  playerAliases,
  playerLinks,
  players,
  recordProof,
  records,
  vehicleBr,
  vehicleSearchTerms,
  vehicles,
} from '#/db/schema'
import type { AmendmentViewer } from '#/claims/amendments'
import { titleFrontier } from '#/lib/rules'
import { rankNations } from '#/lib/standings'
import { searchKey } from '#/lib/search-terms'
import { likeContains } from '#/lib/like'
import { assetUrlIfConfigured, proofUrlIfConfigured } from '#/storage/urls'
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

// The same guard for the player-facing reads, which also hide the modes that
// haven't opened yet (the coming-soon gate).
const liveModeMatchesBranch = and(modeMatchesBranch, eq(modes.isLive, true))

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
      portraitKey: vehicles.portraitKey,
      nationName: nations.name,
      nationSlug: nations.slug,
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

// Null renders the Medallion — a first-class state for an accountless holder,
// not a gap.
function withHolderAvatar<
  T extends { holderUserId: string | null; holderAvatarKey: string | null },
>(
  { holderUserId, holderAvatarKey, ...row }: T,
  viewer?: AmendmentViewer | null,
) {
  const key = effectiveAvatarKey(
    { userId: holderUserId, avatarKey: holderAvatarKey },
    viewer,
  )
  return { ...row, holderAvatar: key ? assetUrlIfConfigured(key) : null }
}

// Serving URL beside the row (computed server-side: env stays off the client);
// the raw key never ships.
function withVehiclePortrait<T extends { portraitKey: string | null }>({
  portraitKey,
  ...row
}: T): Omit<T, 'portraitKey'> & { vehiclePortrait: string | null } {
  return {
    ...row,
    vehiclePortrait: portraitKey ? assetUrlIfConfigured(portraitKey) : null,
  }
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
        portraitKey: vehicles.portraitKey,
        nationName: nations.name,
        nationSlug: nations.slug,
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
    .map(withVehiclePortrait)
    .flatMap((r) => {
      const prev = beatenBySlug.get(r.vehicleId)
      if (!prev) return []
      return [
        {
          vehicleSlug: r.vehicleSlug,
          vehicleName: r.vehicleName,
          nationSlug: r.nationSlug,
          vehiclePortrait: r.vehiclePortrait,
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
    topRecords: topRecords.map(withVehiclePortrait),
    latestFeed: latestFeed.map(withVehiclePortrait),
    weekTop: weekTop.map(withVehiclePortrait),
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
    contestedTitles: contestedTitles.map(withVehiclePortrait),
    nations: nationRows ?? [],
    // The chart needs a progression; a single point is not a story.
    historySteps: (() => {
      const frontier = titleFrontier(historySteps)
      return frontier.length >= 2 ? frontier : []
    })(),
    fallen,
    longestStanding: longestStanding.map(withVehiclePortrait),
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

export interface NationStanding {
  slug: string
  name: string
  eligibleVehicles: number
  coveredVehicles: number
  completionPct: number
  openBounties: number
  rank: number | null
  holder: { name: string; slug: string; titles: number } | null
}

/** A Mode's nation standings, plus each nation's most-titles Holder, which
    nation_stats doesn't carry. Null when the Mode doesn't exist (→ 404). */
export async function listNationStandings(
  db: Db,
  mode: string,
): Promise<{ contested: boolean; nations: NationStanding[] } | null> {
  const [m, rows, holders] = await Promise.all([
    getMode(db, mode),
    db
      .select({
        nationId: nationStats.nationId,
        slug: nationStats.slug,
        name: nationStats.name,
        eligibleVehicles: nationStats.eligibleVehicles,
        coveredVehicles: nationStats.coveredVehicles,
        completionPct: nationStats.completionPct,
      })
      .from(nationStats)
      .where(eq(nationStats.mode, mode))
      // Ranking is a stable sort, so a deterministic read keeps the order
      // reproducible even if two nations ever compare equal.
      .orderBy(asc(nationStats.sort)),
    db
      .selectDistinctOn([vehicles.nationId], {
        nationId: vehicles.nationId,
        displayName: players.displayName,
        slug: players.slug,
        titles: count(records.id),
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(modes, modeMatchesBranch)
      .innerJoin(players, eq(players.id, records.playerId))
      .where(and(eq(records.mode, mode), isCurrentVerified))
      .groupBy(vehicles.nationId, players.id, players.displayName, players.slug)
      .orderBy(
        asc(vehicles.nationId),
        desc(count(records.id)),
        asc(players.displayName),
      ),
  ])
  if (!m) return null

  const byNation = new Map(
    holders.map((h) => [
      h.nationId,
      { name: h.displayName, slug: h.slug, titles: h.titles },
    ]),
  )
  const contested = rows.some((n) => n.coveredVehicles > 0)
  const contenders = rows
    // A nation that fields nothing in this Mode isn't in the running.
    .filter((n) => n.eligibleVehicles > 0)
    .map(({ nationId, ...n }) => ({
      ...n,
      openBounties: n.eligibleVehicles - n.coveredVehicles,
      holder: byNation.get(nationId) ?? null,
    }))
  return { contested, nations: rankNations(contenders, contested) }
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

const catalogIllustratedShape = {
  ...catalogRowShape,
  portraitKey: vehicles.portraitKey,
  holderUserId: players.userId,
  holderAvatarKey: players.avatarKey,
}

// Both serving URLs computed server-side; neither raw key ever ships.
function withPortraitAndAvatar<
  T extends {
    portraitKey: string | null
    holderUserId: string | null
    holderAvatarKey: string | null
  },
>(
  { portraitKey, holderUserId, holderAvatarKey, ...row }: T,
  viewer?: AmendmentViewer | null,
) {
  const avatarKey = effectiveAvatarKey(
    { userId: holderUserId, avatarKey: holderAvatarKey },
    viewer,
  )
  return {
    ...row,
    vehiclePortrait: portraitKey ? assetUrlIfConfigured(portraitKey) : null,
    holderAvatar: avatarKey ? assetUrlIfConfigured(avatarKey) : null,
  }
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
  viewer?: AmendmentViewer | null,
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
    .select(catalogIllustratedShape)
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

  return {
    rows: rows.map((row) => withPortraitAndAvatar(row, viewer)),
    total,
    page,
    pageCount,
  }
}

/** The Spotlight's candidates, over the whole filtered set so the ledger's sort
 * and page never move it. Shares `catalogConditions` with the ledger, so the
 * two cannot disagree about a filter. */
export async function browseSpotlight(
  db: Db,
  mode: string,
  filters: BrowseFilters,
  limit: number,
  viewer?: AmendmentViewer | null,
) {
  const m = await getMode(db, mode)
  if (!m) return null

  const rows = await db
    .select(catalogIllustratedShape)
    .from(vehicles)
    .innerJoin(nations, eq(nations.id, vehicles.nationId))
    .leftJoin(
      vehicleBr,
      and(eq(vehicleBr.vehicleId, vehicles.id), eq(vehicleBr.mode, mode)),
    )
    .innerJoin(
      records,
      and(
        eq(records.vehicleId, vehicles.id),
        eq(records.mode, mode),
        isCurrentVerified,
      ),
    )
    .innerJoin(players, eq(players.id, records.playerId))
    .where(catalogConditions(m.branch, filters, null))
    .orderBy(desc(records.kills), asc(vehicles.name))
    .limit(limit)

  return rows.map((row) => withPortraitAndAvatar(row, viewer))
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
    .select({ ...catalogRowShape, portraitKey: vehicles.portraitKey })
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

  return { nation, rows: rows.map(withVehiclePortrait) }
}

export async function getVehicle(
  db: Db,
  mode: string,
  slug: string,
  viewer?: AmendmentViewer | null,
) {
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
        portraitKey: vehicles.portraitKey,
        nationSlug: nations.slug,
        nationName: nations.name,
      })
      .from(vehicles)
      .innerJoin(nations, eq(nations.id, vehicles.nationId))
      .where(and(eq(vehicles.slug, slug), eq(vehicles.branch, m.branch)))
      .limit(1),
  )
  if (!vehicle) return null

  // BR, current record, history, and the qualifying bar all depend only on
  // vehicle.id + mode — run together.
  const [brRows, currentRows, history, minKillRows] = await Promise.all([
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
        patchName: patches.name,
        verifiedAt: records.verifiedAt,
        playerSlug: players.slug,
        displayName: players.displayName,
        holderUserId: players.userId,
        holderAvatarKey: players.avatarKey,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(players, eq(players.id, records.playerId))
      .leftJoin(patches, eq(patches.version, records.patch))
      .where(
        and(
          eq(records.vehicleId, vehicle.id),
          eq(records.mode, mode),
          isCurrentVerified,
        ),
      )
      .limit(1),
    db
      .select({
        kills: records.kills,
        verifiedAt: records.verifiedAt,
        patch: records.patch,
        isCurrent: records.isCurrent,
        displayName: players.displayName,
        playerSlug: players.slug,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(players, eq(players.id, records.playerId))
      .where(
        and(
          eq(records.vehicleId, vehicle.id),
          eq(records.mode, mode),
          eq(records.status, 'verified'),
        ),
      )
      .orderBy(sql`${records.verifiedAt} asc nulls first`, asc(records.id)),
    db
      .select({ minKills: modeMinKills.minKills })
      .from(modeMinKills)
      .where(
        and(eq(modeMinKills.mode, mode), eq(modeMinKills.class, vehicle.class)),
      )
      .limit(1),
  ])
  const brRow = one(brRows)
  const currentRow = one(currentRows)
  const current = currentRow ? withHolderAvatar(currentRow, viewer) : null

  // A Difficult vehicle's flat bar beats the class bar (PRD rules semantics).
  const classMin = one(minKillRows)?.minKills ?? null
  const minKills =
    vehicle.isDifficult && m.difficultMinKills != null
      ? m.difficultMinKills
      : classMin

  const proofRows = current
    ? await db
        .select()
        .from(recordProof)
        .where(eq(recordProof.recordId, current.recordId))
        .orderBy(asc(recordProof.sort))
    : []
  // Serve the mirrored copy when one exists — the original host may be gone.
  const proofs = proofRows.map((p) => ({
    ...p,
    url:
      (p.storagePath && proofUrlIfConfigured(p.storagePath)) || p.originalUrl,
  }))

  const { portraitKey, ...vehicleRow } = vehicle
  return {
    vehicle: {
      ...vehicleRow,
      portrait: portraitKey ? assetUrlIfConfigured(portraitKey) : null,
    },
    br: brRow ? brRow.br : null,
    current,
    proofs,
    history,
    titleSteps: titleFrontier(history),
    minKills,
  }
}

export async function getPlayer(db: Db, slug: string) {
  const player = one(
    await db.select().from(players).where(eq(players.slug, slug)).limit(1),
  )
  if (!player) return null

  // A merge tombstone has no profile of its own — callers check
  // playerMergeRedirect() to 301 to the survivor.
  if (player.mergedInto != null) return null

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
        nationSlug: nations.slug,
        ...vehicleTagFlags,
        ignSnapshot: records.ignSnapshot,
        displayNameSnapshot: records.displayNameSnapshot,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(nations, eq(nations.id, vehicles.nationId))
      // Same counted-record definition as the stats views: live mode + branch
      // match, so an off-branch record (invalid data) never renders here either.
      .innerJoin(modes, liveModeMatchesBranch)
      .where(and(eq(records.playerId, player.id), isCurrentVerified))
      // Vehicle last, so equal-kill rows come back in one order rather than
      // whichever the plan happened to produce — the profile and its share
      // card each run this, and a tie ordered differently makes them disagree.
      .orderBy(asc(records.mode), desc(records.kills), asc(vehicles.slug)),
  ])

  return { player, aliases: aliases.map((a) => a.name), records: recs }
}

// A raw SQL expression carries no column decoder, so a timestamp computed in
// one reaches callers driver-shaped (a string on some drivers) unless mapped.
const asTimestamp = (value: unknown): Date | null =>
  value == null ? null : (records.verifiedAt.mapFromDriverValue(value) as Date)

/* Every verified, dated record beside the best kill count that preceded it in
   its (vehicle, mode) succession. Retired rows leave the succession entirely:
   no window of their own, and none closed for anyone else. */
function titleSuccession(db: Db, playerId: number) {
  return db
    .select({
      id: records.id,
      playerId: records.playerId,
      vehicleId: records.vehicleId,
      mode: records.mode,
      kills: records.kills,
      heldFrom: records.verifiedAt,
      bestBefore: sql<number | null>`max(${records.kills}) over (
        partition by ${records.vehicleId}, ${records.mode}
        order by ${records.verifiedAt}, ${records.id}
        rows between unbounded preceding and 1 preceding
      )`.as('best_before'),
    })
    .from(records)
    .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
    .innerJoin(modes, liveModeMatchesBranch)
    .where(
      and(
        eq(records.status, 'verified'),
        isNotNull(records.verifiedAt),
        // Only the successions this Player took part in — the rest of the
        // registry can't affect their windows, so it stays out of the sort.
        sql`(${records.vehicleId}, ${records.mode}) in (
          select ${records.vehicleId}, ${records.mode} from ${records}
          where ${eq(records.playerId, playerId)}
        )`,
      ),
    )
    .as('succession')
}

/* The tenure of every record that actually took its title, paired with the
   moment it lost it. Only strictly more kills takes a title, so a later
   verification that didn't beat the holder is no successor: it forms no
   window and closes nobody's — the same frontier rule as titleFrontier(). */
function heldWindows(db: Db, playerId: number) {
  const succession = titleSuccession(db, playerId)
  return db
    .select({
      id: succession.id,
      playerId: succession.playerId,
      mode: succession.mode,
      vehicleId: succession.vehicleId,
      heldFrom: succession.heldFrom,
      lostAt: sql`lead(${succession.heldFrom}) over (
        partition by ${succession.vehicleId}, ${succession.mode}
        order by ${succession.heldFrom}, ${succession.id}
      )`
        .mapWith(asTimestamp)
        .as('lost_at'),
    })
    .from(succession)
    .where(
      or(
        isNull(succession.bestBefore),
        gt(succession.kills, succession.bestBefore),
      ),
    )
    .as('held')
}

/** The three identity stats a profile shows beside a Player's name. Undated
    records stay out of the temporal stats but keep their place in the counts. */
export async function getPlayerEnrichment(db: Db, playerId: number) {
  const held = heldWindows(db, playerId)
  const heldSeconds =
    sql<number>`extract(epoch from (coalesce(${held.lostAt}, now()) - ${held.heldFrom}))`.mapWith(
      Number,
    )
  const titles = count()

  const [nationSpread, longest, recency] = await Promise.all([
    db
      .select({ slug: nations.slug, name: nations.name, records: titles })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(nations, eq(nations.id, vehicles.nationId))
      .innerJoin(modes, liveModeMatchesBranch)
      .where(and(eq(records.playerId, playerId), isCurrentVerified))
      .groupBy(nations.id)
      .orderBy(desc(titles), asc(nations.sort)),
    db
      .select({
        vehicleSlug: vehicles.slug,
        vehicleName: vehicles.name,
        mode: held.mode,
        heldSeconds,
        lostAt: held.lostAt,
      })
      .from(held)
      .innerJoin(vehicles, eq(vehicles.id, held.vehicleId))
      .where(eq(held.playerId, playerId))
      // Equal tenures: the later title wins, id settling the last tie.
      .orderBy(desc(heldSeconds), desc(held.heldFrom), desc(held.id))
      .limit(1),
    db
      .select({ lastVerifiedAt: max(records.verifiedAt) })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(modes, liveModeMatchesBranch)
      .where(
        and(eq(records.playerId, playerId), eq(records.status, 'verified')),
      ),
  ])

  return {
    nationSpread,
    longestHeld: one(longest),
    lastVerifiedAt: one(recency)?.lastVerifiedAt ?? null,
  }
}

/** The Avatar key that actually renders: an Avatar belongs to a claim, so an
    accountless Player shows the Medallion even if a stale key lingers.

    The one viewer-aware seam. `players.avatarKey` is the reviewed value, and a
    caller that passes no viewer gets it — the safe direction, by construction,
    so a call site that forgets the shadow serves what a Moderator accepted. The
    owner, and nobody else, is served their own proposal instead. */
export function effectiveAvatarKey(
  player: {
    userId: string | null
    avatarKey: string | null
  },
  viewer?: AmendmentViewer | null,
): string | null {
  if (player.userId == null) return null
  return viewer && viewer.userId === player.userId
    ? viewer.pendingAvatarKey
    : player.avatarKey
}

/** A Country is a claimed Player's own statement, so an accountless Player
    carries none. unclaim() deletes it too — this gate alone would let it
    resurrect on re-claim. */
export function effectiveCountry(player: {
  userId: string | null
  countryCode: string | null
}): string | null {
  return player.userId != null ? player.countryCode : null
}

/** The stored rows for one Player, unordered — what is stored carries no
    position, and the config decides the order at render (`renderLinks`). */
export async function getPlayerLinks(
  db: Db,
  playerId: number,
): Promise<Array<{ platform: string; handle: string }>> {
  return db
    .select({ platform: playerLinks.platform, handle: playerLinks.handle })
    .from(playerLinks)
    .where(eq(playerLinks.playerId, playerId))
}

/** Profile links belong to a claim, so an accountless Player shows none —
    and an unclaimed Player's page never implies somebody is behind it.

    For a child table this gate is the ONLY cover on the account-deletion path:
    deleting an auth User nulls `players.user_id` by FK, which cannot reach
    `player_links` at all. `unclaim()` deletes the rows for every other path. */
export function effectiveLinks<T>(
  player: { userId: string | null },
  links: ReadonlyArray<T>,
): T[] {
  return player.userId != null ? [...links] : []
}

/** Survivor slug for a merged player's slug, following later merges of the
    survivor itself, or null when the slug isn't a tombstone. */
export async function playerMergeRedirect(
  db: Db,
  slug: string,
): Promise<string | null> {
  const start = one(
    await db
      .select({ mergedInto: players.mergedInto })
      .from(players)
      .where(eq(players.slug, slug))
      .limit(1),
  )
  let survivorId = start?.mergedInto ?? null
  for (let hops = 0; survivorId != null && hops < 10; hops++) {
    const next = one(
      await db
        .select({ slug: players.slug, mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, survivorId))
        .limit(1),
    )
    if (!next) return null
    if (next.mergedInto == null) return next.slug
    survivorId = next.mergedInto
  }
  return null
}

/** Everything a nation share card shows, in one consistent read. Held / total /
    completion / avg come from nation_stats (same numbers as the site); most-held
    Player is the holder of the most current titles for this nation + mode. Null
    when the nation isn't in this mode (→ 404). */
export async function getNationCard(db: Db, mode: string, slug: string) {
  const stats = one(
    await db
      .select({
        name: nationStats.name,
        nationId: nationStats.nationId,
        held: nationStats.coveredVehicles,
        total: nationStats.eligibleVehicles,
        completionPct: nationStats.completionPct,
        avgKills: nationStats.avgKills,
      })
      .from(nationStats)
      .where(and(eq(nationStats.mode, mode), eq(nationStats.slug, slug)))
      .limit(1),
  )
  if (!stats) return null

  const top = one(
    await db
      .select({ displayName: players.displayName })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .innerJoin(modes, modeMatchesBranch)
      .innerJoin(players, eq(players.id, records.playerId))
      .where(
        and(
          eq(records.mode, mode),
          eq(vehicles.nationId, stats.nationId),
          isCurrentVerified,
        ),
      )
      .groupBy(players.id, players.displayName)
      .orderBy(desc(count(records.id)), asc(players.displayName))
      .limit(1),
  )

  return {
    name: stats.name,
    nationSlug: slug,
    held: stats.held,
    total: stats.total,
    completionPct: stats.completionPct,
    avgKills: stats.avgKills,
    mostHeldPlayer: top ? top.displayName : null,
  }
}

/** Display name a merged-player slug carried before the Merge — the source for a
    survivor card's "previously known as" line when reached via `?from=`. Null
    when the slug isn't a tombstone. Callers verify the slug actually merges into
    the survivor before trusting the name. */
export async function mergedFromName(
  db: Db,
  slug: string,
): Promise<string | null> {
  const row = one(
    await db
      .select({
        displayName: players.displayName,
        mergedInto: players.mergedInto,
      })
      .from(players)
      .where(eq(players.slug, slug))
      .limit(1),
  )
  return row && row.mergedInto != null ? row.displayName : null
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
      nationSlug: nations.slug,
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
  const like = likeContains(term)
  const [foundPlayers, foundVehicles, liveRows] = await Promise.all([
    db
      .select({ slug: players.slug, displayName: players.displayName })
      .from(players)
      // Merge tombstones stay out of search; their slugs 301 if visited.
      .where(and(ilike(players.displayName, like), isNull(players.mergedInto)))
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
        nationSlug: v.nationSlug,
        ...pickVehicleTags(v),
        linkMode: pref && liveModes.has(pref) ? pref : null,
      }
    }),
  }
}
