import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Panel, inputClass } from '#/components/admin/ui'
import { Pager, pageParam } from '#/components/admin/pager'
import { adminPlayerList } from '#/admin/api'

interface PlayersSearch {
  q?: string
  page?: number
}

export const Route = createFileRoute('/admin/players/')({
  validateSearch: (s: Record<string, unknown>): PlayersSearch => {
    const out: PlayersSearch = {}
    if (typeof s.q === 'string' && s.q.trim()) out.q = s.q.trim()
    out.page = pageParam(s.page)
    return out
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (context.gate.state !== 'moderator') return null
    return adminPlayerList({
      data: { q: deps.q, offset: ((deps.page ?? 1) - 1) * 50 },
    })
  },
  component: PlayersIndex,
})

function PlayersIndex() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  if (!result) return null
  const page = search.page ?? 1

  return (
    <Panel title="Players">
      <div className="mb-4">
        <label className="sr-only" htmlFor="player-q">
          Filter players
        </label>
        <input
          id="player-q"
          type="search"
          defaultValue={search.q ?? ''}
          placeholder="Display name…"
          className={inputClass + ' max-w-64'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              navigate({
                search: { q: e.currentTarget.value.trim() || undefined },
              })
            }
          }}
        />
      </div>

      {result.rows.length === 0 ? (
        <p className="text-sm text-fg-faint">No players match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-fg-faint uppercase">
                <th className="py-1.5 pr-3 font-normal">Player</th>
                <th className="py-1.5 pr-3 text-right font-normal">Records</th>
                <th className="py-1.5 pr-3 text-right font-normal">Aliases</th>
                <th className="py-1.5 font-normal">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((p) => (
                <tr key={p.id} className="border-t border-hairline-soft">
                  <td className="py-2 pr-3">
                    <Link
                      to="/admin/players/$id"
                      params={{ id: String(p.id) }}
                      className="font-medium"
                    >
                      {p.displayName}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right">{p.recordCount}</td>
                  <td className="py-2 pr-3 text-right">{p.aliasCount}</td>
                  <td className="py-2 text-fg-muted">
                    {p.userId ? 'yes' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        page={page}
        hasMore={result.hasMore}
        prevLabel="← Previous"
        nextLabel="Next →"
        onPage={(p) => navigate({ search: { ...search, page: p } })}
      />
    </Panel>
  )
}
