import {
  Link,
  createFileRoute,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router'
import {
  Panel,
  StatusChip,
  buttonClass,
  inputClass,
  selectClass,
} from '#/components/admin/ui'
import { Pager, pageParam } from '#/components/admin/pager'
import { formatDayYear } from '#/lib/dates'
import { adminRecordList } from '#/admin/api'

interface RecordsSearch {
  status?: 'verified' | 'retired' | 'pending' | 'rejected'
  mode?: string
  q?: string
  page?: number
}

export const Route = createFileRoute('/admin/')({
  validateSearch: (s: Record<string, unknown>): RecordsSearch => {
    const out: RecordsSearch = {}
    if (
      typeof s.status === 'string' &&
      ['verified', 'retired', 'pending', 'rejected'].includes(s.status)
    ) {
      out.status = s.status as RecordsSearch['status']
    }
    if (typeof s.mode === 'string' && s.mode) out.mode = s.mode
    if (typeof s.q === 'string' && s.q.trim()) out.q = s.q.trim()
    out.page = pageParam(s.page)
    return out
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (context.gate.state !== 'moderator') return null
    return adminRecordList({
      data: {
        status: deps.status,
        mode: deps.mode,
        q: deps.q,
        limit: PAGE,
        offset: ((deps.page ?? 1) - 1) * PAGE,
      },
    })
  },
  component: RecordsIndex,
})

const PAGE = 50

const STATUS_LABELS = {
  verified: 'Verified',
  retired: 'Retired',
  pending: 'Pending',
  rejected: 'Rejected',
} as const

function RecordsIndex() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const { modes } = useLoaderData({ from: '__root__' })
  const navigate = useNavigate({ from: Route.fullPath })
  if (!result) return null
  const page = search.page ?? 1

  const setSearch = (patch: Partial<RecordsSearch>) =>
    navigate({ search: { ...search, page: undefined, ...patch } })

  return (
    <Panel
      title="Records"
      aside={
        <Link to="/admin/records/new" className={buttonClass}>
          New record
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="rec-mode">
          Mode
        </label>
        <select
          id="rec-mode"
          value={search.mode ?? ''}
          onChange={(e) => setSearch({ mode: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All modes</option>
          {modes.map((m) => (
            <option key={m.mode} value={m.mode}>
              {m.mode.toUpperCase()}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="rec-status">
          Status
        </label>
        <select
          id="rec-status"
          value={search.status ?? ''}
          onChange={(e) =>
            setSearch({
              status: (e.target.value || undefined) as RecordsSearch['status'],
            })
          }
          className={selectClass}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="rec-q">
          Filter by vehicle or player
        </label>
        <input
          id="rec-q"
          key={search.q ?? ''}
          type="search"
          defaultValue={search.q ?? ''}
          placeholder="Vehicle, player or IGN — press Enter"
          className={inputClass + ' max-w-64'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch({ q: e.currentTarget.value.trim() || undefined })
            }
          }}
        />
      </div>

      <p className="mb-2 text-xs text-fg-faint tabular-nums">
        {result.total.toLocaleString('en-GB')} record
        {result.total === 1 ? '' : 's'}
        {page > 1 ? ` · page ${page}` : ''}
      </p>
      {result.rows.length === 0 ? (
        <p className="text-sm text-fg-faint">No records match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-fg-faint uppercase">
                <th className="py-1.5 pr-3 font-normal">Vehicle</th>
                <th className="py-1.5 pr-3 font-normal">Mode</th>
                <th className="py-1.5 pr-3 font-normal">Player</th>
                <th className="py-1.5 pr-3 text-right font-normal">Kills</th>
                <th className="py-1.5 pr-3 font-normal">Patch</th>
                <th className="py-1.5 pr-3 font-normal">Status</th>
                <th className="py-1.5 pr-3 font-normal">Verified</th>
                <th className="py-1.5 font-normal">Verifier</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} className="border-t border-hairline-soft">
                  <td className="py-2 pr-3">
                    <Link
                      to="/admin/records/$id"
                      params={{ id: String(r.id) }}
                      className="font-medium"
                    >
                      {r.vehicleName}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-fg-muted">
                    {r.mode.toUpperCase()}
                  </td>
                  <td className="py-2 pr-3">{r.playerName}</td>
                  <td className="py-2 pr-3 text-right font-semibold">
                    {r.kills}
                  </td>
                  <td className="py-2 pr-3 text-fg-muted">{r.patch}</td>
                  <td className="py-2 pr-3">
                    <StatusChip status={r.status} isCurrent={r.isCurrent} />
                  </td>
                  <td className="py-2 pr-3 text-fg-muted">
                    {r.verifiedAt ? formatDayYear(r.verifiedAt) : '—'}
                  </td>
                  <td className="py-2 text-fg-muted">
                    {r.verifierHandle ?? '—'}
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
        onPage={(p) => navigate({ search: { ...search, page: p } })}
      />
    </Panel>
  )
}
