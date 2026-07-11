import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { inArray, isNotNull, sql } from 'drizzle-orm'
import * as schema from '#/db/schema'
import { CANONICAL_MODES } from '#/db/modes'
import type { SeedDb } from '#/db/seed'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import { assertValidObjectKey } from '#/storage/urls'
import { RASTER_IMAGE_CONTENT_TYPES } from '#/storage/image-types'
import type { Storage } from '#/storage/r2'
import type { MigrationResolution, ResolvedProof } from '#/migration/resolve'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'

type ProofStore = Pick<Storage, 'put'>

export interface LoadOptions {
  /** Full apply inside the transaction, then roll back; mirroring skipped. */
  dryRun?: boolean
}

export interface LoadDeps {
  /** Proofs-bucket store; null skips mirroring (local runs without R2). */
  store: ProofStore | null
  fetchImpl?: typeof fetch
  /** Resume manifest path for the mirror phase. */
  manifestPath: string
  throttleMs?: number
  sleepImpl?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

export interface LoadSummary {
  players: number
  records: number
  proofs: number
  mirrored: number
  mirrorReused: number
  mirrorSkipped: number
  patchesUpserted: number
  difficultFlagged: number
  wipedRecords: number
  wipedPlayers: number
}

class DryRunRollback extends Error {
  constructor(readonly summary: LoadSummary) {
    super('dry run')
  }
}

const CHUNK = 500

interface MirrorManifest {
  /** media id → object key already uploaded by a previous run. */
  uploaded: Record<string, string>
}

export function proofObjectKey(
  mode: string,
  mirror: NonNullable<ResolvedProof['mirror']>,
): string {
  const key = `migration/${mode}/${mirror.mediaId}.${mirror.ext}`
  assertValidObjectKey(key)
  return key
}

/** All-or-nothing load; R2 mirroring runs first, outside the transaction —
    uploads can't roll back, but re-running overwrites the same keys. */
export async function loadMigration(
  db: SeedDb,
  resolution: MigrationResolution,
  rules: MigrationRules,
  patches: Array<PatchBackfillEntry>,
  deps: LoadDeps,
  options: LoadOptions = {},
): Promise<LoadSummary> {
  refuseUnlessResolved(resolution)
  // Checked again inside the transaction; failing here first keeps a refused
  // load from spending the whole mirror phase on uploads it will never use.
  await guardAgainstUserData(db)

  const summary: LoadSummary = {
    players: 0,
    records: 0,
    proofs: 0,
    mirrored: 0,
    mirrorReused: 0,
    mirrorSkipped: 0,
    patchesUpserted: 0,
    difficultFlagged: 0,
    wipedRecords: 0,
    wipedPlayers: 0,
  }

  const storageKeys = await mirrorProofImages(
    resolution,
    deps,
    options,
    summary,
  )

  try {
    return await db.transaction(async (tx) => {
      await guardAgainstUserData(tx)
      await syncRules(tx, resolution, rules)
      await upsertPatches(tx, patches, summary)
      await flagDifficultVehicles(tx, resolution, summary)
      await wipe(tx, summary)
      await insertEverything(tx, resolution, storageKeys, summary)
      if (options.dryRun) throw new DryRunRollback(summary)
      return summary
    })
  } catch (e) {
    if (e instanceof DryRunRollback) return e.summary
    throw e
  }
}

function refuseUnlessResolved(resolution: MigrationResolution): void {
  const blocked = resolution.rows.filter((r) => r.problems.length > 0)
  if (blocked.length > 0 || resolution.unresolvedDifficult.length > 0) {
    throw new Error(
      `Refusing to load: ${blocked.length} unresolved row(s), ` +
        `${resolution.unresolvedDifficult.length} unresolved difficult vehicle(s) — ` +
        `re-run import:resolve and adjudicate the review artifact first`,
    )
  }
}

/* The wipe is only safe while nothing user-owned exists: no submitted
   records and no account-claimed players. */
async function guardAgainstUserData(tx: SeedDb): Promise<void> {
  const userRecords = await tx
    .select({ id: schema.records.id })
    .from(schema.records)
    .where(isNotNull(schema.records.submittedById))
    .limit(1)
  if (userRecords.length > 0) {
    throw new Error(
      'Refusing to load: user-submitted records exist — the full wipe-and-import is only valid pre-launch',
    )
  }
  const claimedPlayers = await tx
    .select({ id: schema.players.id })
    .from(schema.players)
    .where(isNotNull(schema.players.userId))
    .limit(1)
  if (claimedPlayers.length > 0) {
    throw new Error(
      'Refusing to load: account-claimed players exist — the full wipe-and-import is only valid pre-launch',
    )
  }
}

async function mirrorProofImages(
  resolution: MigrationResolution,
  deps: LoadDeps,
  options: LoadOptions,
  summary: LoadSummary,
): Promise<Map<string, string>> {
  const log = deps.log ?? (() => {})
  const targets = new Map<string, { url: string; key: string }>()
  for (const row of resolution.rows) {
    for (const proof of row.proofs) {
      if (proof.mirror && !targets.has(proof.mirror.mediaId)) {
        targets.set(proof.mirror.mediaId, {
          url: proof.originalUrl,
          key: proofObjectKey(resolution.mode, proof.mirror),
        })
      }
    }
  }

  if (options.dryRun || !deps.store) {
    summary.mirrorSkipped = targets.size
    log(
      options.dryRun
        ? `Dry run — skipped mirroring ${targets.size} images.`
        : `No R2 store — skipped mirroring ${targets.size} images; proofs keep original URLs only.`,
    )
    return new Map()
  }

  const manifest = readManifest(deps.manifestPath)
  const keys = new Map<string, string>()
  const fetchImpl = deps.fetchImpl ?? fetch
  const throttleMs = deps.throttleMs ?? 1000
  const sleepImpl =
    deps.sleepImpl ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const failures: Array<string> = []

  let done = 0
  for (const [mediaId, target] of targets) {
    if (manifest.uploaded[mediaId] === target.key) {
      keys.set(mediaId, target.key)
      summary.mirrorReused += 1
      continue
    }
    try {
      const res = await fetchUpstream(target.url, {
        fetchImpl,
        timeoutMs: 30_000,
        maxAttempts: 4,
      })
      const contentType =
        res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ??
        ''
      if (!RASTER_IMAGE_CONTENT_TYPES.has(contentType)) {
        throw new Error(
          `unexpected content type ${JSON.stringify(contentType)}`,
        )
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      await deps.store.put('proofs', target.key, bytes, contentType)
      manifest.uploaded[mediaId] = target.key
      writeManifest(deps.manifestPath, manifest)
      keys.set(mediaId, target.key)
      summary.mirrored += 1
    } catch (error) {
      failures.push(
        `${target.url}: ${error instanceof Error ? error.message : error}`,
      )
    }
    done += 1
    if (done % 100 === 0) log(`  mirrored ${done}/${targets.size}`)
    await sleepImpl(throttleMs)
  }

  if (failures.length > 0) {
    throw new Error(
      `Mirroring failed for ${failures.length} image(s) — nothing was loaded; ` +
        `re-run to resume from the manifest.\n${failures.join('\n')}`,
    )
  }
  return keys
}

function readManifest(path: string): MirrorManifest {
  if (!existsSync(path)) return { uploaded: {} }
  return JSON.parse(readFileSync(path, 'utf8')) as MirrorManifest
}

function writeManifest(path: string, manifest: MirrorManifest): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

/* The sheet's Rules tab values replace the seed's demo fiction; modes are
   upserted so the rollout order never runs against an empty modes table. */
async function syncRules(
  tx: SeedDb,
  resolution: MigrationResolution,
  rules: MigrationRules,
): Promise<void> {
  for (const mode of CANONICAL_MODES) {
    await tx
      .insert(schema.modes)
      .values(mode)
      .onConflictDoUpdate({
        target: schema.modes.mode,
        set: {
          name: mode.name,
          branch: mode.branch,
          isLive: mode.isLive,
          sort: mode.sort,
        },
      })
  }
  await tx
    .update(schema.modes)
    .set({ difficultMinKills: rules.difficultMinKills })
    .where(sql`${schema.modes.mode} = ${resolution.mode}`)

  await tx
    .delete(schema.modeMinKills)
    .where(sql`${schema.modeMinKills.mode} = ${resolution.mode}`)
  const minKillRows = Object.entries(rules.minKills).map(([cls, minKills]) => ({
    mode: resolution.mode,
    class: cls as (typeof schema.modeMinKills.$inferInsert)['class'],
    minKills,
  }))
  if (minKillRows.length > 0) {
    await tx.insert(schema.modeMinKills).values(minKillRows)
  }
}

async function upsertPatches(
  tx: SeedDb,
  patches: Array<PatchBackfillEntry>,
  summary: LoadSummary,
): Promise<void> {
  if (patches.length === 0) return
  await tx
    .insert(schema.patches)
    .values(
      patches.map((patch) => ({
        version: patch.version,
        name: patch.name,
        releasedAt: new Date(patch.releasedAt),
      })),
    )
    .onConflictDoUpdate({
      target: schema.patches.version,
      set: {
        name: sql`excluded.name`,
        releasedAt: sql`excluded.released_at`,
      },
    })
  summary.patchesUpserted = patches.length
}

async function flagDifficultVehicles(
  tx: SeedDb,
  resolution: MigrationResolution,
  summary: LoadSummary,
): Promise<void> {
  // Clear first so a re-run with an amended list never leaves stale flags —
  // this importer is the only writer of is_difficult.
  await tx
    .update(schema.vehicles)
    .set({ isDifficult: false })
    .where(sql`${schema.vehicles.isDifficult}`)
  const externalIds = [
    ...new Set(resolution.difficultVehicles.map((d) => d.externalId)),
  ]
  if (externalIds.length === 0) return
  const updated = await tx
    .update(schema.vehicles)
    .set({ isDifficult: true })
    .where(inArray(schema.vehicles.externalId, externalIds))
    .returning({ externalId: schema.vehicles.externalId })
  summary.difficultFlagged = updated.length
  if (updated.length !== externalIds.length) {
    const found = new Set(updated.map((u) => u.externalId))
    const missing = externalIds.filter((id) => !found.has(id))
    throw new Error(
      `Difficult vehicles missing from this database's catalog: ${missing.join(', ')} — ` +
        'was catalog:sync run against it?',
    )
  }
}

/* prod currently serves the demo fixture's players/records; the migration
   replaces them wholesale. */
async function wipe(tx: SeedDb, summary: LoadSummary): Promise<void> {
  await tx.delete(schema.recordProof)
  const records = await tx
    .delete(schema.records)
    .returning({ id: schema.records.id })
  summary.wipedRecords = records.length
  await tx.delete(schema.playerAliases)
  const players = await tx
    .delete(schema.players)
    .returning({ id: schema.players.id })
  summary.wipedPlayers = players.length
}

async function insertEverything(
  tx: SeedDb,
  resolution: MigrationResolution,
  storageKeys: Map<string, string>,
  summary: LoadSummary,
): Promise<void> {
  const playerIdByName = new Map<string, number>()
  for (let i = 0; i < resolution.players.length; i += CHUNK) {
    const chunk = resolution.players.slice(i, i + CHUNK)
    const inserted = await tx
      .insert(schema.players)
      .values(chunk.map((p) => ({ slug: p.slug, displayName: p.name })))
      .returning({ id: schema.players.id })
    chunk.forEach((p, j) => playerIdByName.set(p.name, inserted[j].id))
    await tx.insert(schema.playerAliases).values(
      chunk.map((p, j) => ({
        playerId: inserted[j].id,
        name: p.name,
        kind: 'ign',
        source: 'migration',
      })),
    )
  }
  summary.players = resolution.players.length

  const externalIds = [
    ...new Set(resolution.rows.map((r) => r.vehicleExternalId!)),
  ]
  const vehicleRows = await tx
    .select({
      id: schema.vehicles.id,
      externalId: schema.vehicles.externalId,
    })
    .from(schema.vehicles)
    .where(inArray(schema.vehicles.externalId, externalIds))
  const vehicleIdByExternalId = new Map(
    vehicleRows.map((v) => [v.externalId, v.id]),
  )
  const missing = externalIds.filter((id) => !vehicleIdByExternalId.has(id))
  if (missing.length > 0) {
    throw new Error(
      `Vehicles missing from this database's catalog: ${missing.slice(0, 10).join(', ')}` +
        `${missing.length > 10 ? ` (+${missing.length - 10} more)` : ''} — ` +
        'the resolution was made against a different catalog',
    )
  }

  for (let i = 0; i < resolution.rows.length; i += CHUNK) {
    const chunk = resolution.rows.slice(i, i + CHUNK)
    const inserted = await tx
      .insert(schema.records)
      .values(
        chunk.map((row) => ({
          vehicleId: vehicleIdByExternalId.get(row.vehicleExternalId!)!,
          mode: resolution.mode,
          playerId: playerIdByName.get(row.playerName)!,
          ignSnapshot: row.playerName,
          displayNameSnapshot: row.playerName,
          kills: row.kills,
          runBr: row.br,
          patch: row.patch!,
          status: 'verified' as const,
          isCurrent: row.isCurrent,
          importedFrom: 'sheet',
          submittedById: null,
          submittedAt: new Date(row.submittedAt),
          verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : null,
        })),
      )
      .returning({ id: schema.records.id })

    const proofRows = chunk.flatMap((row, j) =>
      row.proofs.map((proof, index) => ({
        recordId: inserted[j].id,
        kind: proof.kind,
        storagePath: proof.mirror
          ? (storageKeys.get(proof.mirror.mediaId) ?? null)
          : null,
        originalUrl: proof.originalUrl,
        sort: index,
      })),
    )
    for (let k = 0; k < proofRows.length; k += CHUNK) {
      await tx.insert(schema.recordProof).values(proofRows.slice(k, k + CHUNK))
    }
    summary.records += inserted.length
    summary.proofs += proofRows.length
  }
}
