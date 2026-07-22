import { useState } from 'react'
import { formatBr, formatRank } from '#/lib/format'
import type { BrowseSearch, TitleStatus } from '#/lib/browse-params'
import { ACQUISITIONS, TITLE_STATUSES } from '#/lib/browse-params'
import type { VehicleClass } from '#/lib/vehicle-classes'

export interface BrowseFacetOptions {
  /** Absent on the nation sheet — the page itself is the nation filter. */
  nations?: Array<{ slug: string; name: string }>
  classes: VehicleClass[]
  ranks: number[]
  brSteps: number[]
}

const CLASS_LABELS: Partial<Record<VehicleClass, string>> = {
  spg: 'SPG',
  spaa: 'SPAA',
  heli: 'Heli',
}

const ACQ_LABELS: Record<(typeof ACQUISITIONS)[number], string> = {
  event: 'Event',
  premium: 'Premium',
  squadron: 'Squadron',
  removed: 'Removed',
  'tech-tree': 'Tech tree',
}

const STATUS_LABELS: Record<TitleStatus, string> = {
  held: 'Held',
  open: 'Open bounty',
}

/** Search keys the panel counts as filters (sort/dir/page are not filters). */
export const FILTER_KEYS = [
  'q',
  'nation',
  'class',
  'rank',
  'br',
  'acq',
  'status',
] as const satisfies ReadonlyArray<keyof BrowseSearch>

export function countActiveFilters(search: BrowseSearch): number {
  return FILTER_KEYS.filter((k) => search[k] !== undefined).length
}

/** The next search shape with every filter cleared; sort order survives. */
export function clearedFilters(search: BrowseSearch): BrowseSearch {
  const next = { ...search }
  for (const k of FILTER_KEYS) delete next[k]
  delete next.page
  return next
}

function classLabel(c: VehicleClass): string {
  return CLASS_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1)
}

// Tolerates the router's JSON-parsed bare numerics (?rank=4 arrives as 4).
function csvItems(value: string | number | undefined): string[] {
  return value != null && value !== '' ? String(value).split(',') : []
}

function toggleCsv(
  value: string | undefined,
  item: string,
): string | undefined {
  const items = csvItems(value)
  const next = items.includes(item)
    ? items.filter((i) => i !== item)
    : [...items, item]
  return next.length > 0 ? next.join(',') : undefined
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="float-left mb-1 w-full text-[0.6875rem] font-semibold tracking-[0.14em] text-fg-muted uppercase sm:mb-0 sm:w-[6.5rem] sm:pr-3">
        {label}
      </legend>
      {children}
    </fieldset>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'rounded-[10px] border px-2.5 py-1 text-[0.8125rem] font-medium transition-colors duration-200 ' +
        (active
          ? 'border-transparent bg-[var(--pill-active)] text-fg'
          : 'border-hairline text-fg-muted hover:border-[var(--hairline-hover)] hover:text-fg')
      }
    >
      {children}
    </button>
  )
}

/** The one filter surface for catalog views: a thin glass instrument panel.
 * Stateless: reads the canonical URL search shape, emits the next one (page
 * always reset). `nameSlot` lets Browse mount its name search inside the
 * panel so filtering has a single home. */
export function VehicleFilters({
  search,
  facets,
  onChange,
  nameSlot,
}: {
  search: BrowseSearch
  facets: BrowseFacetOptions
  onChange: (next: BrowseSearch) => void
  nameSlot?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const apply = (patch: Partial<BrowseSearch>) => {
    const next = { ...search, ...patch }
    delete next.page
    for (const k of Object.keys(next) as Array<keyof BrowseSearch>) {
      if (next[k] === undefined) delete next[k]
    }
    onChange(next)
  }

  const brParts = typeof search.br === 'string' ? search.br.split('-') : []
  const brMin = brParts[0] ?? ''
  const brMax = brParts[1] ?? ''
  const setBr = (min: string, max: string) => {
    if (!min && !max) return apply({ br: undefined })
    const first = facets.brSteps[0]
    const last = facets.brSteps[facets.brSteps.length - 1]
    apply({ br: `${min || first}-${max || last}` })
  }

  const brSelectClass =
    'rounded-[10px] border border-hairline bg-transparent px-2 py-1 text-[0.8125rem] text-fg transition-colors duration-200 hover:border-[var(--hairline-hover)]'

  const activeCount = countActiveFilters(search) - (search.q ? 1 : 0)

  return (
    <div className="glass-thin rounded-[22px] px-5 py-4">
      {nameSlot != null && <div className="sm:mb-4">{nameSlot}</div>}
      {/* Phones: the full group stack costs two screens before the table, so
          it folds behind one disclosure; wider screens always show it. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="vehicle-filter-groups"
        onClick={() => setExpanded((e) => !e)}
        className={
          'flex items-center gap-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors duration-200 hover:text-fg sm:hidden ' +
          (nameSlot != null ? 'mt-3.5' : '')
        }
      >
        <span aria-hidden className="text-[0.6875rem]">
          {expanded ? '▾' : '▸'}
        </span>
        Filters
        {activeCount > 0 && (
          <span className="rounded-[6px] bg-[var(--pill-active)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-fg">
            {activeCount}
          </span>
        )}
      </button>
      <div
        id="vehicle-filter-groups"
        className={
          (expanded ? 'mt-3.5 flex' : 'hidden') + ' flex-col gap-3 sm:mt-0 sm:flex'
        }
      >
        {facets.nations && (
          <FilterGroup label="Nation">
            {facets.nations.map((n) => (
              <FilterChip
                key={n.slug}
                active={csvItems(search.nation).includes(n.slug)}
                onClick={() =>
                  apply({ nation: toggleCsv(search.nation, n.slug) })
                }
              >
                {n.name}
              </FilterChip>
            ))}
          </FilterGroup>
        )}
        <FilterGroup label="Class">
          {facets.classes.map((c) => (
            <FilterChip
              key={c}
              active={csvItems(search.class).includes(c)}
              onClick={() => apply({ class: toggleCsv(search.class, c) })}
            >
              {classLabel(c)}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Rank">
          {facets.ranks.map((r) => (
            <FilterChip
              key={r}
              active={csvItems(search.rank).includes(String(r))}
              onClick={() => apply({ rank: toggleCsv(search.rank, String(r)) })}
            >
              {formatRank(r)}
            </FilterChip>
          ))}
        </FilterGroup>
        {facets.brSteps.length > 0 && (
          <FilterGroup label="BR">
            <label
              className="text-[0.8125rem] text-fg-muted"
              htmlFor="br-min"
            >
              from
            </label>
            <select
              id="br-min"
              className={brSelectClass}
              value={brMin}
              onChange={(e) => setBr(e.target.value, brMax)}
            >
              <option value="">Any</option>
              {facets.brSteps.map((b) => (
                <option key={b} value={String(b)}>
                  {formatBr(b)}
                </option>
              ))}
            </select>
            <label
              className="ml-1 text-[0.8125rem] text-fg-muted"
              htmlFor="br-max"
            >
              to
            </label>
            <select
              id="br-max"
              className={brSelectClass}
              value={brMax}
              onChange={(e) => setBr(brMin, e.target.value)}
            >
              <option value="">Any</option>
              {facets.brSteps.map((b) => (
                <option key={b} value={String(b)}>
                  {formatBr(b)}
                </option>
              ))}
            </select>
          </FilterGroup>
        )}
        <FilterGroup label="Acquisition">
          {ACQUISITIONS.map((a) => (
            <FilterChip
              key={a}
              active={csvItems(search.acq).includes(a)}
              onClick={() => apply({ acq: toggleCsv(search.acq, a) })}
            >
              {ACQ_LABELS[a]}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Title">
          {TITLE_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={search.status === s}
              onClick={() =>
                apply({ status: search.status === s ? undefined : s })
              }
            >
              {STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </FilterGroup>
      </div>
    </div>
  )
}
