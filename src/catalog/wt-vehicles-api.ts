import type {
  CatalogSnapshot,
  CatalogSource,
  SourceVehicle,
} from '#/catalog/source'
import { latestGameVersion } from '#/catalog/mapping'
import { fetchUpstream } from '#/catalog/upstream-fetch'

/* WT Vehicles API (self-hostable — the base URL is configuration) plus the
   datamine locale CSV for English names, which the API does not carry. */

export interface WtVehiclesApiOptions {
  apiBaseUrl?: string
  unitsCsvUrl?: string
  fetchImpl?: typeof fetch
  /** Pause between list pages — politeness toward the public instance. */
  pageDelayMs?: number
  retryDelayMs?: number
}

interface ApiVehicle {
  identifier: string
  country: string
  vehicle_type: string
  era: number
  arcade_br: number
  realistic_br: number
  simulator_br: number
  event: string | null
  is_premium: 0 | 1 | boolean
  squadron_vehicle: 0 | 1 | boolean
  images: { image: string | null } | null
}

const PAGE_SIZE = 200
// ~8000 vehicles; the catalog is ~3300 — exceeding this means the upstream
// stopped honoring the page param and the loop must not spin forever.
const MAX_PAGES = 40

export class WtVehiclesApiSource implements CatalogSource {
  readonly name = 'wt-vehicles-api'
  private readonly apiBaseUrl: string
  private readonly unitsCsvUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly pageDelayMs: number
  private readonly retryDelayMs: number

  constructor(options: WtVehiclesApiOptions = {}) {
    this.apiBaseUrl =
      options.apiBaseUrl ?? 'https://wtvehiclesapi.duckdns.org/api'
    this.unitsCsvUrl =
      options.unitsCsvUrl ??
      'https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/master/lang.vromfs.bin_u/lang/units.csv'
    this.fetchImpl = options.fetchImpl ?? fetch
    this.pageDelayMs = options.pageDelayMs ?? 250
    this.retryDelayMs = options.retryDelayMs ?? 1000
  }

  async fetchSnapshot(): Promise<CatalogSnapshot> {
    const [apiVehicles, names, stats] = await Promise.all([
      this.fetchAllVehicles(),
      this.fetchEnglishNames(),
      this.fetchJson<{ versions: Array<string> }>(
        `${this.apiBaseUrl}/vehicles/stats`,
      ),
    ])

    const warnings: Array<string> = []
    const vehicles: Array<SourceVehicle> = []
    const nameless: Array<string> = []
    let killstreaks = 0
    for (const v of apiVehicles) {
      // Belt and braces: the query param should exclude these, but an older
      // self-hosted instance ignoring it must not leak scripted units in.
      if (v.identifier.endsWith('_killstreak')) {
        killstreaks++
        continue
      }
      const name = names.get(`${v.identifier}_shop`)
      // No shop name = a scripted/killstreak unit, not an ownable vehicle.
      if (!name) {
        nameless.push(v.identifier)
        continue
      }
      vehicles.push({
        externalId: v.identifier,
        name,
        country: v.country,
        vehicleType: v.vehicle_type,
        era: v.era,
        arcadeBr: v.arcade_br,
        realisticBr: v.realistic_br,
        simulatorBr: v.simulator_br,
        isPremium: toFlag(v.is_premium),
        isSquadron: toFlag(v.squadron_vehicle),
        event: v.event,
        imageUrl: v.images?.image ?? null,
      })
    }
    if (killstreaks > 0) {
      warnings.push(
        `${killstreaks} killstreak units slipped past the upstream filter — dropped locally`,
      )
    }
    if (nameless.length > 0) {
      warnings.push(
        `${nameless.length} units without a shop-name locale entry skipped ` +
          `(scripted/killstreak): ${nameless.slice(0, 8).join(', ')}` +
          (nameless.length > 8 ? ', …' : ''),
      )
    }

    return {
      gameVersion: latestGameVersion(stats.versions),
      vehicles,
      warnings,
    }
  }

  private async fetchAllVehicles(): Promise<Array<ApiVehicle>> {
    const all: Array<ApiVehicle> = []
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) {
        throw new Error(
          `Pagination did not terminate after ${MAX_PAGES} pages — upstream ignoring the page param?`,
        )
      }
      if (page > 0 && this.pageDelayMs > 0) await sleep(this.pageDelayMs)
      const batch = await this.fetchJson<Array<ApiVehicle>>(
        `${this.apiBaseUrl}/vehicles?limit=${PAGE_SIZE}&page=${page}` +
          `&excludeKillstreak=true&excludeEventVehicles=false`,
      )
      all.push(...batch)
      if (batch.length < PAGE_SIZE) return all
    }
  }

  /** `<identifier>_shop` key → English name; other rows/columns are skipped. */
  private async fetchEnglishNames(): Promise<Map<string, string>> {
    const csv = await this.fetchText(this.unitsCsvUrl)
    const names = new Map<string, string>()
    for (const line of csv.split('\n')) {
      if (!line.includes('_shop"')) continue
      const cols = parseCsvLine(line, 2)
      if (cols[0]?.endsWith('_shop') && cols[1]) names.set(cols[0], cols[1])
    }
    if (names.size === 0) {
      throw new Error(`No locale entries parsed from ${this.unitsCsvUrl}`)
    }
    return names
  }

  private async fetchJson<T>(url: string): Promise<T> {
    return JSON.parse(await this.fetchText(url)) as T
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetchUpstream(url, {
      fetchImpl: this.fetchImpl,
      retryDelayMs: this.retryDelayMs,
    })
    return response.text()
  }
}

/* Accepts 0/1, booleans, or their string forms — a truthy non-flag string
   ("0") must not become premium. */
function toFlag(value: 0 | 1 | boolean): boolean {
  return Number(value) === 1
}

/* units.csv is semicolon-separated with double-quoted fields. */
function parseCsvLine(line: string, maxCols = Infinity): Array<string> {
  const cols: Array<string> = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length && cols.length < maxCols; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ';') {
      cols.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cols.push(current)
  return cols
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
