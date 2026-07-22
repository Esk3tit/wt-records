import { VEHICLE_CLASSES } from '#/lib/vehicle-classes'
import type { VehicleClass } from '#/lib/vehicle-classes'

export const BROWSE_PAGE_SIZE = 100

export const ACQUISITIONS = [
  'event',
  'premium',
  'squadron',
  'removed',
  'tech-tree',
] as const
export type Acquisition = (typeof ACQUISITIONS)[number]

export const TITLE_STATUSES = ['held', 'open'] as const
export type TitleStatus = (typeof TITLE_STATUSES)[number]

export const BROWSE_SORTS = ['name', 'br', 'kills'] as const
export type BrowseSort = (typeof BROWSE_SORTS)[number]

/** URL shape: canonical strings only (CSV for multi-selects), defaults
 * omitted, so the unfiltered URL is bare and every value round-trips
 * without the router JSON-encoding it. */
export interface BrowseSearch {
  q?: string
  nation?: string
  class?: string
  rank?: string
  br?: string
  acq?: string
  status?: TitleStatus
  sort?: BrowseSort
  dir?: 'desc'
  page?: number
}

/** The parsed, typed form the query builder consumes. */
export interface BrowseFilters {
  q: string | null
  nations: string[]
  classes: VehicleClass[]
  ranks: number[]
  br: { min: number; max: number } | null
  acq: Acquisition[]
  status: TitleStatus | null
  sort: BrowseSort | null
  dir: 'asc' | 'desc'
  page: number
}

/** Facets a route mounts. The nation sheet drops nation (the page is the
 * nation filter) and q (the header search covers name lookup there). */
export type BrowseFacet = keyof Pick<BrowseSearch, 'q' | 'nation'>

const SLUG_RE = /^[a-z0-9-]+$/

// The router JSON-parses search values, so a bare numeric like ?rank=4
// arrives as a number — canonicalize it back to its string form.
function asParam(value: unknown): unknown {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : value
}

function csv<T extends string>(
  raw: unknown,
  valid: (item: string) => item is T,
): T[] {
  const value = asParam(raw)
  if (typeof value !== 'string') return []
  const items = [...new Set(value.split(',').map((s) => s.trim()))]
  return items.filter(valid)
}

function parseBrRange(value: unknown): { min: number; max: number } | null {
  if (typeof value !== 'string') return null
  const m = /^([0-9]{1,2}(?:\.[0-9])?)-([0-9]{1,2}(?:\.[0-9])?)$/.exec(value)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  // A mangled shared link degrades (bounds swap), it never errors.
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

const isClass = (s: string): s is VehicleClass =>
  (VEHICLE_CLASSES as readonly string[]).includes(s)
const isAcq = (s: string): s is Acquisition =>
  (ACQUISITIONS as readonly string[]).includes(s)
const isNationSlug = (s: string): s is string => SLUG_RE.test(s)
const isRank = (s: string): s is string => /^[1-9][0-9]?$/.test(s)

/** validateSearch for browse-filter routes: keeps only well-formed values in
 * canonical string form and drops everything else — unknown params, garbage
 * values, and defaults all vanish from the URL. */
export function normalizeBrowseSearch(
  raw: Record<string, unknown>,
  omit: BrowseFacet[] = [],
): BrowseSearch {
  const out: BrowseSearch = {}

  const q = asParam(raw.q)
  if (!omit.includes('q') && typeof q === 'string' && q.trim()) {
    out.q = q.trim()
  }
  if (!omit.includes('nation')) {
    const nations = csv(raw.nation, isNationSlug)
    if (nations.length > 0) out.nation = nations.join(',')
  }
  const classes = csv(raw.class, isClass)
  if (classes.length > 0) out.class = classes.join(',')
  const ranks = csv(raw.rank, isRank)
  if (ranks.length > 0) out.rank = ranks.join(',')
  const br = parseBrRange(raw.br)
  if (br) out.br = `${br.min}-${br.max}`
  const acq = csv(raw.acq, isAcq)
  if (acq.length > 0) out.acq = acq.join(',')
  if (
    typeof raw.status === 'string' &&
    (TITLE_STATUSES as readonly string[]).includes(raw.status)
  ) {
    out.status = raw.status as TitleStatus
  }
  if (
    typeof raw.sort === 'string' &&
    (BROWSE_SORTS as readonly string[]).includes(raw.sort)
  ) {
    out.sort = raw.sort as BrowseSort
  }
  if (raw.dir === 'desc') out.dir = 'desc'
  const page = Number(raw.page)
  if (Number.isInteger(page) && page > 1) out.page = page

  return out
}

export function browseFilters(search: BrowseSearch): BrowseFilters {
  return {
    q: search.q ?? null,
    nations: csv(search.nation, isNationSlug),
    classes: csv(search.class, isClass),
    ranks: csv(search.rank, isRank).map(Number),
    br: parseBrRange(search.br),
    acq: csv(search.acq, isAcq),
    status: search.status ?? null,
    sort: search.sort ?? null,
    dir: search.dir ?? 'asc',
    page: search.page ?? 1,
  }
}
