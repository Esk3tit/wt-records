import process from 'node:process'
import { openCliDb } from '#/db/cli'
import { migrationConfig, modeFromArgv } from '#/migration/config'
import type { MigrationSnapshot } from '#/migration/extract'
import { loadCatalogVehicles } from '#/migration/catalog'
import type { MigrationOverrides } from '#/migration/resolve'
import { resolve } from '#/migration/resolve'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'
import { CANONICAL_MODES } from '#/db/modes'
import {
  artifactPaths,
  readJsonArtifact,
  readJsonArtifactIfExists,
  writeArtifact,
  writeJsonArtifact,
} from '#/migration/artifacts'

const mode = modeFromArgv(process.argv)
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

migrationConfig(mode)
const branch = CANONICAL_MODES.find((m) => m.mode === mode)?.branch
if (!branch) throw new Error(`No canonical mode "${mode}"`)

const paths = artifactPaths(mode)
const snapshot = readJsonArtifact<MigrationSnapshot>(paths.snapshot)
const patches = readJsonArtifact<Array<PatchBackfillEntry>>(paths.patches)
const rules = readJsonArtifact<MigrationRules>(paths.rules)
const overrides =
  readJsonArtifactIfExists<MigrationOverrides>(paths.overrides) ?? {}

const { db, close } = openCliDb(url)
let vehicles
try {
  vehicles = await loadCatalogVehicles(db, branch)
} finally {
  await close()
}
if (vehicles.length === 0) {
  throw new Error('The catalog is empty — run catalog:sync before resolving.')
}
console.log(
  `Resolving ${snapshot.rows.length} rows against ${vehicles.length} ${branch} vehicles…`,
)

const { resolution, review } = resolve({
  snapshot,
  vehicles,
  patches,
  rules,
  overrides,
})

writeJsonArtifact(paths.resolution, resolution)
writeArtifact(paths.review, review)
console.log(`Resolution → ${paths.resolution}`)
console.log(`Review → ${paths.review}`)

const blocked =
  resolution.unresolvedRows + resolution.unresolvedDifficult.length
if (blocked > 0) {
  console.error(
    `FAIL ${resolution.unresolvedRows} blocked row(s), ` +
      `${resolution.unresolvedDifficult.length} unresolved difficult vehicle(s) — see ${paths.review}`,
  )
  process.exit(1)
}
console.log('Fully resolved — ready for Load.')
