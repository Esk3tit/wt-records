import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import { search } from '#/db/queries'

// Vehicles aren't mode-scoped; link a result to its branch's realistic-battles
// mode so the page can resolve a record (ground→GRB, air→ARB).
const BRANCH_MODE: Record<'ground' | 'air' | 'naval', string> = {
  ground: 'grb',
  air: 'arb',
  naval: 'grb',
}

const runSearch = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(({ data }) => search(db, data))

export const Route = createFileRoute('/search')({
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s.q === 'string' && s.q ? { q: s.q } : {},
  loaderDeps: ({ search: s }) => ({ q: s.q ?? '' }),
  loader: ({ deps }) => runSearch({ data: deps.q }),
  component: Search,
})

function Search() {
  const q = Route.useSearch().q ?? ''
  const results = Route.useLoaderData()

  return (
    <section className="p-6">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Vehicle or player…"
          className="rounded border border-white/15 bg-transparent px-3 py-1"
        />
      </form>

      {q && (
        <div className="mt-6 flex flex-wrap gap-10">
          <div>
            <h2 className="text-fg-muted">Players</h2>
            <ul className="mt-2 space-y-1">
              {results.players.map((p) => (
                <li key={p.slug}>
                  <Link to="/player/$slug" params={{ slug: p.slug }}>
                    {p.displayName}
                  </Link>
                </li>
              ))}
              {results.players.length === 0 && (
                <li className="text-fg-faint">No players.</li>
              )}
            </ul>
          </div>
          <div>
            <h2 className="text-fg-muted">Vehicles</h2>
            <ul className="mt-2 space-y-1">
              {results.vehicles.map((v) => (
                <li key={v.slug}>
                  <Link
                    to="/$mode/vehicle/$slug"
                    params={{ mode: BRANCH_MODE[v.branch], slug: v.slug }}
                  >
                    {v.name}
                  </Link>
                </li>
              ))}
              {results.vehicles.length === 0 && (
                <li className="text-fg-faint">No vehicles.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
