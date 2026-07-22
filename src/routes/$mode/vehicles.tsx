import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Search } from 'lucide-react'
import {
  BrCell,
  HolderCell,
  KillsCell,
  LEDGER_ROW,
  LEDGER_TH,
  LedgerEmptyRow,
  LedgerMeta,
  LedgerPane,
  NationCell,
  VehicleCell,
} from '#/components/catalog-ledger'
import {
  VehicleFilters,
  clearedFilters,
  countActiveFilters,
} from '#/components/vehicle-filters'
import { db } from '#/db'
import { browseFacets, browseVehicles } from '#/db/queries'
import {
  BROWSE_PAGE_SIZE,
  browseFilters,
  normalizeBrowseSearch,
} from '#/lib/browse-params'
import type { BrowseSearch, BrowseSort } from '#/lib/browse-params'

const loadBrowse = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; search: BrowseSearch }) => data)
  .handler(async ({ data }) => {
    // Server fn input is untrusted even though the route validated it.
    const search = normalizeBrowseSearch(data.search as Record<string, unknown>)
    const [result, facets] = await Promise.all([
      browseVehicles(db, data.mode, browseFilters(search)),
      browseFacets(db, data.mode),
    ])
    if (!result || !facets) throw notFound()
    return { result, facets }
  })

export const Route = createFileRoute('/$mode/vehicles')({
  validateSearch: (s: Record<string, unknown>) => normalizeBrowseSearch(s),
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ params, deps, context }) =>
    context.mode.isLive
      ? loadBrowse({ data: { mode: params.mode, search: deps.search } })
      : null,
  component: BrowsePage,
})

// On the <th>, not the sort button — only columnheader/rowheader roles
// support aria-sort; on a button it's ignored by assistive tech.
function sortAriaValue(
  search: BrowseSearch,
  sort: BrowseSort,
): 'ascending' | 'descending' | undefined {
  if (search.sort !== sort) return undefined
  return search.dir === 'desc' ? 'descending' : 'ascending'
}

function SortHeader({
  sort,
  search,
  onChange,
  children,
}: {
  sort: BrowseSort
  search: BrowseSearch
  onChange: (next: BrowseSearch) => void
  children: React.ReactNode
}) {
  const active = search.sort === sort
  const nextDir = active && search.dir !== 'desc' ? 'desc' : undefined
  return (
    <button
      type="button"
      className={
        'inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase transition-colors duration-200 ' +
        (active ? 'text-fg' : 'text-fg-muted hover:text-fg')
      }
      onClick={() => {
        const next: BrowseSearch = { ...search }
        delete next.page
        if (active && search.dir === 'desc') {
          // Third click clears back to the default order.
          delete next.sort
          delete next.dir
        } else {
          next.sort = sort
          if (nextDir) next.dir = nextDir
          else delete next.dir
        }
        onChange(next)
      }}
    >
      {children}
      {active && <span aria-hidden>{search.dir === 'desc' ? '▾' : '▴'}</span>}
    </button>
  )
}

function pageWindow(page: number, pageCount: number): Array<number | null> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1])
  const pages = [...wanted]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b)
  const out: Array<number | null> = []
  let prev = 0
  for (const p of pages) {
    if (p - prev > 1) out.push(null)
    out.push(p)
    prev = p
  }
  return out
}

const PAGER_PILL =
  'rounded-[10px] border px-3 py-1.5 text-[0.8125rem] font-medium no-underline transition-colors duration-200 '
const PAGER_IDLE =
  'border-hairline text-fg-muted hover:border-[var(--hairline-hover)] hover:text-fg'
const PAGER_DISABLED = 'border-hairline-soft text-fg-faint'

function BrowsePage() {
  const { mode } = Route.useParams()
  const { mode: modeCtx } = Route.useRouteContext()
  const search = Route.useSearch()
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  if (!data) return null
  const { result, facets } = data
  const { rows, total, page, pageCount } = result

  const setSearch = (next: BrowseSearch) => navigate({ search: next })
  const resetFilters = () => setSearch(clearedFilters(search))
  const activeFilters = countActiveFilters(search)
  const from = total === 0 ? 0 : (page - 1) * BROWSE_PAGE_SIZE + 1
  const to = Math.min(page * BROWSE_PAGE_SIZE, total)

  return (
    <section className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
            {mode.toUpperCase()} · {modeCtx.name}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold">Vehicles</h1>
        </div>
        <LedgerMeta
          count={total}
          suffix={
            total > BROWSE_PAGE_SIZE ? ` · showing ${from}–${to}` : undefined
          }
          hasFilters={activeFilters > 0}
          onReset={resetFilters}
        />
      </div>

      <div className="mt-5">
        <VehicleFilters
          search={search}
          facets={facets}
          onChange={setSearch}
          nameSlot={
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const q = new FormData(e.currentTarget).get('q')
                setSearch({
                  ...search,
                  q: typeof q === 'string' && q.trim() ? q.trim() : undefined,
                  page: undefined,
                })
              }}
            >
              <label htmlFor="browse-q" className="sr-only">
                Filter by vehicle name
              </label>
              <div className="relative max-w-[22rem]">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
                />
                <input
                  id="browse-q"
                  type="search"
                  name="q"
                  // Uncontrolled; the key re-syncs it when history changes q.
                  key={search.q ?? ''}
                  defaultValue={search.q ?? ''}
                  placeholder="Vehicle name…"
                  className="w-full rounded-[10px] border border-hairline bg-[var(--tint)] py-1.5 pr-3 pl-9 text-[0.9375rem] placeholder:text-fg-muted"
                />
              </div>
            </form>
          }
        />
      </div>

      <div className="mt-5">
        <LedgerPane>
          <thead>
            <tr>
              <th
                className={LEDGER_TH + ' pr-4 pl-5'}
                aria-sort={sortAriaValue(search, 'name')}
              >
                <SortHeader sort="name" search={search} onChange={setSearch}>
                  Vehicle
                </SortHeader>
              </th>
              <th className={LEDGER_TH + ' hidden pr-4 md:table-cell'}>
                Nation
              </th>
              <th
                className={LEDGER_TH + ' hidden pr-4 text-right sm:table-cell'}
                aria-sort={sortAriaValue(search, 'br')}
              >
                <SortHeader sort="br" search={search} onChange={setSearch}>
                  BR
                </SortHeader>
              </th>
              <th
                className={LEDGER_TH + ' pr-4 text-right'}
                aria-sort={sortAriaValue(search, 'kills')}
              >
                <SortHeader sort="kills" search={search} onChange={setSearch}>
                  Kills
                </SortHeader>
              </th>
              <th className={LEDGER_TH + ' pr-5'}>Holder</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vehicleSlug} className={LEDGER_ROW}>
                <VehicleCell mode={mode} row={r} nationChip="mobile" />
                <NationCell row={r} />
                <BrCell br={r.br} />
                <KillsCell kills={r.kills} />
                <HolderCell row={r} />
              </tr>
            ))}
            {rows.length === 0 && (
              <LedgerEmptyRow
                colSpan={5}
                hasFilters={activeFilters > 0}
                onReset={resetFilters}
              />
            )}
          </tbody>
        </LedgerPane>
      </div>

      {pageCount > 1 && (
        <nav
          aria-label="Pages"
          className="mt-6 flex flex-wrap items-center gap-1.5"
        >
          {page > 1 ? (
            <Link
              from={Route.fullPath}
              search={{
                ...search,
                page: page - 1 === 1 ? undefined : page - 1,
              }}
              aria-label="Previous page"
              className={PAGER_PILL + PAGER_IDLE}
            >
              ‹
            </Link>
          ) : (
            <span aria-hidden="true" className={PAGER_PILL + PAGER_DISABLED}>
              ‹
            </span>
          )}
          {pageWindow(page, pageCount).map((p, i) =>
            p === null ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="px-1 text-fg-faint select-none"
              >
                …
              </span>
            ) : (
              <Link
                key={p}
                from={Route.fullPath}
                search={{ ...search, page: p === 1 ? undefined : p }}
                aria-current={p === page ? 'page' : undefined}
                className={
                  PAGER_PILL +
                  (p === page
                    ? 'border-transparent bg-[var(--pill-active)] text-fg'
                    : PAGER_IDLE)
                }
              >
                {p}
              </Link>
            ),
          )}
          {page < pageCount ? (
            <Link
              from={Route.fullPath}
              search={{ ...search, page: page + 1 }}
              aria-label="Next page"
              className={PAGER_PILL + PAGER_IDLE}
            >
              ›
            </Link>
          ) : (
            <span aria-hidden="true" className={PAGER_PILL + PAGER_DISABLED}>
              ›
            </span>
          )}
        </nav>
      )}
    </section>
  )
}
