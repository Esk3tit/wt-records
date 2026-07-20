import { slugify } from '#/lib/slug'
import type { MigrationSnapshot } from '#/migration/extract'
import type { RawRow } from '#/migration/sheets'
import type { CatalogVehicle, MatchResult } from '#/migration/match'
import { matchDifficultVehicle, matchVehicle } from '#/migration/match'
import { classifyProofUrl } from '#/migration/imgur'
import { RASTER_IMAGE_EXTENSIONS } from '#/storage/image-types'
import type { MigrationRules, PatchBackfillEntry } from '#/migration/rules'

export type ProofKind = 'scoreboard' | 'end_game' | 'end_life' | 'video'

export interface ResolvedProof {
  kind: ProofKind
  originalUrl: string
  /** Set for live imgur images — Load mirrors these to R2. */
  mirror?: { imgurId: string; mediaId: string; ext: string }
  /** The album link is dead; the proof survives as its original URL only. */
  dead?: boolean
}

export interface ResolvedRow {
  rowKey: string
  tab: string
  rowNumber: number
  nation: string
  vehicleName: string
  playerName: string
  kills: number
  br: number | null
  vehicleExternalId: string | null
  vehicleMatch: 'exact' | 'fuzzy' | 'override' | null
  patch: string | null
  isCurrent: boolean
  submittedAt: string
  verifiedAt: string | null
  proofs: Array<ResolvedProof>
  /** Blocking issues — Load refuses while any row has one. */
  problems: Array<string>
}

export interface MigrationResolution {
  mode: string
  snapshotExtractedAt: string
  resolvedAt: string
  players: Array<{ name: string; slug: string }>
  difficultVehicles: Array<{ name: string; externalId: string }>
  /** Difficult-list entries that failed to match — block Load like row problems. */
  unresolvedDifficult: Array<string>
  rows: Array<ResolvedRow>
  unresolvedRows: number
}

export interface MigrationOverrides {
  $comment?: string
  /** `"<nation>:<sheet vehicle name>"` → catalog externalId. */
  vehicles?: Record<string, string>
  /** `"<tab>:<row>"` → row-level adjudications. */
  rows?: Record<
    string,
    { patch?: string; acceptDateContradiction?: boolean; note?: string }
  >
  /** Sheet player name → fixed slug. */
  players?: Record<string, { slug: string }>
  /** Difficult-list name → catalog externalId(s) — arrays cover the
      name-identical event/marketplace twins that must all be flagged. */
  difficultVehicles?: Record<string, string | Array<string>>
  /** Duplicate vehicle externalId → rowKey that keeps `is_current`. */
  duplicates?: Record<string, string>
}

export interface ResolveInput {
  snapshot: MigrationSnapshot
  vehicles: Array<CatalogVehicle>
  patches: Array<PatchBackfillEntry>
  rules: MigrationRules
  overrides: MigrationOverrides
  now?: () => Date
}

export interface ResolveResult {
  resolution: MigrationResolution
  review: string
}

const COLUMN_KIND: Record<RawRow['proofs'][number]['column'], ProofKind> = {
  screenshot: 'scoreboard',
  screenshot2: 'end_game',
  video: 'video',
}

function imgurPost(
  snapshot: MigrationSnapshot,
  id: string,
): MigrationSnapshot['imgur'][string] | undefined {
  return Object.hasOwn(snapshot.imgur, id) ? snapshot.imgur[id] : undefined
}

interface ReviewNotes {
  unmatchedVehicles: Map<string, { rows: Array<string>; result: MatchResult }>
  fuzzyMatches: Map<
    string,
    { matchedName: string; externalId: string; score: number }
  >
  overriddenVehicles: Array<string>
  patchProblems: Array<string>
  dateContradictions: Array<string>
  acceptedContradictions: Array<string>
  duplicateGroups: Array<string>
  playerNotes: Array<string>
  difficultLines: Array<string>
  proofGaps: Array<string>
  sharedProofs: Array<string>
}

/* One imgur post cited by rows of different players is almost always a
   copy-paste slip on the sheet — but one scoreboard CAN legitimately show
   two record runs from the same match, so this warns instead of blocking. */
function noteSharedProofs(rows: Array<ResolvedRow>, notes: ReviewNotes): void {
  const byPost = new Map<
    string,
    Array<{ rowKey: string; vehicleName: string; playerName: string }>
  >()
  for (const row of rows) {
    for (const proof of row.proofs) {
      // Classify the original URL so dead and non-raster citations count too.
      const imgurId =
        proof.mirror?.imgurId ?? classifyProofUrl(proof.originalUrl).imgurId
      if (!imgurId) continue
      const cited = byPost.get(imgurId) ?? []
      if (!cited.some((c) => c.rowKey === row.rowKey)) {
        cited.push({
          rowKey: row.rowKey,
          vehicleName: row.vehicleName,
          playerName: row.playerName,
        })
      }
      byPost.set(imgurId, cited)
    }
  }
  for (const [imgurId, cited] of byPost) {
    if (new Set(cited.map((c) => c.playerName)).size < 2) continue
    notes.sharedProofs.push(
      `imgur ${imgurId} cited by ${cited
        .map((c) => `${c.rowKey} (${c.vehicleName}, ${c.playerName})`)
        .join(' and ')}`,
    )
  }
}

export function resolve(input: ResolveInput): ResolveResult {
  const { snapshot, vehicles, patches, rules, overrides } = input
  const notes: ReviewNotes = {
    unmatchedVehicles: new Map(),
    fuzzyMatches: new Map(),
    overriddenVehicles: [],
    patchProblems: [],
    dateContradictions: [],
    acceptedContradictions: [],
    duplicateGroups: [],
    playerNotes: [],
    difficultLines: [],
    proofGaps: [],
    sharedProofs: [],
  }

  const byExternalId = new Map(vehicles.map((v) => [v.externalId, v]))
  const patchByVersion = new Map(patches.map((p) => [p.version, p]))

  const rows = snapshot.rows.map((raw) =>
    resolveRow(
      raw,
      snapshot,
      byExternalId,
      patchByVersion,
      vehicles,
      overrides,
      notes,
    ),
  )

  adjudicateDuplicates(rows, overrides, notes)
  noteSharedProofs(rows, notes)

  const players = planPlayers(snapshot.rows, overrides, notes)
  const difficultVehicles = resolveDifficultList(
    rules,
    vehicles,
    overrides,
    notes,
  )

  const resolution: MigrationResolution = {
    mode: snapshot.mode,
    snapshotExtractedAt: snapshot.extractedAt,
    resolvedAt: (input.now ?? (() => new Date()))().toISOString(),
    players,
    difficultVehicles: difficultVehicles.resolved,
    unresolvedDifficult: difficultVehicles.unresolved,
    rows,
    unresolvedRows: rows.filter((r) => r.problems.length > 0).length,
  }

  return {
    resolution,
    review: buildReview(resolution, notes, difficultVehicles.unresolved),
  }
}

function resolveRow(
  raw: RawRow,
  snapshot: MigrationSnapshot,
  byExternalId: Map<string, CatalogVehicle>,
  patchByVersion: Map<string, PatchBackfillEntry>,
  vehicles: Array<CatalogVehicle>,
  overrides: MigrationOverrides,
  notes: ReviewNotes,
): ResolvedRow {
  const rowKey = `${raw.tab}:${raw.rowNumber}`
  const problems: Array<string> = []
  const rowOverride = overrides.rows?.[rowKey]

  // Vehicle
  const vehicleOverride =
    overrides.vehicles?.[`${raw.nation}:${raw.vehicleName}`]
  let vehicleExternalId: string | null = null
  let vehicleMatch: ResolvedRow['vehicleMatch'] = null
  if (vehicleOverride) {
    if (byExternalId.has(vehicleOverride)) {
      vehicleExternalId = vehicleOverride
      vehicleMatch = 'override'
      notes.overriddenVehicles.push(
        `${raw.nation}:${raw.vehicleName} → ${vehicleOverride}`,
      )
    } else {
      problems.push(
        `vehicle override "${vehicleOverride}" is not in the catalog`,
      )
    }
  } else {
    const result = matchVehicle(raw.vehicleName, raw.nation, vehicles)
    if (result.matched) {
      vehicleExternalId = result.matched.externalId
      vehicleMatch = result.confidence
      if (result.confidence === 'fuzzy') {
        notes.fuzzyMatches.set(`${raw.nation}:${raw.vehicleName}`, {
          matchedName: result.matched.name,
          externalId: result.matched.externalId,
          score: result.candidates[0]?.score ?? 0,
        })
      }
    } else {
      problems.push('vehicle unmatched')
      const key = `${raw.nation}:${raw.vehicleName}`
      const entry = notes.unmatchedVehicles.get(key)
      if (entry) entry.rows.push(rowKey)
      else notes.unmatchedVehicles.set(key, { rows: [rowKey], result })
    }
  }

  // Patch
  const patchString = rowOverride?.patch ?? raw.patch
  const patchEntry = patchByVersion.get(patchString)
  let patch: string | null = null
  if (patchEntry) {
    patch = patchEntry.version
  } else {
    problems.push(`patch "${patchString}" is not in the patches backfill`)
    notes.patchProblems.push(`${rowKey}: "${patchString}"`)
  }

  // Proofs
  const proofs: Array<ResolvedProof> = []
  let earliestUpload: string | null = null
  for (const proof of raw.proofs) {
    const classified = classifyProofUrl(proof.url)
    const kind = COLUMN_KIND[proof.column]
    if (classified.kind === 'video') {
      proofs.push({ kind: 'video', originalUrl: proof.url })
      continue
    }
    if (classified.kind === 'unknown' || !classified.imgurId) {
      problems.push(`unrecognized proof URL ${proof.url}`)
      continue
    }
    const post = imgurPost(snapshot, classified.imgurId)
    if (!post) {
      problems.push(
        `imgur post ${classified.imgurId} missing from the snapshot`,
      )
      continue
    }
    if (post.status === 'dead') {
      proofs.push({ kind, originalUrl: proof.url, dead: true })
      continue
    }
    if (
      post.createdAt &&
      (!earliestUpload || post.createdAt < earliestUpload)
    ) {
      earliestUpload = post.createdAt
    }
    if (post.media.length === 0) {
      // Alive but emptied album — keep the link as provenance, like dead ones.
      proofs.push({ kind, originalUrl: proof.url })
      continue
    }
    // A mirrored raster is never kind 'video', even from the Video column.
    const imageKind = kind === 'video' ? 'scoreboard' : kind
    for (const media of post.media) {
      if (media.ext && RASTER_IMAGE_EXTENSIONS.has(media.ext)) {
        proofs.push({
          kind: imageKind,
          originalUrl: media.url,
          mirror: { imgurId: post.id, mediaId: media.id, ext: media.ext },
        })
      } else {
        // imgur-hosted mp4/webm etc. — kept external like other video proof
        proofs.push({ kind: 'video', originalUrl: media.url })
      }
    }
  }
  const hasEvidence = proofs.some(
    (p) => p.mirror !== undefined || (p.kind === 'video' && p.dead !== true),
  )
  if (!hasEvidence) {
    const why =
      raw.proofs.length === 0
        ? 'no proof link in the sheet'
        : proofs.length > 0 && proofs.every((p) => p.dead)
          ? 'all proof links dead'
          : 'no usable image behind the proof links'
    notes.proofGaps.push(
      `${rowKey} (${raw.vehicleName}, ${raw.playerName}): ${why}`,
    )
  }

  // Dates: proof upload time is the historical approval approximation.
  const submittedAt = earliestUpload ?? snapshot.extractedAt
  const verifiedAt = earliestUpload
  if (earliestUpload && patchEntry) {
    if (earliestUpload < patchEntry.releasedAt) {
      const detail =
        `proof uploaded ${earliestUpload.slice(0, 10)} but patch ` +
        `${patchEntry.version} released ${patchEntry.releasedAt.slice(0, 10)}`
      if (rowOverride?.acceptDateContradiction) {
        notes.acceptedContradictions.push(`${rowKey}: ${detail}`)
      } else {
        problems.push(`date contradiction: ${detail}`)
        notes.dateContradictions.push(
          `${rowKey} (${raw.vehicleName}, ${raw.playerName}): ${detail}`,
        )
      }
    }
  }

  return {
    rowKey,
    tab: raw.tab,
    rowNumber: raw.rowNumber,
    nation: raw.nation,
    vehicleName: raw.vehicleName,
    playerName: raw.playerName,
    kills: raw.kills,
    br: raw.br,
    vehicleExternalId,
    vehicleMatch,
    patch,
    isCurrent: true,
    submittedAt,
    verifiedAt,
    proofs,
    problems,
  }
}

/* The record for a vehicle is by definition the highest kill count; ties fall
   back to the later proof upload, then to a human override. */
function adjudicateDuplicates(
  rows: Array<ResolvedRow>,
  overrides: MigrationOverrides,
  notes: ReviewNotes,
): void {
  const groups = new Map<string, Array<ResolvedRow>>()
  for (const row of rows) {
    if (!row.vehicleExternalId) continue
    const group = groups.get(row.vehicleExternalId)
    if (group) group.push(row)
    else groups.set(row.vehicleExternalId, [row])
  }
  for (const [externalId, group] of groups) {
    if (group.length < 2) continue
    const overrideRowKey = overrides.duplicates?.[externalId]
    let current: ResolvedRow | null = null
    if (overrideRowKey) {
      current = group.find((r) => r.rowKey === overrideRowKey) ?? null
      if (!current) {
        for (const row of group) {
          row.problems.push(
            `duplicate override for ${externalId} names unknown row "${overrideRowKey}"`,
          )
        }
      }
    } else {
      const ranked = [...group].sort(
        (a, b) =>
          b.kills - a.kills ||
          (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? ''),
      )
      const top = ranked[0]
      const runnerUp = ranked.at(1)
      const tied =
        runnerUp !== undefined &&
        top.kills === runnerUp.kills &&
        (top.verifiedAt ?? '') === (runnerUp.verifiedAt ?? '')
      if (tied) {
        for (const row of group) {
          row.problems.push(
            `duplicate tie for ${externalId} — adjudicate via overrides.duplicates`,
          )
        }
      } else {
        current = top
      }
    }
    for (const row of group) row.isCurrent = row === current
    notes.duplicateGroups.push(
      `${externalId}: ${group
        .map(
          (r) =>
            `${r.rowKey} (${r.kills} kills${r.isCurrent ? ', current' : ''})`,
        )
        .join(' vs ')}${overrideRowKey ? ' [override]' : ''}`,
    )
  }
}

function planPlayers(
  rawRows: Array<RawRow>,
  overrides: MigrationOverrides,
  notes: ReviewNotes,
): Array<{ name: string; slug: string }> {
  const taken = new Set<string>()
  const players: Array<{ name: string; slug: string }> = []
  const seen = new Set<string>()
  for (const row of rawRows) {
    if (seen.has(row.playerName)) continue
    seen.add(row.playerName)
    const override = overrides.players?.[row.playerName]?.slug
    let slug = override ?? slugify(row.playerName)
    if (!slug) {
      slug = 'player'
      notes.playerNotes.push(
        `"${row.playerName}" has no slugifiable characters — assigned "${slug}" + counter (override via overrides.players)`,
      )
    }
    if (taken.has(slug)) {
      const base = slug
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
      notes.playerNotes.push(
        `"${row.playerName}" collided on "${base}" — assigned "${slug}"`,
      )
    }
    taken.add(slug)
    players.push({ name: row.playerName, slug })
  }
  return players
}

function resolveDifficultList(
  rules: MigrationRules,
  vehicles: Array<CatalogVehicle>,
  overrides: MigrationOverrides,
  notes: ReviewNotes,
): {
  resolved: Array<{ name: string; externalId: string }>
  unresolved: Array<string>
} {
  const resolved: Array<{ name: string; externalId: string }> = []
  const unresolved: Array<string> = []
  const byExternalId = new Map(vehicles.map((v) => [v.externalId, v]))
  for (const entry of rules.difficultVehicles) {
    const override = overrides.difficultVehicles?.[entry.name]
    if (override) {
      const externalIds = Array.isArray(override) ? override : [override]
      const missing = externalIds.filter((id) => !byExternalId.has(id))
      if (missing.length === 0) {
        for (const externalId of externalIds) {
          resolved.push({ name: entry.name, externalId })
        }
        notes.difficultLines.push(
          `${entry.name} → ${externalIds.join(', ')} [override]`,
        )
      } else {
        unresolved.push(
          `${entry.name}: override "${missing.join(', ')}" is not in the catalog`,
        )
      }
      continue
    }
    const result = matchDifficultVehicle(entry.name, entry.nation, vehicles)
    if (result.matched) {
      resolved.push({ name: entry.name, externalId: result.matched.externalId })
      notes.difficultLines.push(
        `${entry.name} → ${result.matched.name} (${result.matched.externalId}, ${result.confidence})`,
      )
    } else {
      unresolved.push(
        `${entry.name}: unmatched — candidates ${formatCandidates(result)} (override via overrides.difficultVehicles)`,
      )
    }
  }
  return { resolved, unresolved }
}

function formatCandidates(result: MatchResult): string {
  if (result.candidates.length === 0) return 'none'
  return result.candidates
    .map((c) => `${c.name} (${c.externalId}, ${c.score})`)
    .join(', ')
}

function buildReview(
  resolution: MigrationResolution,
  notes: ReviewNotes,
  unresolvedDifficult: Array<string>,
): string {
  const lines: Array<string> = []
  const blockedRows = resolution.rows.filter((r) => r.problems.length > 0)

  lines.push(`# ${resolution.mode.toUpperCase()} resolution review`)
  lines.push('')
  lines.push(
    `Resolved ${resolution.resolvedAt} from the ${resolution.snapshotExtractedAt} snapshot.`,
  )
  lines.push('')
  lines.push(
    `- Rows: ${resolution.rows.length}, blocked: **${resolution.unresolvedRows}**`,
  )
  lines.push(`- Players: ${resolution.players.length}`)
  lines.push(
    `- Difficult vehicles: ${resolution.difficultVehicles.length} resolved, ${unresolvedDifficult.length} unresolved`,
  )
  lines.push('')
  lines.push(
    resolution.unresolvedRows === 0 && unresolvedDifficult.length === 0
      ? 'Everything is resolved — Load will accept this resolution.'
      : '**Load refuses this resolution until every item below is adjudicated via overrides.json.**',
  )
  lines.push('')

  section(
    lines,
    'Unmatched vehicles',
    [...notes.unmatchedVehicles.entries()].map(
      ([key, { rows, result }]) =>
        `\`"${key}"\` (rows ${rows.join(', ')}) — candidates: ${formatCandidates(result)}`,
    ),
  )
  section(lines, 'Unresolved difficult-list vehicles', unresolvedDifficult)
  section(
    lines,
    'Date contradictions (block until accepted or re-patched)',
    notes.dateContradictions,
  )
  section(
    lines,
    'Other blocked rows',
    blockedRows
      .filter(
        (r) =>
          !notes.unmatchedVehicles.has(`${r.nation}:${r.vehicleName}`) &&
          !r.problems.some((p) => p.startsWith('date contradiction')),
      )
      .map((r) => `${r.rowKey}: ${r.problems.join('; ')}`),
  )
  section(
    lines,
    'Fuzzy-accepted vehicle matches (eyeball these)',
    [...notes.fuzzyMatches.entries()].map(
      ([key, m]) =>
        `\`"${key}"\` → ${m.matchedName} (${m.externalId}, score ${m.score})`,
    ),
  )
  section(lines, 'Vehicle overrides applied', notes.overriddenVehicles)
  section(lines, 'Duplicate rows for one vehicle', notes.duplicateGroups)
  section(lines, 'Accepted date contradictions', notes.acceptedContradictions)
  section(lines, 'Player slug notes', notes.playerNotes)
  section(lines, 'Difficult-list matches', notes.difficultLines)
  section(lines, 'Proof gaps (mod follow-up after import)', notes.proofGaps)
  section(
    lines,
    'Shared proofs across different players (likely sheet copy-paste — verify)',
    notes.sharedProofs,
  )

  return `${lines.join('\n')}\n`
}

function section(
  lines: Array<string>,
  title: string,
  items: Array<string>,
): void {
  if (items.length === 0) return
  lines.push(`## ${title}`)
  lines.push('')
  for (const item of items) lines.push(`- ${item}`)
  lines.push('')
}
