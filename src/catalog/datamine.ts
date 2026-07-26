import type {
  CatalogSnapshot,
  CatalogSource,
  SourceVehicle,
} from '#/catalog/source'
import type { Branch } from '#/catalog/mapping'
import { branchAndClassForType } from '#/catalog/mapping'
import { fetchUpstream } from '#/catalog/upstream-fetch'

/* The gszabi99 War Thunder datamine, read directly: four files over HTTPS, no
   clone. Images are the same repo's textures. */

const DEFAULT_REPO_URL =
  'https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine'
const DEFAULT_COMMIT_API =
  'https://api.github.com/repos/gszabi99/War-Thunder-Datamine/commits/master'

export interface DatamineOptions {
  /** Read the files from here verbatim instead of pinning a revision. */
  baseUrl?: string
  /** Locale file, separately configurable — it is the one file with a mirror. */
  unitsCsvUrl?: string
  fetchImpl?: typeof fetch
  retryDelayMs?: number
}

/* Class comes from this list's order, never from the first tag upstream emits:
   38% of units carry several type_* tags and their order means nothing. */
const BASE_CLASS_TAGS: ReadonlyArray<readonly [string, string]> = [
  ['type_light_tank', 'light_tank'],
  ['type_medium_tank', 'medium_tank'],
  ['type_heavy_tank', 'heavy_tank'],
  ['type_tank_destroyer', 'tank_destroyer'],
  ['type_spaa', 'spaa'],
  ['type_attack_helicopter', 'attack_helicopter'],
  ['type_utility_helicopter', 'utility_helicopter'],
  ['type_jet_fighter', 'fighter'],
  ['type_interceptor', 'fighter'],
  ['type_fighter', 'fighter'],
  ['type_strike_aircraft', 'assault'],
  ['type_assault', 'assault'],
  ['type_jet_bomber', 'bomber'],
  ['type_frontline_bomber', 'bomber'],
  ['type_longrange_bomber', 'bomber'],
  ['type_dive_bomber', 'bomber'],
  ['type_light_bomber', 'bomber'],
  ['type_bomber', 'bomber'],
  ['type_submarine', 'submarine'],
  ['type_battleship', 'battleship'],
  ['type_battlecruiser', 'battlecruiser'],
  ['type_heavy_cruiser', 'heavy_cruiser'],
  ['type_light_cruiser', 'light_cruiser'],
  ['type_destroyer', 'destroyer'],
  ['type_frigate', 'frigate'],
  ['type_submarine_chaser', 'heavy_boat'],
  ['type_heavy_gun_boat', 'heavy_boat'],
  ['type_heavy_boat', 'heavy_boat'],
  ['type_torpedo_gun_boat', 'boat'],
  ['type_torpedo_boat', 'boat'],
  ['type_armored_boat', 'boat'],
  ['type_gun_boat', 'boat'],
  ['type_minelayer', 'boat'],
  ['type_boat', 'boat'],
  ['type_naval_ferry_barge', 'barge'],
  ['type_naval_aa_ferry', 'barge'],
  ['type_barge', 'barge'],
]

const IMAGE_FOLDER: Record<Branch, string> = {
  ground: 'tanks',
  air: 'aircrafts',
  naval: 'ships',
}

const BR_FRACTIONS = [0, 0.3, 0.7]

/** Economic rank → battle rating: 1.0 upward in thirds, so rank 42 is 15.0.
    A formula rather than a fixed table, so a raised BR ceiling keeps working. */
export function battleRating(economicRank: number): number {
  return Math.floor(economicRank / 3) + 1 + BR_FRACTIONS[economicRank % 3]
}

interface WpcostUnit {
  country?: unknown
  rank?: unknown
  economicRankArcade?: unknown
  economicRankHistorical?: unknown
  economicRankSimulation?: unknown
  costGold?: unknown
  researchType?: unknown
  event?: unknown
}

interface UnittagsUnit {
  operatorCountry?: unknown
  tags?: Record<string, unknown>
}

export class DatamineSource implements CatalogSource {
  readonly name = 'gszabi99-datamine'
  private readonly configuredBaseUrl: string | undefined
  private readonly configuredUnitsCsvUrl: string | undefined
  private readonly fetchImpl: typeof fetch
  private readonly retryDelayMs: number

  constructor(options: DatamineOptions = {}) {
    this.configuredBaseUrl = options.baseUrl?.replace(/\/+$/, '')
    this.configuredUnitsCsvUrl = options.unitsCsvUrl
    this.fetchImpl = options.fetchImpl ?? fetch
    this.retryDelayMs = options.retryDelayMs ?? 1000
  }

  async fetchSnapshot(): Promise<CatalogSnapshot> {
    // The four files must come from one revision: read off a moving branch, a
    // push landing mid-flight yields a snapshot whose units.csv doesn't cover
    // its wpcost, and the missing units read as removed.
    const dataUrl =
      this.configuredBaseUrl ?? `${DEFAULT_REPO_URL}/${await this.headSha()}`
    // Images stay on the branch: vehicleImageKey hashes the source URL, so a
    // per-run revision would re-mirror every image every night.
    const imageUrl = this.configuredBaseUrl ?? `${DEFAULT_REPO_URL}/master`

    const [wpcost, unittags, names, version] = await Promise.all([
      this.fetchJson<Record<string, unknown>>(
        `${dataUrl}/char.vromfs.bin_u/config/wpcost.blkx`,
      ),
      this.fetchJson<Record<string, unknown>>(
        `${dataUrl}/char.vromfs.bin_u/config/unittags.blkx`,
      ),
      this.fetchEnglishNames(
        this.configuredUnitsCsvUrl ??
          `${dataUrl}/lang.vromfs.bin_u/lang/units.csv`,
      ),
      this.fetchText(`${dataUrl}/version`),
    ])

    const gameVersion = version.trim()
    if (!/^\d+(\.\d+)*$/.test(gameVersion)) {
      throw new Error(
        `Not a game version at ${dataUrl}/version: ${JSON.stringify(gameVersion.slice(0, 40))}`,
      )
    }

    const warnings: Array<string> = []
    // An overridden locale file sits outside the pinned revision, so a shop
    // name it lacks makes an ownable unit look scripted. Say so, don't guess.
    if (this.configuredUnitsCsvUrl && !this.configuredBaseUrl) {
      warnings.push(
        `locale file read from ${this.configuredUnitsCsvUrl}, outside the pinned revision`,
      )
    }
    const vehicles: Array<SourceVehicle> = []
    const untagged: Array<string> = []
    const nameless: Array<string> = []
    const killstreaks: Array<string> = []
    const invisible: Array<string> = []
    const unclassified: Array<string> = []
    const unplaceable: Array<string> = []
    const incomplete: Array<string> = []
    const ignoredTags = new Set<string>()

    for (const [externalId, entry] of Object.entries(wpcost)) {
      // wpcost carries scalar siblings of the units (economicRankMax); a unit
      // is a key both files agree on.
      if (entry === null || typeof entry !== 'object') continue
      const unit = entry as WpcostUnit
      const tagEntry = unittags[externalId] as UnittagsUnit | undefined
      if (!tagEntry || typeof tagEntry !== 'object') {
        untagged.push(externalId)
        continue
      }

      // Three independent legs; they do not nest, so each is load-bearing.
      const name = names.get(`${externalId}_shop`)
      if (!name) {
        nameless.push(externalId)
        continue
      }
      if (externalId.endsWith('_killstreak')) {
        killstreaks.push(externalId)
        continue
      }
      if (tagEntry.operatorCountry === 'country_invisible') {
        invisible.push(externalId)
        continue
      }

      const tags = Object.keys(tagEntry.tags ?? {}).filter(
        (t) => t.startsWith('type_') && tagEntry.tags![t],
      )
      // Recorded before the skip below: a unit dropped for carrying only new
      // vocabulary is exactly the case the ignored-tag warning exists to name.
      for (const tag of tags) {
        if (!BASE_CLASS_TAGS.some(([known]) => known === tag)) {
          ignoredTags.add(tag)
        }
      }
      const vehicleType = BASE_CLASS_TAGS.find(([tag]) =>
        tags.includes(tag),
      )?.[1]
      if (!vehicleType) {
        unclassified.push(externalId)
        continue
      }

      // No branch means no image folder either: this list has drifted from the
      // engine's type map, which is a bug here rather than upstream news.
      const branch = branchAndClassForType(vehicleType)?.branch
      if (!branch) {
        unplaceable.push(externalId)
        continue
      }

      // Checked on the raw fields, not on Number(): a null rank coerces to a
      // perfectly finite 0, which would land as a real rank-0 vehicle.
      const ranks = [
        unit.rank,
        unit.economicRankArcade,
        unit.economicRankHistorical,
        unit.economicRankSimulation,
      ]
      if (!ranks.every(isRankValue)) {
        incomplete.push(externalId)
        continue
      }
      const [era, arcade, historical, simulation] = ranks as Array<number>

      const country = String(unit.country ?? '').replace(/^country_/, '')
      vehicles.push({
        externalId,
        name,
        country,
        vehicleType,
        era,
        arcadeBr: battleRating(arcade),
        realisticBr: battleRating(historical),
        simulatorBr: battleRating(simulation),
        isPremium: unit.costGold != null,
        isSquadron: unit.researchType === 'clanVehicle',
        event: typeof unit.event === 'string' ? unit.event : null,
        imageUrl:
          `${imageUrl}/tex.vromfs.bin_u/${IMAGE_FOLDER[branch]}/` +
          `${externalId.toLowerCase()}.png`,
      })
    }

    const skipped: Array<readonly [Array<string>, string]> = [
      [untagged, 'units missing from unittags — skipped'],
      [nameless, 'units without a shop-name locale entry skipped (scripted)'],
      [killstreaks, 'killstreak units skipped (scripted)'],
      [invisible, 'country_invisible units skipped (scripted)'],
      [unclassified, 'units with no recognized base class tag skipped'],
      [unplaceable, 'units whose base class the sync engine cannot place'],
      [incomplete, 'units with unusable rank or economic rank skipped'],
    ]
    for (const [ids, label] of skipped) {
      if (ids.length > 0) warnings.push(countedList(label, ids))
    }
    if (ignoredTags.size > 0) {
      warnings.push(
        `ignored ${ignoredTags.size} type tags as capability modifiers: ` +
          [...ignoredTags].sort().join(', '),
      )
    }

    return { gameVersion, vehicles, warnings }
  }

  /** Commit behind `master`, so all four files come from one revision. */
  private async headSha(): Promise<string> {
    const { sha } = await this.fetchJson<{ sha?: unknown }>(DEFAULT_COMMIT_API)
    if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) {
      throw new Error(`No commit sha at ${DEFAULT_COMMIT_API}`)
    }
    return sha
  }

  /** `<identifier>_shop` key → English name; other rows/columns are skipped. */
  private async fetchEnglishNames(url: string): Promise<Map<string, string>> {
    const csv = await this.fetchText(url)
    const names = new Map<string, string>()
    for (const line of csv.split('\n')) {
      if (!line.includes('_shop"')) continue
      const cols = parseCsvLine(line, 2)
      if (cols[0]?.endsWith('_shop') && cols[1]) names.set(cols[0], cols[1])
    }
    if (names.size === 0) {
      throw new Error(`No locale entries parsed from ${url}`)
    }
    return names
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const text = await this.fetchText(url)
    try {
      return JSON.parse(text) as T
    } catch (cause) {
      throw new Error(`Invalid JSON from ${url}`, { cause })
    }
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetchUpstream(url, {
      fetchImpl: this.fetchImpl,
      retryDelayMs: this.retryDelayMs,
    })
    return response.text()
  }
}

/** Ranks index the BR table, so a fraction or a negative is not one. */
function isRankValue(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function countedList(label: string, ids: Array<string>): string {
  return (
    `${ids.length} ${label}: ${ids.slice(0, 8).join(', ')}` +
    (ids.length > 8 ? ', …' : '')
  )
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
