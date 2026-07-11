import process from 'node:process'
import { isLocalDatabaseUrl, openCliDb } from '#/db/cli'
import { WtVehiclesApiSource } from '#/catalog/wt-vehicles-api'
import { syncCatalog } from '#/catalog/sync'
import { mirrorVehicleImages } from '#/catalog/mirror-images'
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

const source = new WtVehiclesApiSource({
  apiBaseUrl: process.env.WT_VEHICLES_API_URL,
  unitsCsvUrl: process.env.WT_UNITS_CSV_URL,
})

console.log(`Fetching catalog snapshot from ${source.name}…`)
const snapshot = await source.fetchSnapshot()
console.log(
  `Snapshot: ${snapshot.vehicles.length} vehicles @ game version ${snapshot.gameVersion}`,
)

const { db, close } = openCliDb(url)
try {
  const summary = await syncCatalog(db, snapshot, { dryRun })

  for (const warning of summary.warnings) console.warn(`⚠ ${warning}`)
  console.log(
    `Patch ${summary.patch}: ${summary.inserted} inserted, ` +
      `${summary.updated} updated, ${summary.removed} removed, ` +
      `${summary.restored} restored, ${summary.brRows} BR rows, ` +
      `${summary.skippedNoMode} skipped (no mode plays their branch).`,
  )
  const storage = dryRun ? undefined : storageFromEnvIfConfigured()
  if (dryRun) {
    console.log('Dry run — transaction rolled back; image mirroring skipped.')
  } else if (!storage) {
    console.log('Image mirroring skipped (R2_* env not configured).')
  } else {
    // Best-effort by contract: the sync committed, so nothing from the mirror
    // pass may turn this run into a failure.
    try {
      const mirror = await mirrorVehicleImages(db, storage, {
        limit: mirrorLimit,
      })
      for (const warning of mirror.warnings) console.warn(`⚠ ${warning}`)
      console.log(
        `Images: ${mirror.mirrored} mirrored, ${mirror.upToDate} up to date, ` +
          `${mirror.failed} failed, ${mirror.deferred} deferred, ` +
          `${mirror.cleaned} cleaned.`,
      )
    } catch (error) {
      console.warn(
        `⚠ image mirroring failed: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
} finally {
  await close()
}
