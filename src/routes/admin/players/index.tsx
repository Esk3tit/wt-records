import {
  Link,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
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
  const pending = useRouterState({ select: (st) => st.status === 'pending' })
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
          key={search.q ?? ''}
          type="search"
          defaultValue={search.q ?? ''}
          placeholder="Display name…"
          title="Press Enter to search"
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
        <p className="text-sm text-fg-faint">
          No players match.{' '}
          <button
            type="button"
            className="text-fg-muted underline hover:text-fg"
            onClick={() => navigate({ search: {} })}
          >
            Clear search
          </button>
        </p>
      ) : (
        <div
          className={
            'overflow-x-auto transition-opacity' +
            (pending ? ' opacity-50' : '')
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-fg-faint uppercase">
                <th className="py-1.5 pr-3 font-normal">Player</th>
                <th className="py-1.5 pr-3 text-right font-normal">Records</th>
                <th className="py-1.5 text-right font-normal">Aliases</th>
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
                    {p.userId && (
                      <span className="ml-2 rounded bg-tint-strong px-1.5 py-0.5 text-xs tracking-wide text-fg-faint uppercase">
                        claimed
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{p.recordCount}</td>
                  <td className="py-2 text-right">{p.aliasCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        page={page}
        hasMore={result.hasMore}
        total={result.total}
        prevLabel="← Previous"
        nextLabel="Next →"
        onPage={(p) => navigate({ search: { ...search, page: p } })}
      />
    </Panel>
  )
}
