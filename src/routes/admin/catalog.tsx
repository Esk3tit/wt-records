import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  ErrorNote,
  Field,
  Panel,
  buttonClass,
  errorMessage,
  inputClass,
} from '#/components/admin/ui'
import {
  adminRulesConfig,
  adminSetDifficult,
  adminUpdateRules,
  adminVehicleList,
} from '#/admin/api'
import type { VehicleClass } from '#/lib/vehicle-classes'

interface CatalogSearch {
  q?: string
  difficult?: boolean
}

export const Route = createFileRoute('/admin/catalog')({
  validateSearch: (s: Record<string, unknown>): CatalogSearch => {
    const out: CatalogSearch = {}
    if (typeof s.q === 'string' && s.q.trim()) out.q = s.q.trim()
    if (s.difficult === true) out.difficult = true
    return out
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (context.gate.state !== 'moderator') return null
    const [vehicles, rules] = await Promise.all([
      adminVehicleList({ data: { q: deps.q, difficultOnly: deps.difficult } }),
      adminRulesConfig(),
    ])
    return { vehicles, rules }
  },
  component: CatalogAndRules,
})

function CatalogAndRules() {
  const loaded = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  if (!loaded) return null

  return (
    <div className="space-y-4">
      <Panel
        title="Vehicles"
        aside={
          <span className="text-xs text-fg-faint">
            Sync owns the catalog — only the difficult flag is editable here.
          </span>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="veh-q">
            Filter vehicles
          </label>
          <input
            id="veh-q"
            key={search.q ?? ''}
            type="search"
            defaultValue={search.q ?? ''}
            placeholder="Vehicle name…"
            className={inputClass + ' max-w-64'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate({
                  search: {
                    ...search,
                    q: e.currentTarget.value.trim() || undefined,
                  },
                })
              }
            }}
          />
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={search.difficult ?? false}
              onChange={(e) =>
                navigate({
                  search: {
                    ...search,
                    difficult: e.target.checked || undefined,
                  },
                })
              }
            />
            Difficult only
          </label>
        </div>

        {loaded.vehicles.rows.length === 0 ? (
          <p className="text-sm text-fg-faint">No vehicles match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-fg-faint uppercase">
                  <th className="py-1.5 pr-3 font-normal">Vehicle</th>
                  <th className="py-1.5 pr-3 font-normal">Nation</th>
                  <th className="py-1.5 pr-3 font-normal">Class</th>
                  <th className="py-1.5 font-normal">Difficult</th>
                </tr>
              </thead>
              <tbody>
                {loaded.vehicles.rows.map((v) => (
                  <tr key={v.id} className="border-t border-hairline-soft">
                    <td className="py-2 pr-3 font-medium">{v.name}</td>
                    <td className="py-2 pr-3 text-fg-muted">{v.nation}</td>
                    <td className="py-2 pr-3 text-fg-muted">{v.class}</td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        aria-label={`Mark ${v.name} difficult`}
                        checked={v.isDifficult}
                        onChange={async (e) => {
                          setError(null)
                          try {
                            await adminSetDifficult({
                              data: {
                                vehicleId: v.id,
                                isDifficult: e.target.checked,
                              },
                            })
                            await router.invalidate()
                          } catch (err) {
                            setError(errorMessage(err))
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loaded.vehicles.hasMore && (
          <p className="mt-2 text-xs text-fg-faint">
            Showing the first 50 — narrow the search to find the rest.
          </p>
        )}
      </Panel>

      {loaded.rules.map((mode) => (
        <ModeRulesPanel
          key={mode.mode}
          mode={mode}
          onError={setError}
          onSaved={() => router.invalidate()}
        />
      ))}

      <ErrorNote error={error} />
    </div>
  )
}

type ModeRules = NonNullable<
  Awaited<ReturnType<typeof adminRulesConfig>>
>[number]

function ModeRulesPanel({
  mode,
  onError,
  onSaved,
}: {
  mode: ModeRules
  onError: (message: string | null) => void
  onSaved: () => void
}) {
  const [cells, setCells] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      mode.thresholds.map((t) => [t.class, String(t.minKills)]),
    ),
  )
  const [difficult, setDifficult] = useState(
    mode.difficultMinKills != null ? String(mode.difficultMinKills) : '',
  )
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    onError(null)
    try {
      const entries = Object.entries(cells)
        .filter(([, raw]) => raw.trim() !== '')
        .map(([cls, raw]) => ({
          class: cls as VehicleClass,
          minKills: Number(raw),
        }))
      // One transaction server-side: matrix + override save or fail together.
      await adminUpdateRules({
        data: {
          mode: mode.mode,
          entries,
          difficultMinKills: difficult.trim() === '' ? null : Number(difficult),
        },
      })
      onSaved()
    } catch (e) {
      onError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title={`Rules · ${mode.mode.toUpperCase()}`}
      aside={
        !mode.isLive && (
          <span className="text-xs text-fg-faint">not live yet</span>
        )
      }
    >
      <p className="mb-3 text-xs text-fg-faint">
        Thresholds apply at verification time — existing records are never
        recomputed.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {mode.thresholds.map((t) => (
          <Field key={t.class} label={t.class}>
            <input
              type="number"
              min={1}
              value={cells[t.class] ?? ''}
              onChange={(e) =>
                setCells((c) => ({ ...c, [t.class]: e.target.value }))
              }
              className={inputClass + ' w-24'}
            />
          </Field>
        ))}
        <Field label="Difficult override">
          <input
            type="number"
            min={1}
            value={difficult}
            placeholder="unset"
            onChange={(e) => setDifficult(e.target.value)}
            className={inputClass + ' w-24'}
          />
        </Field>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save rules'}
        </button>
      </div>
      {mode.thresholds.length === 0 && (
        <p className="mt-2 text-xs text-fg-faint">
          No per-class minimums configured for this mode yet.
        </p>
      )}
    </Panel>
  )
}
