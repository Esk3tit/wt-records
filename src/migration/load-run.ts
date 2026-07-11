import process from 'node:process'
import { openCliDb } from '#/db/cli'
import { migrationConfig } from '#/migration/config'
import { loadMigration } from '#/migration/load'
import type { MigrationResolution } from '#/migration/resolve'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'
import { artifactPaths, readJsonArtifact } from '#/migration/artifacts'
import { storageFromEnvIfConfigured } from '#/storage/r2'

const mode =
  process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'grb'
const dryRun = process.argv.includes('--dry-run')
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

migrationConfig(mode)

// The load wipes and replaces players/records; a stray remote DATABASE_URL
// must never do that by accident (the prod run opts in explicitly).
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)
if (!isLocal && !dryRun && process.env.IMPORT_LOAD_REMOTE !== '1') {
  throw new Error(
    'Refusing to load into a non-local database. Set IMPORT_LOAD_REMOTE=1 to override.',
  )
}

const paths = artifactPaths(mode)
const resolution = readJsonArtifact<MigrationResolution>(paths.resolution)
const rules = readJsonArtifact<MigrationRules>(paths.rules)
const patches = readJsonArtifact<Array<PatchBackfillEntry>>(paths.patches)
if (resolution.mode !== mode) {
  throw new Error(
    `Resolution artifact is for mode "${resolution.mode}", not "${mode}"`,
  )
}

const storage = dryRun ? undefined : storageFromEnvIfConfigured()
if (!dryRun && !storage) {
  if (isLocal) {
    console.warn('⚠ R2_* env not configured — proofs keep original URLs only.')
  } else {
    // The migration's promise is that nothing depends on imgur afterwards.
    throw new Error(
      'Refusing a remote load without R2 credentials — proof mirroring is not optional in production.',
    )
  }
}

const { db, close } = openCliDb(url)
try {
  const summary = await loadMigration(
    db,
    resolution,
    rules,
    patches,
    {
      store: storage ?? null,
      manifestPath: paths.mirrorManifest,
      log: (message) => console.log(message),
    },
    { dryRun },
  )
  for (const warning of summary.warnings) console.warn(`⚠ ${warning}`)
  console.log(
    `${summary.players} players, ${summary.records} records, ${summary.proofs} proofs ` +
      `(wiped ${summary.wipedPlayers} players, ${summary.wipedRecords} records). ` +
      `Images: ${summary.mirrored} mirrored, ${summary.mirrorReused} reused, ` +
      `${summary.mirrorSkipped} skipped. Patches upserted: ${summary.patchesUpserted}, ` +
      `difficult vehicles flagged: ${summary.difficultFlagged}.`,
  )
  console.log(dryRun ? 'Dry run — transaction rolled back.' : 'Load committed.')
} finally {
  await close()
}
