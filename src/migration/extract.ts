import type { MigrationModeConfig } from '#/migration/config'
import type { RawRow, SheetsClientOptions } from '#/migration/sheets'
import { fetchTabGrid, parseNationTab } from '#/migration/sheets'
import type { ImgurResolver, ResolvedImgurPost } from '#/migration/imgur'
import { classifyProofUrl } from '#/migration/imgur'

export interface SnapshotCrossChecks {
  leaderboardTotal: number | null
  dataSheetDistinctPlayers: number | null
}

/** Everything Extract learned, verbatim — the permanent provenance record.
    Later stages never talk to the sheet or imgur again. */
export interface MigrationSnapshot {
  mode: string
  spreadsheetId: string
  extractedAt: string
  rows: Array<RawRow>
  /** Resolved imgur posts keyed by post id. */
  imgur: Record<string, ResolvedImgurPost>
  crossChecks: SnapshotCrossChecks
}

export interface ExtractResult {
  snapshot: MigrationSnapshot
  /** Structural surprises that must be looked at before trusting the run. */
  problems: Array<string>
  findings: string
}

export interface ExtractDeps {
  sheets: SheetsClientOptions
  resolver: ImgurResolver
  now?: () => Date
  log?: (message: string) => void
}

export async function extract(
  config: MigrationModeConfig,
  deps: ExtractDeps,
): Promise<ExtractResult> {
  const log = deps.log ?? (() => {})
  const problems: Array<string> = []
  const rows: Array<RawRow> = []

  for (const [tab, nation] of Object.entries(config.nationTabs)) {
    const grid = await fetchTabGrid(config.spreadsheetId, tab, deps.sheets)
    const parsed = parseNationTab(tab, nation, grid)
    rows.push(...parsed.rows)
    problems.push(...parsed.problems)
    log(`${tab}: ${parsed.rows.length} rows`)
  }

  const crossChecks = await fetchCrossChecks(config, deps.sheets)
  runCrossChecks(rows, crossChecks, problems)

  const imgur: Record<string, ResolvedImgurPost> = {}
  const imgurIds = new Set<string>()
  for (const row of rows) {
    for (const proof of row.proofs) {
      const classified = classifyProofUrl(proof.url)
      if (classified.kind === 'unknown') {
        problems.push(
          `${row.tab} row ${row.rowNumber}: unrecognized proof URL ${proof.url}`,
        )
      } else if (classified.imgurId) {
        imgurIds.add(classified.imgurId)
      }
    }
  }

  log(`Resolving ${imgurIds.size} imgur posts…`)
  let done = 0
  for (const id of imgurIds) {
    imgur[id] = await deps.resolver.resolve(id)
    done += 1
    if (done % 100 === 0) log(`  ${done}/${imgurIds.size}`)
  }

  const snapshot: MigrationSnapshot = {
    mode: config.mode,
    spreadsheetId: config.spreadsheetId,
    extractedAt: (deps.now ?? (() => new Date()))().toISOString(),
    rows,
    imgur,
    crossChecks,
  }

  return { snapshot, problems, findings: buildFindings(snapshot, problems) }
}

async function fetchCrossChecks(
  config: MigrationModeConfig,
  sheets: SheetsClientOptions,
): Promise<SnapshotCrossChecks> {
  const leaderboard = await fetchTabGrid(
    config.spreadsheetId,
    config.leaderboardTab,
    sheets,
  )
  let leaderboardTotal: number | null = null
  for (const row of leaderboard) {
    const labelIndex = row.findIndex((c) => c.value === 'Number of Records:')
    const value = labelIndex >= 0 ? row[labelIndex + 1]?.value : null
    if (value && Number.isInteger(Number(value))) {
      leaderboardTotal = Number(value)
      break
    }
  }

  const dataSheet = await fetchTabGrid(
    config.spreadsheetId,
    config.dataSheetTab,
    sheets,
  )
  // Column A lists every player once, below the 4 aggregate header rows.
  const names = new Set<string>()
  for (const row of dataSheet.slice(4)) {
    const name = row[0]?.value
    if (name) names.add(name)
  }
  return {
    leaderboardTotal,
    dataSheetDistinctPlayers: names.size > 0 ? names.size : null,
  }
}

function runCrossChecks(
  rows: Array<RawRow>,
  crossChecks: SnapshotCrossChecks,
  problems: Array<string>,
): void {
  if (crossChecks.leaderboardTotal === null) {
    problems.push('cross-check: could not read the Leaderboard record total')
  } else if (crossChecks.leaderboardTotal !== rows.length) {
    problems.push(
      `cross-check: extracted ${rows.length} rows but the Leaderboard declares ${crossChecks.leaderboardTotal}`,
    )
  }
  const distinctPlayers = new Set(rows.map((r) => r.playerName)).size
  if (crossChecks.dataSheetDistinctPlayers === null) {
    problems.push('cross-check: could not read the DataSheet player list')
  } else if (crossChecks.dataSheetDistinctPlayers !== distinctPlayers) {
    problems.push(
      `cross-check: extracted ${distinctPlayers} distinct players but the DataSheet lists ${crossChecks.dataSheetDistinctPlayers}`,
    )
  }
}

function histogram(values: Array<string>): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function proofHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'unparseable'
  }
}

export function buildFindings(
  snapshot: MigrationSnapshot,
  problems: Array<string>,
): string {
  const { rows, imgur } = snapshot
  const lines: Array<string> = []
  const players = new Set(rows.map((r) => r.playerName))
  const proofs = rows.flatMap((r) => r.proofs)
  const deadPosts = Object.values(imgur).filter((p) => p.status === 'dead')
  const rowsWithoutProof = rows.filter((r) => r.proofs.length === 0)
  const rowIsImageless = (r: RawRow) =>
    r.proofs.length > 0 &&
    r.proofs.every((p) => classifyProofUrl(p.url).kind === 'video')
  const videoOnlyRows = rows.filter(rowIsImageless)
  const deadIds = new Set(deadPosts.map((p) => p.id))
  const deadProofRows = rows.filter((r) =>
    r.proofs.some((p) => {
      const c = classifyProofUrl(p.url)
      return c.imgurId !== undefined && deadIds.has(c.imgurId)
    }),
  )

  lines.push(`# ${snapshot.mode.toUpperCase()} extraction findings`)
  lines.push('')
  lines.push(
    `Extracted ${snapshot.extractedAt} from spreadsheet \`${snapshot.spreadsheetId}\`.`,
  )
  lines.push('')
  lines.push(
    `- Rows: **${rows.length}** (Leaderboard declares ${snapshot.crossChecks.leaderboardTotal ?? 'unknown'})`,
  )
  lines.push(
    `- Distinct players: **${players.size}** (DataSheet declares ${snapshot.crossChecks.dataSheetDistinctPlayers ?? 'unknown'})`,
  )
  lines.push(
    `- Proof links: ${proofs.length}; imgur posts resolved: ${Object.keys(imgur).length} (${deadPosts.length} dead)`,
  )
  lines.push(`- Rows with no proof link: ${rowsWithoutProof.length}`)
  lines.push(`- Rows with video-only proof: ${videoOnlyRows.length}`)
  lines.push(`- Rows touching a dead imgur post: ${deadProofRows.length}`)
  lines.push('')

  lines.push('## Rows per tab')
  lines.push('')
  for (const [tab, count] of histogram(rows.map((r) => r.tab))) {
    lines.push(`- ${tab}: ${count}`)
  }
  lines.push('')

  lines.push('## Proof hosts')
  lines.push('')
  for (const [host, count] of histogram(proofs.map((p) => proofHost(p.url)))) {
    lines.push(`- ${host}: ${count}`)
  }
  lines.push('')

  lines.push('## Distinct patch strings')
  lines.push('')
  const patchHistogram = histogram(rows.map((r) => r.patch)).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true }),
  )
  for (const [patch, count] of patchHistogram) {
    lines.push(`- ${patch}: ${count}`)
  }
  lines.push('')

  if (deadPosts.length > 0) {
    lines.push('## Dead imgur posts')
    lines.push('')
    for (const post of deadPosts) {
      lines.push(`- ${post.id} (HTTP ${post.httpStatus ?? '?'})`)
    }
    lines.push('')
  }

  if (rowsWithoutProof.length > 0 || videoOnlyRows.length > 0) {
    lines.push('## Proof gaps')
    lines.push('')
    for (const r of rowsWithoutProof) {
      lines.push(
        `- ${r.tab} row ${r.rowNumber} (${r.vehicleName}, ${r.playerName}): no proof link`,
      )
    }
    for (const r of videoOnlyRows) {
      lines.push(
        `- ${r.tab} row ${r.rowNumber} (${r.vehicleName}, ${r.playerName}): video-only proof`,
      )
    }
    lines.push('')
  }

  lines.push('## Problems')
  lines.push('')
  if (problems.length === 0) {
    lines.push('None — extraction was clean.')
  } else {
    for (const p of problems) lines.push(`- ${p}`)
  }

  return `${lines.join('\n')}\n`
}
