import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Fragment } from 'react'
import {
  BrCell,
  HolderCell,
  KillsCell,
  LEDGER_ROW,
  LEDGER_TH,
  LedgerEmptyRow,
  LedgerMeta,
  LedgerPane,
  VehicleCell,
} from '#/components/catalog-ledger'
import { NationFlag } from '#/components/nation-flag'
import {
  VehicleFilters,
  clearedFilters,
  countActiveFilters,
} from '#/components/vehicle-filters'
import { db } from '#/db'
import { browseFacets, getNationCard, getNationSheet } from '#/db/queries'
import { browseFilters, normalizeBrowseSearch } from '#/lib/browse-params'
import type { BrowseSearch } from '#/lib/browse-params'
import { formatRank } from '#/lib/format'
import { toNationCardModel } from '#/og/props/nation'
import { nationUnfurl } from '#/og/copy'
import { nationCardUrl } from '#/og/urls'
import { cardMeta } from '#/og/meta'

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
    // `card` carries the unfiltered nation aggregates the share card + unfurl
    // need (the sheet itself is filtered by the browse search).
    const [sheet, facets, card] = await Promise.all([
      getNationSheet(db, data.mode, data.slug, browseFilters(search)),
      browseFacets(db, data.mode),
      getNationCard(db, data.mode, data.slug),
    ])
    if (!sheet || !facets) throw notFound()
    return { sheet, facets, card }
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
  head: ({ loaderData, params }) => {
    if (!loaderData?.card) return {}
    const model = toNationCardModel(params.mode, loaderData.card)
    const { title, description } = nationUnfurl(model)
    return {
      meta: cardMeta({
        title,
        description,
        image: nationCardUrl(params.mode, params.slug, model.version),
      }),
    }
  },
  component: NationSheet,
})

function NationSheet() {
  const { mode } = Route.useParams()
  const { mode: modeCtx } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const data = Route.useLoaderData()
  if (!data) return null
  const { nation, rows } = data.sheet
  const card = data.card
  const facets = { ...data.facets, nations: undefined }

  const setSearch = (next: BrowseSearch) => navigate({ search: next })
  const resetFilters = () => setSearch(clearedFilters(search))
  const activeFilters = countActiveFilters(search)
  const avgKills =
    card && card.avgKills != null
      ? Math.round(card.avgKills * 10) / 10
      : null

  const groups: Array<{ rank: number | null; rows: typeof rows }> = []
  for (const r of rows) {
    const last = groups.at(-1)
    if (last && last.rank === r.rank) last.rows.push(r)
    else groups.push({ rank: r.rank, rows: [r] })
  }

  return (
    <section className="py-6">
      {/* Nation header: the sheet's identity pane. The flag bleeds through
          the glass as a watermark, never as a banner. */}
      <header className="glass-thick relative p-6 md:p-8">
        <div
          className="absolute inset-0 z-0 overflow-hidden rounded-[26px]"
          aria-hidden="true"
        >
          <NationFlag
            slug={nation.slug}
            variant="wash"
            className="flag-wash--soft"
          />
        </div>
        <div className="relative">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Link
              to="/$mode/nations"
              params={{ mode }}
              className="text-[0.8125rem] text-fg-muted no-underline transition-colors duration-200 hover:text-fg"
            >
              ‹ Nations
            </Link>
            <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
              {mode.toUpperCase()} · {modeCtx.name}
            </p>
          </div>
          <h1 className="mt-3 flex items-center gap-3 text-2xl font-semibold">
            <NationFlag slug={nation.slug} />
            {nation.name}
          </h1>
          {card && (
            <dl className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
                  Titles held
                </dt>
                <dd className="mt-1 text-[1.0625rem] font-bold">
                  {card.held}{' '}
                  <span className="text-[0.8125rem] font-normal text-fg-muted">
                    of {card.total}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
                  Completion
                </dt>
                <dd className="mt-1 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-28 overflow-hidden rounded-full bg-tint-strong"
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--ink-faint)]"
                      style={{ width: `${card.completionPct}%` }}
                    />
                  </span>
                  <span className="text-[1.0625rem] font-bold">
                    {card.completionPct}%
                  </span>
                </dd>
              </div>
              {avgKills != null && (
                <div>
                  <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
                    Avg kills
                  </dt>
                  <dd className="mt-1 text-[1.0625rem] font-bold">
                    {avgKills}
                  </dd>
                </div>
              )}
              {card.mostHeldPlayer && (
                <div>
                  <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
                    Most titles
                  </dt>
                  <dd className="mt-1 text-[1.0625rem] font-semibold">
                    {card.mostHeldPlayer}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </header>

      <div className="mt-5">
        <LedgerMeta
          count={rows.length}
          hasFilters={activeFilters > 0}
          onReset={resetFilters}
        />
      </div>

      <div className="mt-2.5">
        <VehicleFilters search={search} facets={facets} onChange={setSearch} />
      </div>

      <div className="mt-5">
        <LedgerPane>
          <thead>
            <tr>
              <th className={LEDGER_TH + ' pr-4 pl-5'}>Vehicle</th>
              <th className={LEDGER_TH + ' hidden pr-4 text-right sm:table-cell'}>
                BR
              </th>
              <th className={LEDGER_TH + ' pr-4 text-right'}>Kills</th>
              <th className={LEDGER_TH + ' pr-5'}>Holder</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <Fragment key={g.rank ?? 'unranked'}>
                <tr>
                  <th
                    colSpan={4}
                    scope="rowgroup"
                    className={
                      'px-5 pb-2 text-left ' + (gi === 0 ? 'pt-4' : 'pt-7')
                    }
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
                        {g.rank != null
                          ? `Rank ${formatRank(g.rank)}`
                          : 'Unranked'}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-linear-to-r from-[var(--hairline)] to-transparent"
                      />
                      <span className="text-[0.6875rem] font-medium text-fg-faint">
                        {/* Same held test as HolderCell — one definition of
                            a held title on the page. */}
                        {g.rows.filter((r) => r.playerSlug != null).length} of{' '}
                        {g.rows.length} held
                      </span>
                    </span>
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.vehicleSlug} className={LEDGER_ROW}>
                    <VehicleCell mode={mode} row={r} />
                    <BrCell br={r.br} />
                    <KillsCell kills={r.kills} />
                    <HolderCell row={r} />
                  </tr>
                ))}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <LedgerEmptyRow
                colSpan={4}
                hasFilters={activeFilters > 0}
                onReset={resetFilters}
              />
            )}
          </tbody>
        </LedgerPane>
      </div>
    </section>
  )
}
