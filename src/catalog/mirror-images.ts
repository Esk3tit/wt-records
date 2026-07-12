import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import * as schema from '#/db/schema'
import { vehicleImageKey } from '#/catalog/image-key'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import { RASTER_IMAGE_CONTENT_TYPES } from '#/storage/image-types'
import type { Storage } from '#/storage/r2'

type AssetStore = Pick<Storage, 'put' | 'delete'>

// A systemic failure (revoked token, dead bucket) must not download the whole
// catalog before anyone notices — stop the run after this many failures in a row.
const MAX_CONSECUTIVE_FAILURES = 20

export interface MirrorOptions {
  /** Mirror at most this many images this run (backfill throttle). */
  limit?: number
  concurrency?: number
  fetchImpl?: typeof fetch
  /** Total fetch attempts per image, including the first. */
  maxAttempts?: number
  retryDelayMs?: number
}

export interface MirrorSummary {
  mirrored: number
  upToDate: number
  failed: number
  /** Candidates beyond `limit` left for a later run. */
  deferred: number
  /** Stale mirrors removed after the upstream image went away. */
  cleaned: number
  warnings: Array<string>
}

interface Candidate {
  id: number
  externalId: string
  imageUrl: string
  imageKey: string | null
  wantKey: string
}

/** Best-effort, idempotent mirror of catalog imagery into the assets bucket.
    Runs outside the sync transaction: a mirror failure must never fail a sync. */
export async function mirrorVehicleImages(
  db: Db,
  store: AssetStore,
  options: MirrorOptions = {},
): Promise<MirrorSummary> {
  const fetchImpl = options.fetchImpl ?? fetch
  const concurrency = options.concurrency ?? 4

  const summary: MirrorSummary = {
    mirrored: 0,
    upToDate: 0,
    failed: 0,
    deferred: 0,
    cleaned: 0,
    warnings: [],
  }

  // Ground first: record pages need their portraits before anything else,
  // and the upstream rate limit means each run only mirrors a slice.
  const withImage = await db
    .select({
      id: schema.vehicles.id,
      externalId: schema.vehicles.externalId,
      imageUrl: schema.vehicles.imageUrl,
      imageKey: schema.vehicles.imageKey,
    })
    .from(schema.vehicles)
    .where(isNotNull(schema.vehicles.imageUrl))
    .orderBy(sql`${schema.vehicles.branch} = 'ground' desc`, schema.vehicles.id)

  const stale: Array<Candidate> = []
  for (const v of withImage) {
    const imageUrl = v.imageUrl!
    let wantKey: string
    try {
      wantKey = vehicleImageKey(v.externalId, imageUrl)
    } catch {
      summary.failed += 1
      summary.warnings.push(
        `unusable image URL for ${v.externalId}: ${JSON.stringify(imageUrl)}`,
      )
      continue
    }
    if (v.imageKey === wantKey) summary.upToDate += 1
    else stale.push({ ...v, imageUrl, wantKey })
  }
  const candidates =
    options.limit != null ? stale.slice(0, options.limit) : stale
  summary.deferred = stale.length - candidates.length

  let consecutiveFailures = 0

  async function mirrorOne(v: Candidate) {
    try {
      const res = await fetchUpstream(v.imageUrl, {
        fetchImpl,
        timeoutMs: 30_000,
        maxAttempts: options.maxAttempts,
        retryDelayMs: options.retryDelayMs,
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
      await store.put('assets', v.wantKey, bytes, contentType)
      await db
        .update(schema.vehicles)
        .set({ imageKey: v.wantKey })
        .where(eq(schema.vehicles.id, v.id))
      if (v.imageKey) {
        // stale object from a previous source URL; removal is tidy-up only
        await store.delete('assets', v.imageKey).catch(() => {})
      }
      summary.mirrored += 1
      consecutiveFailures = 0
    } catch (error) {
      summary.failed += 1
      consecutiveFailures += 1
      summary.warnings.push(
        `mirror failed for ${v.externalId}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < candidates.length) {
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return
        await mirrorOne(candidates[next++])
      }
    }),
  )
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    summary.warnings.push(
      `aborted after ${MAX_CONSECUTIVE_FAILURES} consecutive failures — ` +
        `check credentials/bucket before the next run`,
    )
    return summary // cleanup would hammer the same broken backend
  }

  await cleanOrphanedMirrors(db, store, summary)
  return summary
}

/** Upstream dropped a vehicle's image: clear the key and remove the object so
    the site never keeps serving imagery the source retracted. */
async function cleanOrphanedMirrors(
  db: Db,
  store: AssetStore,
  summary: MirrorSummary,
) {
  const orphaned = await db
    .select({
      id: schema.vehicles.id,
      externalId: schema.vehicles.externalId,
      imageKey: schema.vehicles.imageKey,
    })
    .from(schema.vehicles)
    .where(
      and(
        isNull(schema.vehicles.imageUrl),
        isNotNull(schema.vehicles.imageKey),
      ),
    )
  for (const v of orphaned) {
    try {
      await store.delete('assets', v.imageKey!)
      await db
        .update(schema.vehicles)
        .set({ imageKey: null })
        .where(eq(schema.vehicles.id, v.id))
      summary.cleaned += 1
    } catch (error) {
      summary.failed += 1
      summary.warnings.push(
        `cleanup failed for ${v.externalId}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
}
