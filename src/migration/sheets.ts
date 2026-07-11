/* Google Sheets grid reader. The proof URLs live behind cell hyperlinks,
   which only the Sheets API exposes — CSV/xlsx exports are blocked for this
   spreadsheet. */

export interface SheetCell {
  value: string | null
  hyperlink: string | null
}

export type SheetRow = Array<SheetCell>

export interface SheetsClientOptions {
  apiKey: string
  fetchImpl?: typeof fetch
}

interface ApiCell {
  formattedValue?: string
  hyperlink?: string
}

interface ApiGridResponse {
  sheets?: Array<{
    data?: Array<{ rowData?: Array<{ values?: Array<ApiCell> }> }>
  }>
}

const FIELDS = 'sheets(data(rowData(values(formattedValue,hyperlink))))'

export async function fetchTabGrid(
  spreadsheetId: string,
  tab: string,
  { apiKey, fetchImpl = fetch }: SheetsClientOptions,
): Promise<Array<SheetRow>> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?key=${apiKey}&ranges=${encodeURIComponent(`'${tab}'`)}` +
    `&includeGridData=true&fields=${FIELDS}`
  const res = await fetchImpl(url)
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status} for tab "${tab}"`)
  }
  const body = (await res.json()) as ApiGridResponse
  const rowData = body.sheets?.[0]?.data?.[0]?.rowData
  if (!rowData) throw new Error(`Sheets API returned no grid for tab "${tab}"`)
  return rowData.map((row) =>
    (row.values ?? []).map((cell) => ({
      value: cell.formattedValue?.trim() || null,
      hyperlink: cell.hyperlink ?? null,
    })),
  )
}

export type ProofColumn = 'screenshot' | 'screenshot2' | 'video'

export interface RawProofLink {
  column: ProofColumn
  url: string
}

/** One sheet row, verbatim — no matching or interpretation yet. */
export interface RawRow {
  tab: string
  nation: string
  /** 1-based row number in the sheet, for review artifacts. */
  rowNumber: number
  kills: number
  vehicleName: string
  playerName: string
  br: number | null
  patch: string
  proofs: Array<RawProofLink>
}

export interface ParsedTab {
  rows: Array<RawRow>
  problems: Array<string>
  /** Vehicle rows nobody has claimed yet (name/BR only) — the tabs list every
      eligible vehicle; the DataSheet's "Out Of" counts these too. */
  placeholders: number
}

const EXPECTED_HEADER = [
  'kills',
  'tank',
  'player',
  'br',
  'patch version',
  'screenshot',
  'screenshot 2',
  'video',
]

const PROOF_COLUMNS: Array<{ index: number; column: ProofColumn }> = [
  { index: 5, column: 'screenshot' },
  { index: 6, column: 'screenshot2' },
  { index: 7, column: 'video' },
]

function cellAt(row: SheetRow, index: number): SheetCell {
  return row[index] ?? { value: null, hyperlink: null }
}

/** Parse a nation tab into raw rows. Any structural surprise is a problem —
    the corpus was verified clean, so silence would hide sheet drift. */
export function parseNationTab(
  tab: string,
  nation: string,
  grid: Array<SheetRow>,
): ParsedTab {
  const problems: Array<string> = []
  const rows: Array<RawRow> = []
  let placeholders = 0

  const header = grid[0] ?? []
  for (let i = 0; i < EXPECTED_HEADER.length; i++) {
    const got = cellAt(header, i).value?.toLowerCase() ?? ''
    if (got !== EXPECTED_HEADER[i]) {
      problems.push(
        `${tab}: header column ${i + 1} is ${JSON.stringify(got)}, expected ${JSON.stringify(EXPECTED_HEADER[i])}`,
      )
    }
  }

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]
    const rowNumber = r + 1
    if (row.every((c) => c.value === null && c.hyperlink === null)) continue

    const kills = cellAt(row, 0).value
    const vehicleName = cellAt(row, 1).value
    const playerName = cellAt(row, 2).value
    const br = cellAt(row, 3).value
    const patch = cellAt(row, 4).value

    const missing: Array<string> = []
    if (!kills) missing.push('kills')
    if (!vehicleName) missing.push('tank')
    if (!playerName) missing.push('player')
    if (!patch) missing.push('patch')
    const hasProofLink = PROOF_COLUMNS.some(({ index }) => {
      const cell = cellAt(row, index)
      return cell.hyperlink !== null || cell.value !== null
    })
    if (vehicleName && !kills && !playerName && !patch && !hasProofLink) {
      placeholders += 1
      continue
    }
    if (missing.length > 0) {
      problems.push(`${tab} row ${rowNumber}: missing ${missing.join(', ')}`)
      continue
    }

    const killsNum = Number(kills)
    if (!Number.isInteger(killsNum) || killsNum <= 0) {
      problems.push(
        `${tab} row ${rowNumber}: kills ${JSON.stringify(kills)} is not a positive integer`,
      )
      continue
    }
    let brNum: number | null = null
    if (br !== null) {
      brNum = Number(br)
      if (!Number.isFinite(brNum)) {
        problems.push(
          `${tab} row ${rowNumber}: BR ${JSON.stringify(br)} is not a number`,
        )
        continue
      }
    }

    const proofs: Array<RawProofLink> = []
    for (const { index, column } of PROOF_COLUMNS) {
      const cell = cellAt(row, index)
      const url = cell.hyperlink ?? (isUrl(cell.value) ? cell.value : null)
      if (url) {
        proofs.push({ column, url })
      } else if (cell.value !== null) {
        problems.push(
          `${tab} row ${rowNumber}: ${column} cell has text ${JSON.stringify(cell.value)} but no link`,
        )
      }
    }

    rows.push({
      tab,
      nation,
      rowNumber,
      kills: killsNum,
      vehicleName: vehicleName!,
      playerName: playerName!,
      br: brNum,
      patch: patch!,
      proofs,
    })
  }

  return { rows, problems, placeholders }
}

function isUrl(value: string | null): value is string {
  return value !== null && /^https?:\/\//i.test(value)
}
