import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import * as schema from '#/db/schema'
import { portraitObjectKey } from '#/catalog/portrait-key'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import { RASTER_IMAGE_CONTENT_TYPES } from '#/storage/image-types'
import type { Storage } from '#/storage/r2'

type AssetStore = Pick<Storage, 'put' | 'delete'>

// A systemic failure (revoked token, dead bucket) must not download the whole
// catalog before anyone notices — stop the run after this many failures in a row.
const MAX_CONSECUTIVE_FAILURES = 20

export interface MirrorOptions {
  /** Mirror at most this many portraits this run (backfill throttle). */
  limit?: number
  concurrency?: number
  fetchImpl?: typeof fetch
  /** Total fetch attempts per portrait, including the first. */
  maxAttempts?: number
  retryDelayMs?: number
  githubToken?: string
}

export interface MirrorSummary {
  mirrored: number
  upToDate: number
  failed: number
  /** Candidates beyond `limit` left for a later run. */
  deferred: number
  warnings: Array<string>
}

interface Candidate {
  id: number
  externalId: string
  portraitUrl: string
  portraitKey: string | null
  wantKey: string
}

/** Best-effort, idempotent mirror of catalog Portraits into the assets bucket.
    Runs outside the sync transaction: a mirror failure must never fail a sync. */
export async function mirrorVehiclePortraits(
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
    warnings: [],
  }

  // Ground first: record pages need their portraits before anything else,
  // and the upstream rate limit means each run only mirrors a slice.
  const withPortrait = await db
    .select({
      id: schema.vehicles.id,
      externalId: schema.vehicles.externalId,
      portraitUrl: schema.vehicles.portraitUrl,
      portraitContentId: schema.vehicles.portraitContentId,
      portraitKey: schema.vehicles.portraitKey,
    })
    .from(schema.vehicles)
    // A url without a content id is a vehicle the snapshot no longer carries,
    // so upstream's current bytes are unknowable — leave the copy we hold.
    .where(
      and(
        isNotNull(schema.vehicles.portraitUrl),
        isNotNull(schema.vehicles.portraitContentId),
      ),
    )
    .orderBy(sql`${schema.vehicles.branch} = 'ground' desc`, schema.vehicles.id)

  const stale: Array<Candidate> = []
  for (const v of withPortrait) {
    const portraitUrl = v.portraitUrl!
    let wantKey: string
    try {
      wantKey = portraitObjectKey(
        v.externalId,
        v.portraitContentId!,
        portraitUrl,
      )
    } catch {
      summary.failed += 1
      summary.warnings.push(
        `unusable portrait for ${v.externalId}: ${JSON.stringify(portraitUrl)}`,
      )
      continue
    }
    if (v.portraitKey === wantKey) summary.upToDate += 1
    else stale.push({ ...v, portraitUrl, wantKey })
  }
  const candidates =
    options.limit != null ? stale.slice(0, options.limit) : stale
  summary.deferred = stale.length - candidates.length

  let consecutiveFailures = 0

  async function mirrorOne(v: Candidate) {
    try {
      const res = await fetchUpstream(v.portraitUrl, {
        fetchImpl,
        timeoutMs: 30_000,
        maxAttempts: options.maxAttempts,
        retryDelayMs: options.retryDelayMs,
        githubToken: options.githubToken,
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
        .set({ portraitKey: v.wantKey })
        .where(eq(schema.vehicles.id, v.id))
      if (v.portraitKey) {
        // superseded artwork under the old content id; removal is tidy-up only
        await store.delete('assets', v.portraitKey).catch(() => {})
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
  }

  // Nothing collects a key whose url went away — retention is the point.
  return summary
}
