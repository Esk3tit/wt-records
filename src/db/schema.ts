import {
  pgTable,
  pgEnum,
  pgView,
  integer,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  check,
  pgPolicy,
  doublePrecision,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { authUsers, anonRole } from 'drizzle-orm/supabase'
import { VEHICLE_CLASSES } from '#/lib/vehicle-classes'

/* ── Enums (stable, closed sets) ─────────────────────────────── */
export const branch = pgEnum('branch', ['ground', 'air', 'naval'])
// Values derive from VEHICLE_CLASSES so the enum and rule logic can't desync.
export const vehicleClass = pgEnum('vehicle_class', VEHICLE_CLASSES)
export const recordStatus = pgEnum('record_status', [
  'verified',
  'pending',
  'rejected',
])
export const role = pgEnum('role', ['viewer', 'moderator', 'admin'])
export const proofKind = pgEnum('proof_kind', [
  'scoreboard',
  'end_game',
  'end_life',
  'video',
])

/* ── Mode registry: data, not an enum. No rulesVersion. ──────── */
export const modes = pgTable('modes', {
  mode: text('mode').primaryKey(), // "grb","gab","arb","aab"
  name: text('name').notNull(),
  branch: branch('branch').notNull(),
  rulesMd: text('rules_md'),
  difficultMinKills: integer('difficult_min_kills'), // flat per-mode override
  isLive: boolean('is_live').notNull().default(false),
  sort: integer('sort').notNull().default(0),
}).enableRLS()

/* The one machine rule parameter: qualifying threshold per (mode, class). */
export const modeMinKills = pgTable(
  'mode_min_kills',
  {
    mode: text('mode')
      .references(() => modes.mode)
      .notNull(),
    class: vehicleClass('class').notNull(),
    minKills: integer('min_kills').notNull(),
  },
  (t) => [primaryKey({ columns: [t.mode, t.class] })],
).enableRLS()

export const nations = pgTable('nations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sort: integer('sort').notNull(),
  backgroundUrl: text('background_url'),
}).enableRLS()

export const vehicles = pgTable(
  'vehicles',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    externalId: text('external_id').notNull().unique(), // datamine/API key
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    nationId: integer('nation_id')
      .references(() => nations.id)
      .notNull(),
    branch: branch('branch').notNull(),
    class: vehicleClass('class').notNull(),
    rank: integer('rank'),
    isPremium: boolean('is_premium').notNull().default(false),
    isSquadron: boolean('is_squadron').notNull().default(false),
    isEvent: boolean('is_event').notNull().default(false),
    isRemoved: boolean('is_removed').notNull().default(false),
    imageUrl: text('image_url'),
    isDifficult: boolean('is_difficult').notNull().default(false), // manual rules overlay
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [
    index('veh_nation_idx').on(t.nationId),
    index('veh_branch_idx').on(t.branch),
  ],
).enableRLS()

/* Current in-game BR per (vehicle, mode). numeric (exact), not real. */
export const vehicleBr = pgTable(
  'vehicle_br',
  {
    vehicleId: integer('vehicle_id')
      .references(() => vehicles.id)
      .notNull(),
    mode: text('mode')
      .references(() => modes.mode)
      .notNull(),
    br: numeric('br', { precision: 3, scale: 1, mode: 'number' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.vehicleId, t.mode] })],
).enableRLS()

export const players = pgTable(
  'players',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(), // CURRENT primary name
    userId: uuid('user_id').references(() => authUsers.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('ply_user_idx').on(t.userId)],
).enableRLS()

export const playerAliases = pgTable(
  'player_aliases',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer('player_id')
      .references(() => players.id)
      .notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('ign'), // "ign" | "display"
    source: text('source').notNull().default('ingame'), // "migration"|"ingame"|"submission"
    firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex('alias_uq').on(t.playerId, t.name, t.kind)],
).enableRLS()

/* Canonical WT game versions — the community's temporal axis. Catalog-sync
   upserts the current one and /admin can add inline, so entry never blocks. */
export const patches = pgTable('patches', {
  version: text('version').primaryKey(), // "2.53"
  name: text('name'), // e.g. "Sons of Attila"
  releasedAt: timestamp('released_at', { withTimezone: true }),
}).enableRLS()

export const records = pgTable(
  'records',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    vehicleId: integer('vehicle_id')
      .references(() => vehicles.id)
      .notNull(),
    mode: text('mode')
      .references(() => modes.mode)
      .notNull(),
    playerId: integer('player_id')
      .references(() => players.id)
      .notNull(),
    ignSnapshot: text('ign_snapshot').notNull(), // SECONDARY, immutable
    displayNameSnapshot: text('display_name_snapshot'), // SECONDARY, immutable
    kills: integer('kills').notNull(),
    runBr: numeric('run_br', { precision: 3, scale: 1, mode: 'number' }),
    patch: text('patch')
      .references(() => patches.version)
      .notNull(),
    // Safe defaults: a bare insert is an unverified, non-current submission.
    // The import/seed/mod-accept paths set verified + current explicitly.
    status: recordStatus('status').notNull().default('pending'),
    isCurrent: boolean('is_current').notNull().default(false),
    importedFrom: text('imported_from'), // "sheet" for migrated rows
    submittedById: uuid('submitted_by_id').references(() => authUsers.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedById: uuid('verified_by_id').references(() => authUsers.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('rec_vehicle_mode_idx').on(t.vehicleId, t.mode),
    // at most one CURRENT, VERIFIED record per (vehicle, mode):
    uniqueIndex('rec_current_uq')
      .on(t.vehicleId, t.mode)
      .where(sql`is_current and status = 'verified'`),
    index('rec_mode_idx').on(t.mode),
    index('rec_player_idx').on(t.playerId),
    index('rec_kills_idx').on(t.kills),
    // a current record must be verified — illegal state unrepresentable:
    check(
      'rec_current_verified_ck',
      sql`not is_current or status = 'verified'`,
    ),
    // a record is a kill achievement: kills must be positive:
    check('rec_kills_positive_ck', sql`kills > 0`),
    // anon (Realtime) sees ONLY verified + current rows.
    pgPolicy('records_anon_select_current', {
      as: 'permissive',
      for: 'select',
      to: anonRole,
      using: sql`status = 'verified' and is_current`,
    }),
  ],
).enableRLS() // explicit (consistent with every table) so the snapshot reflects RLS

export const recordProof = pgTable(
  'record_proof',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    recordId: integer('record_id')
      .references(() => records.id)
      .notNull(),
    kind: proofKind('kind').notNull(), // incl. "video"
    storagePath: text('storage_path'), // Supabase Storage key
    originalUrl: text('original_url'), // source Imgur/Discord URL
    sort: integer('sort').notNull().default(0),
  },
  () => [
    // a proof row must reference something — a Storage key and/or a source URL:
    check(
      'proof_has_location_ck',
      sql`storage_path is not null or original_url is not null`,
    ),
  ],
).enableRLS()

export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  handle: text('handle'),
  discordId: text('discord_id'), // convenience; auth.identities canonical
  googleEmail: text('google_email'), // convenience
  role: role('role').notNull().default('viewer'),
}).enableRLS()

/* ── Derived stats views — plain SQL views (drizzle/0002), mapped here
      as `existing` so drizzle-kit never tries to (re)create them. ─────── */
export const playerStats = pgView('player_stats', {
  mode: text('mode').notNull(),
  playerId: integer('player_id').notNull(),
  records: integer('records').notNull(),
  totalKills: integer('total_kills').notNull(),
  avgKills: doublePrecision('avg_kills').notNull(),
}).existing()

export const leaderboard = pgView('leaderboard', {
  mode: text('mode').notNull(),
  playerId: integer('player_id').notNull(),
  slug: text('slug').notNull(),
  displayName: text('display_name').notNull(),
  records: integer('records').notNull(),
  totalKills: integer('total_kills').notNull(),
  rank: integer('rank').notNull(),
}).existing()

export const globalStats = pgView('global_stats', {
  mode: text('mode').notNull(),
  records: integer('records').notNull(),
  holders: integer('holders').notNull(),
  coveredVehicles: integer('covered_vehicles').notNull(),
  eligibleVehicles: integer('eligible_vehicles').notNull(),
  remainingVehicles: integer('remaining_vehicles').notNull(),
  completionPct: integer('completion_pct').notNull(),
  avgKills: doublePrecision('avg_kills'),
  medianKills: doublePrecision('median_kills'),
  latestRecordId: integer('latest_record_id'),
}).existing()

export const nationStats = pgView('nation_stats', {
  mode: text('mode').notNull(),
  nationId: integer('nation_id').notNull(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  sort: integer('sort').notNull(),
  eligibleVehicles: integer('eligible_vehicles').notNull(),
  coveredVehicles: integer('covered_vehicles').notNull(),
  completionPct: integer('completion_pct').notNull(),
  avgKills: doublePrecision('avg_kills'),
}).existing()

export const leaderboardAllModes = pgView('leaderboard_all_modes', {
  playerId: integer('player_id').notNull(),
  slug: text('slug').notNull(),
  displayName: text('display_name').notNull(),
  records: integer('records').notNull(),
  totalKills: integer('total_kills').notNull(),
  rank: integer('rank').notNull(),
}).existing()

export const auditLog = pgTable('audit_log', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  actorId: uuid('actor_id').references(() => authUsers.id, {
    onDelete: 'set null',
  }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  diff: jsonb('diff'), // opaque store-and-display
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}).enableRLS()
