import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Panel, selectClass } from '#/components/admin/ui'
import { Pager, pageParam } from '#/components/admin/pager'
import { formatDayTime } from '#/lib/dates'
import { adminAuditList } from '#/admin/api'
import type { AuditEntity } from '#/admin/audit'

const ENTITIES: AuditEntity[] = [
  'record',
  'player',
  'vehicle',
  'rules',
  'patch',
]

interface AuditSearch {
  entity?: AuditEntity
  page?: number
}

export const Route = createFileRoute('/admin/audit')({
  validateSearch: (s: Record<string, unknown>): AuditSearch => {
    const out: AuditSearch = {}
    if (
      typeof s.entity === 'string' &&
      (ENTITIES as string[]).includes(s.entity)
    ) {
      out.entity = s.entity as AuditEntity
    }
    out.page = pageParam(s.page)
    return out
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (context.gate.state !== 'moderator') return null
    return adminAuditList({
      data: { entity: deps.entity, offset: ((deps.page ?? 1) - 1) * 50 },
    })
  },
  component: AuditView,
})

function AuditView() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  if (!result) return null
  const page = search.page ?? 1

  return (
    <Panel title="Audit log">
      <div className="mb-4">
        <label className="sr-only" htmlFor="audit-entity">
          Filter by entity
        </label>
        <select
          id="audit-entity"
          value={search.entity ?? ''}
          onChange={(e) =>
            navigate({
              search: {
                entity: (e.target.value || undefined) as
                  AuditEntity | undefined,
              },
            })
          }
          className={selectClass}
        >
          <option value="">All entities</option>
          {ENTITIES.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
      </div>

      {result.rows.length === 0 ? (
        <p className="text-sm text-fg-faint">Nothing audited yet.</p>
      ) : (
        <ul className="space-y-2">
          {result.rows.map((row) => (
            <li
              key={row.id}
              className="rounded-[10px] border border-hairline-soft px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="font-semibold">{row.action}</code>
                <span className="text-fg-muted">
                  {row.entity}
                  {row.entityId ? ` #${row.entityId}` : ''}
                </span>
                <span className="ml-auto text-xs text-fg-faint">
                  {row.actorHandle ?? row.actorId ?? 'unknown'}
                  {row.createdAt && ` · ${formatDayTime(row.createdAt)}`}
                </span>
              </div>
              {row.diff && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-fg-muted">
                    diff
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-xs">
                    {JSON.stringify(row.diff, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pager
        page={page}
        hasMore={result.hasMore}
        total={result.total}
        onPage={(p) => navigate({ search: { ...search, page: p } })}
      />
    </Panel>
  )
}
