import process from 'node:process'
import { isLocalDatabaseUrl, openCliDb } from '#/db/cli'
import { DatamineSource } from '#/catalog/datamine'
import { syncCatalog } from '#/catalog/sync'
import { mirrorVehiclePortraits } from '#/catalog/mirror-portraits'
import { headerSafeGitHubToken } from '#/catalog/upstream-fetch'
import { recordCatalogSyncRun } from '#/catalog/sync-status'
import { storageFromEnvIfConfigured } from '#/storage/r2'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const dryRun = process.argv.includes('--dry-run')
const mirrorLimitArg = process.argv
  .find((a) => a.startsWith('--mirror-limit='))
  ?.split('=')[1]
const mirrorLimit =
  mirrorLimitArg === undefined ? undefined : Number(mirrorLimitArg)
if (
  mirrorLimit !== undefined &&
  (mirrorLimitArg === '' || !Number.isInteger(mirrorLimit) || mirrorLimit < 0)
) {
  throw new Error(
    `--mirror-limit must be a non-negative integer, got "${mirrorLimitArg}"`,
  )
}

// Slug assignment is first-run-wins on a live catalog, so a stray remote
// DATABASE_URL must not sync by accident (the cron image opts in).
if (
  !isLocalDatabaseUrl(url) &&
  !dryRun &&
  process.env.CATALOG_SYNC_REMOTE !== '1'
) {
  throw new Error(
    'Refusing to sync a non-local database. Set CATALOG_SYNC_REMOTE=1 to override.',
  )
}

const rawToken = process.env.CATALOG_GITHUB_TOKEN
const githubToken = headerSafeGitHubToken(rawToken)
if (!githubToken) {
  // "set but empty" is its own state: telling an operator who did set the
  // variable that it is unset sends them looking in the wrong place.
  const state =
    rawToken === undefined
      ? 'not set'
      : rawToken.trim() === ''
        ? 'set but empty'
        : 'not a usable header value'
  console.warn(
    `⚠ CATALOG_GITHUB_TOKEN is ${state} — reading GitHub anonymously, on a` +
      ' 60 requests/hour budget shared with everything else on this IP.',
  )
}

const source = new DatamineSource({
  unitsCsvUrl: process.env.WT_UNITS_CSV_URL,
  githubToken,
})

// The DB handle is opened before the fetch (postgres-js connects lazily) so an
// upstream failure still has somewhere to leave its reason for the watchdog.
const { db, close } = openCliDb(url)
try {
  console.log(`Fetching catalog snapshot from ${source.name}…`)
  const snapshot = await source.fetchSnapshot()
  console.log(
    `Snapshot: ${snapshot.vehicles.length} vehicles @ game version ${snapshot.gameVersion}`,
  )

  const summary = await syncCatalog(db, snapshot, { dryRun })

  for (const warning of summary.warnings) console.warn(`⚠ ${warning}`)
  const summaryLine =
    `Patch ${summary.patch}: ${summary.inserted} inserted, ` +
    `${summary.updated} updated, ${summary.removed} removed, ` +
    `${summary.restored} restored, ${summary.brRows} BR rows, ` +
    `${summary.skippedNoMode} skipped (no mode plays their branch).`
  console.log(summaryLine)

  // A dry run rolled itself back; recording it would fake freshness. Never fatal
  // either: the sync is committed, and the watchdog alarms on a missing row.
  if (!dryRun) {
    await recordCatalogSyncRun(db, { ok: true, detail: summaryLine }).catch(
      (e: unknown) =>
        console.error('⚠ could not record the successful run:', e),
    )
  }

  const storage = dryRun ? undefined : storageFromEnvIfConfigured()
  if (dryRun) {
    console.log(
      'Dry run — transaction rolled back; portrait mirroring skipped.',
    )
  } else if (!storage) {
    console.log('Portrait mirroring skipped (R2_* env not configured).')
  } else {
    // Best-effort by contract: the sync committed, so nothing from the mirror
    // pass may turn this run into a failure.
    try {
      const mirror = await mirrorVehiclePortraits(db, storage, {
        limit: mirrorLimit,
        githubToken,
      })
      for (const warning of mirror.warnings) console.warn(`⚠ ${warning}`)
      console.log(
        `Portraits: ${mirror.mirrored} mirrored, ${mirror.upToDate} up to date, ` +
          `${mirror.failed} failed, ${mirror.deferred} deferred.`,
      )
    } catch (error) {
      console.warn(
        `⚠ portrait mirroring failed: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
} catch (error) {
  if (!dryRun) {
    // Bookkeeping must never mask the real failure — log it and rethrow.
    await recordCatalogSyncRun(db, {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }).catch((e: unknown) =>
      console.error('⚠ could not record the failed run:', e),
    )
  }
  throw error
} finally {
  await close()
}
