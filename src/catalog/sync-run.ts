import process from 'node:process'
import { openCliDb } from '#/db/cli'
import { WtVehiclesApiSource } from '#/catalog/wt-vehicles-api'
import { syncCatalog } from '#/catalog/sync'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const dryRun = process.argv.includes('--dry-run')

// Slug assignment is first-run-wins on a live catalog, so a stray remote
// DATABASE_URL must not sync by accident (the cron image opts in).
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)
if (!isLocal && !dryRun && process.env.CATALOG_SYNC_REMOTE !== '1') {
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
  if (dryRun) console.log('Dry run — transaction rolled back.')
} finally {
  await close()
}
