import { formatBr, formatRank } from '#/lib/format'
import type { BrowseSearch, TitleStatus } from '#/lib/browse-params'
import { ACQUISITIONS } from '#/lib/browse-params'
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

function classLabel(c: VehicleClass): string {
  return CLASS_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1)
}

function csvItems(value: string | undefined): string[] {
  return value ? value.split(',') : []
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
      <legend className="float-left mr-2 text-xs tracking-wide text-fg-faint uppercase">
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
        'rounded-[10px] border border-hairline px-2.5 py-1 text-[0.8125rem] transition-colors duration-150 ' +
        (active
          ? 'bg-[var(--pill-active)] font-semibold text-fg'
          : 'text-fg-muted hover:text-fg')
      }
    >
      {children}
    </button>
  )
}

/** The one filter surface for catalog views. Stateless: reads the canonical
 * URL search shape, emits the next one (page always reset). */
export function VehicleFilters({
  search,
  facets,
  onChange,
}: {
  search: BrowseSearch
  facets: BrowseFacetOptions
  onChange: (next: BrowseSearch) => void
}) {
  const apply = (patch: Partial<BrowseSearch>) => {
    const next = { ...search, ...patch }
    delete next.page
    for (const k of Object.keys(next) as Array<keyof BrowseSearch>) {
      if (next[k] === undefined) delete next[k]
    }
    onChange(next)
  }

  const brMin = search.br?.split('-')[0] ?? ''
  const brMax = search.br?.split('-')[1] ?? ''
  const setBr = (min: string, max: string) => {
    if (!min && !max) return apply({ br: undefined })
    const first = facets.brSteps[0]
    const last = facets.brSteps[facets.brSteps.length - 1]
    apply({ br: `${min || first}-${max || last}` })
  }

  const brSelectClass =
    'rounded-[8px] border border-hairline bg-transparent px-1.5 py-1 text-[0.8125rem] text-fg-muted'

  return (
    <div className="flex flex-col gap-2.5">
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
          <label className="text-xs text-fg-faint" htmlFor="br-min">
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
          <label className="text-xs text-fg-faint" htmlFor="br-max">
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
        {(['held', 'open'] as TitleStatus[]).map((s) => (
          <FilterChip
            key={s}
            active={search.status === s}
            onClick={() =>
              apply({ status: search.status === s ? undefined : s })
            }
          >
            {s === 'held' ? 'Held' : 'Open bounty'}
          </FilterChip>
        ))}
      </FilterGroup>
    </div>
  )
}
