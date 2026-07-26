import { desc, eq } from 'drizzle-orm'
import type { Db } from '#/db'
import { one } from '#/db/rows'
import { catalogSyncRuns } from '#/db/schema'

export interface CatalogSyncRun {
  finishedAt: Date
  ok: boolean
  detail: string | null
}

export interface CatalogSyncStatus {
  lastSuccessAt: Date | null
  /** Catalog staleness: seconds since the last *successful* sync. */
  ageSeconds: number | null
  /** The most recent attempt, successful or not — the alert's triage context. */
  lastRun: CatalogSyncRun | null
}

export const DETAIL_MAX = 500

export async function recordCatalogSyncRun(
  db: Db,
  run: { ok: boolean; detail?: string | null; finishedAt?: Date },
): Promise<void> {
  await db.insert(catalogSyncRuns).values({
    ok: run.ok,
    detail: run.detail?.slice(0, DETAIL_MAX) ?? null,
    ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
  })
}

export async function readCatalogSyncStatus(
  db: Db,
  now: Date = new Date(),
): Promise<CatalogSyncStatus> {
  const lastRun = one(
    await db
      .select({
        finishedAt: catalogSyncRuns.finishedAt,
        ok: catalogSyncRuns.ok,
        detail: catalogSyncRuns.detail,
      })
      .from(catalogSyncRuns)
      .orderBy(desc(catalogSyncRuns.finishedAt))
      .limit(1),
  )

  const lastSuccess = lastRun?.ok
    ? lastRun
    : one(
        await db
          .select({ finishedAt: catalogSyncRuns.finishedAt })
          .from(catalogSyncRuns)
          .where(eq(catalogSyncRuns.ok, true))
          .orderBy(desc(catalogSyncRuns.finishedAt))
          .limit(1),
      )

  const lastSuccessAt = lastSuccess?.finishedAt ?? null
  return {
    lastSuccessAt,
    ageSeconds: lastSuccessAt
      ? Math.floor((now.getTime() - lastSuccessAt.getTime()) / 1000)
      : null,
    lastRun,
  }
}
