import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
  ErrorNote,
  Field,
  Panel,
  blurOnWheel,
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
import { VEHICLE_CLASSES } from '#/lib/vehicle-classes'
import type { VehicleClass } from '#/lib/vehicle-classes'
import { displayVehicleName } from '#/lib/vehicle-name'

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
                    <td className="py-2 pr-3 font-medium">
                      {displayVehicleName(v.name)}
                    </td>
                    <td className="py-2 pr-3 text-fg-muted">{v.nation}</td>
                    <td className="py-2 pr-3 text-fg-muted">{v.class}</td>
                    <td className="py-2">
                      <DifficultToggle
                        key={`${v.id}:${v.isDifficult}`}
                        vehicleId={v.id}
                        name={v.name}
                        isDifficult={v.isDifficult}
                        onError={setError}
                        onSaved={() => router.invalidate()}
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

      {loaded.rules.map((mode) =>
        mode.isLive ? (
          <ModeRulesPanel
            key={mode.mode}
            mode={mode}
            onError={setError}
            onSaved={() => router.invalidate()}
          />
        ) : (
          // Not-live modes stay one click away instead of stacking empty chrome.
          <details key={mode.mode} className="group">
            <summary className="glass-thin cursor-pointer list-none rounded-[22px] p-5 group-open:rounded-b-none">
              <span className="section-label">
                Rules · {mode.mode.toUpperCase()}
              </span>
              <span className="ml-3 text-xs text-fg-faint group-open:hidden">
                not live yet — click to configure
              </span>
              <span className="ml-3 hidden text-xs text-fg-faint group-open:inline">
                not live yet
              </span>
            </summary>
            <div className="glass-thin rounded-b-[22px] px-5 pb-5">
              <ModeRulesPanel
                mode={mode}
                onError={setError}
                onSaved={() => router.invalidate()}
                bare
              />
            </div>
          </details>
        ),
      )}

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
  bare = false,
}: {
  mode: ModeRules
  onError: (message: string | null) => void
  onSaved: () => void
  bare?: boolean
}) {
  // Every class gets a cell — a deleted (or never-set) class must be
  // configurable again, not vanish from the editor.
  const [cells, setCells] = useState<Record<string, string>>(() => {
    const byClass = Object.fromEntries(
      mode.thresholds.map((t) => [t.class, String(t.minKills)]),
    )
    return Object.fromEntries(
      VEHICLE_CLASSES.map((cls) => [cls, byClass[cls] ?? '']),
    )
  })
  const [difficult, setDifficult] = useState(
    mode.difficultMinKills != null ? String(mode.difficultMinKills) : '',
  )
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    onError(null)
    try {
      // A cleared cell sends null so the server deletes that threshold row.
      const entries = Object.entries(cells).map(([cls, raw]) => ({
        class: cls as VehicleClass,
        minKills: raw.trim() === '' ? null : Number(raw),
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

  const body = (
    <>
      <p className="mb-3 text-xs text-fg-faint">
        Thresholds apply at verification time — existing records are never
        recomputed.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {VEHICLE_CLASSES.map((cls) => (
          <Field key={cls} label={cls}>
            <input
              type="number"
              min={1}
              value={cells[cls] ?? ''}
              onWheel={blurOnWheel}
              onChange={(e) =>
                setCells((c) => ({ ...c, [cls]: e.target.value }))
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
            onWheel={blurOnWheel}
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
    </>
  )
  if (bare) return <div className="pt-2">{body}</div>
  return <Panel title={`Rules · ${mode.mode.toUpperCase()}`}>{body}</Panel>
}

function DifficultToggle({
  vehicleId,
  name,
  isDifficult,
  onError,
  onSaved,
}: {
  vehicleId: number
  name: string
  isDifficult: boolean
  onError: (message: string | null) => void
  onSaved: () => Promise<unknown>
}) {
  // Optimistic: the box reflects the click immediately instead of reverting
  // to the server value while the request is in flight (keyed by the server
  // value, so an invalidate re-seeds it).
  const [checked, setChecked] = useState(isDifficult)
  const [busy, setBusy] = useState(false)
  return (
    <input
      type="checkbox"
      aria-label={`Mark ${name} difficult`}
      checked={checked}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.checked
        setChecked(next)
        setBusy(true)
        onError(null)
        try {
          await adminSetDifficult({ data: { vehicleId, isDifficult: next } })
          await onSaved()
        } catch (err) {
          setChecked(!next)
          onError(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    />
  )
}
