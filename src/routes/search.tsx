import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Search as SearchIcon } from 'lucide-react'
import { NationFlag } from '#/components/nation-flag'
import { SectionHead } from '#/components/section-head'
import { VehicleTags } from '#/components/vehicle-tags'
import { db } from '#/db'
import { search } from '#/db/queries'

const runSearch = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(({ data }) => search(db, data))

export const Route = createFileRoute('/search')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => {
    const q = typeof s.q === 'string' ? s.q.trim() : ''
    return q ? { q } : {}
  },
  loaderDeps: ({ search: s }) => ({ q: s.q ?? '' }),
  loader: ({ deps }) => runSearch({ data: deps.q }),
  component: SearchPage,
})

function matchCount(n: number): string {
  return n === 1 ? '1 match' : `${n} matches`
}

function SearchPage() {
  const q = Route.useSearch().q ?? ''
  const results = Route.useLoaderData()
  const empty =
    q !== '' &&
    results.players.length === 0 &&
    results.vehicles.length === 0

  return (
    <section className="mx-auto w-full max-w-[40rem] py-6">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form method="get" action="/search" className="mt-4">
        <label htmlFor="search-q" className="sr-only">
          Search vehicles and players
        </label>
        <div className="relative">
          <SearchIcon
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-muted"
          />
          <input
            id="search-q"
            type="search"
            name="q"
            // Uncontrolled; the key re-syncs it when history changes q.
            key={q}
            defaultValue={q}
            autoFocus={q === ''}
            enterKeyHint="search"
            placeholder="Vehicle or player…"
            className="w-full rounded-[12px] border border-hairline bg-[var(--tint)] py-3 pr-4 pl-11 text-[1.0625rem] placeholder:text-fg-muted"
          />
        </div>
      </form>

      {/* One polite summary instead of live-regioning the whole result list —
          a full list re-announce on every keystrokey navigation is noise. */}
      <p className="sr-only" aria-live="polite">
        {q === ''
          ? ''
          : empty
            ? `Nothing matches ${q}`
            : `${matchCount(results.players.length)} in players, ${matchCount(
                results.vehicles.length,
              )} in vehicles`}
      </p>

      {q === '' && (
        <div className="glass-thin mt-8 rounded-[22px] px-6 py-12 text-center">
          <p className="font-medium text-fg">Search the registry</p>
          <p className="mx-auto mt-1.5 max-w-[26rem] text-[0.9375rem] text-fg-muted">
            Players and vehicles across every mode — typos are fine, partial
            names work.
          </p>
        </div>
      )}

      {empty && (
        <div className="glass-thin mt-8 rounded-[22px] px-6 py-12 text-center">
          <p className="font-medium text-fg">Nothing matches “{q}”</p>
          <p className="mx-auto mt-1.5 max-w-[26rem] text-[0.9375rem] text-fg-muted">
            Search covers vehicle and player names. Try a shorter fragment —
            “tiger” finds every Tiger.
          </p>
        </div>
      )}

      {q !== '' && !empty && (
        <div className="mt-8 space-y-10">
          {results.players.length > 0 && (
            <section>
              <SectionHead
                title="Players"
                aside={matchCount(results.players.length)}
              />
              <div className="glass-mid overflow-hidden">
                <ul>
                  {results.players.map((p) => (
                    <li
                      key={p.slug}
                      className="border-t border-hairline-soft first:border-t-0"
                    >
                      <Link
                        to="/player/$slug"
                        params={{ slug: p.slug }}
                        className="flex items-center gap-4 px-5 py-3 no-underline transition-colors duration-200 hover:bg-[var(--row-hover)]"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {p.displayName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {results.vehicles.length > 0 && (
            <section>
              <SectionHead
                title="Vehicles"
                aside={matchCount(results.vehicles.length)}
              />
              <div className="glass-mid overflow-hidden">
                <ul>
                  {results.vehicles.map((v) => (
                    <li
                      key={v.slug}
                      className={
                        'relative border-t border-hairline-soft transition-colors duration-200 first:border-t-0 ' +
                        (v.linkMode ? 'hover:bg-[var(--row-hover)]' : '')
                      }
                      title={
                        v.linkMode
                          ? undefined
                          : 'This vehicle’s mode isn’t live yet'
                      }
                    >
                      <div className="flex items-center gap-4 px-5 py-3">
                        <span className="min-w-0 flex-1">
                          {v.linkMode ? (
                            // Stretched link: whole-row click, accessible name
                            // stays the bare vehicle name.
                            <Link
                              to="/$mode/vehicle/$slug"
                              params={{ mode: v.linkMode, slug: v.slug }}
                              className="font-medium no-underline after:absolute after:inset-0 hover:underline"
                            >
                              {v.name}
                            </Link>
                          ) : (
                            <span className="text-fg-muted">{v.name}</span>
                          )}
                          <VehicleTags tags={v} />
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-[0.8125rem] text-fg-muted">
                          <NationFlag slug={v.nationSlug} />
                          {v.nation}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  )
}
