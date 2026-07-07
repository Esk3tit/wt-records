import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { RecordName } from '#/components/record-name'
import { VehicleFilters } from '#/components/vehicle-filters'
import { VehicleTags } from '#/components/vehicle-tags'
import { db } from '#/db'
import { browseFacets, browseVehicles } from '#/db/queries'
import {
  BROWSE_PAGE_SIZE,
  browseFilters,
  normalizeBrowseSearch,
} from '#/lib/browse-params'
import type { BrowseSearch, BrowseSort } from '#/lib/browse-params'
import { formatBr } from '#/lib/format'

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
        'font-inherit inline-flex items-center gap-1 ' +
        (active ? 'text-fg' : 'hover:text-fg')
      }
      aria-sort={
        active
          ? search.dir === 'desc'
            ? 'descending'
            : 'ascending'
          : undefined
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

function BrowsePage() {
  const { mode } = Route.useParams()
  const search = Route.useSearch()
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  if (!data) return null
  const { result, facets } = data
  const { rows, total, page, pageCount } = result

  const setSearch = (next: BrowseSearch) => navigate({ search: next })
  const from = total === 0 ? 0 : (page - 1) * BROWSE_PAGE_SIZE + 1
  const to = Math.min(page * BROWSE_PAGE_SIZE, total)

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">
        Vehicles — {mode.toUpperCase()}
      </h1>
      <p className="mt-1 text-sm text-fg-muted" aria-live="polite">
        {total} {total === 1 ? 'vehicle' : 'vehicles'}
        {total > 0 && ` · ${from}–${to}`}
      </p>

      <form
        className="mt-4"
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
        <input
          id="browse-q"
          type="search"
          name="q"
          defaultValue={search.q ?? ''}
          placeholder="Vehicle name…"
          className="rounded border border-hairline bg-transparent px-3 py-1"
        />
      </form>

      <div className="mt-4">
        <VehicleFilters search={search} facets={facets} onChange={setSearch} />
      </div>

      <table className="mt-5 w-full max-w-4xl text-left">
        <thead className="text-sm text-fg-faint">
          <tr>
            <th className="py-1 pr-4">
              <SortHeader sort="name" search={search} onChange={setSearch}>
                Vehicle
              </SortHeader>
            </th>
            <th className="py-1 pr-4">Nation</th>
            <th className="py-1 pr-4">
              <SortHeader sort="br" search={search} onChange={setSearch}>
                BR
              </SortHeader>
            </th>
            <th className="py-1 pr-4">
              <SortHeader sort="kills" search={search} onChange={setSearch}>
                Kills
              </SortHeader>
            </th>
            <th className="py-1">Holder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vehicleSlug} className="border-t border-white/5">
              <td className="py-1 pr-4">
                <Link
                  to="/$mode/vehicle/$slug"
                  params={{ mode, slug: r.vehicleSlug }}
                >
                  {r.vehicleName}
                </Link>
                {r.isDifficult && <span className="ml-1 text-fg-faint">◆</span>}
                <VehicleTags tags={r} />
              </td>
              <td className="py-1 pr-4 text-fg-muted">{r.nationName}</td>
              <td className="py-1 pr-4 text-fg-muted">
                {r.br != null ? formatBr(r.br) : '—'}
              </td>
              <td className="py-1 pr-4">{r.kills ?? '—'}</td>
              <td className="py-1">
                {r.playerSlug && r.displayName ? (
                  <RecordName
                    displayName={r.displayName}
                    playerSlug={r.playerSlug}
                    ignSnapshot={r.ignSnapshot}
                    displayNameSnapshot={r.displayNameSnapshot}
                  />
                ) : (
                  <span className="text-fg-faint">Open bounty</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="border-t border-white/5">
              <td colSpan={5} className="py-3 text-fg-faint">
                No vehicles match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pageCount > 1 && (
        <nav aria-label="Pages" className="mt-5 flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              from={Route.fullPath}
              search={{ ...search, page: p === 1 ? undefined : p }}
              aria-current={p === page ? 'page' : undefined}
              className={
                'rounded-[8px] border border-hairline px-2.5 py-1 text-sm no-underline ' +
                (p === page
                  ? 'bg-[var(--pill-active)] font-semibold text-fg'
                  : 'text-fg-muted hover:text-fg')
              }
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </section>
  )
}
