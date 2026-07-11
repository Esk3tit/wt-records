import process from 'node:process'
import { migrationConfig, modeFromArgv } from '#/migration/config'
import { extract } from '#/migration/extract'
import { ImgurResolver } from '#/migration/imgur'
import {
  artifactPaths,
  writeArtifact,
  writeJsonArtifact,
} from '#/migration/artifacts'

const mode = modeFromArgv(process.argv)
const throttleArg = process.argv
  .find((a) => a.startsWith('--imgur-throttle-ms='))
  ?.split('=')[1]
const throttleMs = throttleArg === undefined ? undefined : Number(throttleArg)
if (
  throttleMs !== undefined &&
  (throttleArg === '' || !Number.isInteger(throttleMs) || throttleMs < 0)
) {
  throw new Error(
    `--imgur-throttle-ms must be a non-negative integer, got "${throttleArg}"`,
  )
}

const apiKey = process.env.GOOGLE_SHEETS_API_KEY
if (!apiKey) throw new Error('GOOGLE_SHEETS_API_KEY is not set')

const config = migrationConfig(mode)
const paths = artifactPaths(mode)
const resolver = new ImgurResolver({
  cacheDir: paths.imgurCacheDir,
  throttleMs,
})

console.log(
  `Extracting ${mode.toUpperCase()} from spreadsheet ${config.spreadsheetId}…`,
)
const result = await extract(config, {
  sheets: { apiKey },
  resolver,
  log: (message) => console.log(message),
})

writeJsonArtifact(paths.snapshot, result.snapshot)
writeArtifact(paths.findings, result.findings)
console.log(
  `Snapshot: ${result.snapshot.rows.length} rows, ` +
    `${Object.keys(result.snapshot.imgur).length} imgur posts ` +
    `(${resolver.networkFetches} fetched, rest from cache) → ${paths.snapshot}`,
)
console.log(`Findings → ${paths.findings}`)

if (result.problems.length > 0) {
  for (const p of result.problems) console.warn(`⚠ ${p}`)
  console.error(
    `FAIL ${result.problems.length} problem(s) — see ${paths.findings}`,
  )
  process.exit(1)
}
console.log('Extraction clean.')
