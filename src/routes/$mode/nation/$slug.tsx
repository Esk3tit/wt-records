import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Fragment } from 'react'
import { RecordName } from '#/components/record-name'
import { VehicleFilters } from '#/components/vehicle-filters'
import { VehicleTags } from '#/components/vehicle-tags'
import { db } from '#/db'
import { browseFacets, getNationSheet } from '#/db/queries'
import { browseFilters, normalizeBrowseSearch } from '#/lib/browse-params'
import type { BrowseSearch } from '#/lib/browse-params'
import { formatBr, formatRank } from '#/lib/format'

// The page IS the nation filter, and the header search covers name lookup.
const OMITTED_FACETS = ['q', 'nation'] as const

const loadNationSheet = createServerFn({ method: 'GET' })
  .validator(
    (data: { mode: string; slug: string; search: BrowseSearch }) => data,
  )
  .handler(async ({ data }) => {
    const search = normalizeBrowseSearch(
      data.search as Record<string, unknown>,
      [...OMITTED_FACETS],
    )
    const [sheet, facets] = await Promise.all([
      getNationSheet(db, data.mode, data.slug, browseFilters(search)),
      browseFacets(db, data.mode),
    ])
    if (!sheet || !facets) throw notFound()
    return { sheet, facets }
  })

export const Route = createFileRoute('/$mode/nation/$slug')({
  validateSearch: (s: Record<string, unknown>) =>
    normalizeBrowseSearch(s, [...OMITTED_FACETS]),
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ params, deps, context }) =>
    context.mode.isLive
      ? loadNationSheet({
          data: { mode: params.mode, slug: params.slug, search: deps.search },
        })
      : null,
  component: NationSheet,
})

function NationSheet() {
  const { mode } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const data = Route.useLoaderData()
  if (!data) return null
  const { nation, rows } = data.sheet
  const facets = { ...data.facets, nations: undefined }

  const groups: Array<{ rank: number | null; rows: typeof rows }> = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last && last.rank === r.rank) last.rows.push(r)
    else groups.push({ rank: r.rank, rows: [r] })
  }

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">
        {nation.name} — {mode.toUpperCase()}
      </h1>

      <div className="mt-4">
        <VehicleFilters
          search={search}
          facets={facets}
          onChange={(next) => navigate({ search: next })}
        />
      </div>

      <table className="mt-4 w-full max-w-3xl text-left">
        <thead className="text-sm text-fg-faint">
          <tr>
            <th className="py-1 pr-4">Vehicle</th>
            <th className="py-1 pr-4">BR</th>
            <th className="py-1 pr-4">Kills</th>
            <th className="py-1">Holder</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.rank ?? 'unranked'}>
              <tr>
                <th
                  colSpan={4}
                  scope="rowgroup"
                  className="pt-4 pb-1 text-left text-xs font-semibold tracking-wide text-fg-faint uppercase"
                >
                  {g.rank != null ? `Rank ${formatRank(g.rank)}` : 'Unranked'}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.vehicleSlug} className="border-t border-white/5">
                  <td className="py-1 pr-4">
                    <Link
                      to="/$mode/vehicle/$slug"
                      params={{ mode, slug: r.vehicleSlug }}
                    >
                      {r.vehicleName}
                    </Link>
                    {r.isDifficult && (
                      <span className="ml-1 text-fg-faint">◆</span>
                    )}
                    <VehicleTags tags={r} />
                  </td>
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
            </Fragment>
          ))}
          {rows.length === 0 && (
            <tr className="border-t border-white/5">
              <td colSpan={4} className="py-3 text-fg-faint">
                No vehicles match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
