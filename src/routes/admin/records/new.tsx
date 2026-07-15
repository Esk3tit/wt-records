import { useCallback, useState } from 'react'
import {
  createFileRoute,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router'
import {
  ErrorNote,
  Field,
  Panel,
  buttonClass,
  errorMessage,
  inputClass,
  selectClass,
  subtleButtonClass,
} from '#/components/admin/ui'
import { AsyncCombobox } from '#/components/admin/combobox'
import { ConfirmDialog } from '#/components/admin/confirm-dialog'
import {
  ProofUploader,
  appendProofFormData,
  emptyProofDrafts,
} from '#/components/admin/proof-uploader'
import type { ProofDraftState } from '#/components/admin/proof-uploader'
import { formatBr } from '#/lib/format'
import {
  adminAddPatch,
  adminEntryContext,
  adminPatchOptions,
  adminPlayerPrefill,
  adminPlayerSearch,
  adminSaveRecord,
  adminTitlePreview,
  adminVehicleLookup,
} from '#/admin/api'

export const Route = createFileRoute('/admin/records/new')({
  loader: async ({ context }) => {
    if (context.gate.state !== 'moderator') return null
    return { patches: await adminPatchOptions() }
  },
  component: NewRecord,
})

type VehicleContext = NonNullable<Awaited<ReturnType<typeof adminEntryContext>>>
type TitlePreview = Awaited<ReturnType<typeof adminTitlePreview>>
type PlayerPick =
  | { kind: 'existing'; id: number; displayName: string }
  | { kind: 'new'; displayName: string }

function NewRecord() {
  const loaded = Route.useLoaderData()
  const { modes } = useLoaderData({ from: '__root__' })
  const navigate = useNavigate()

  const [mode, setMode] = useState('grb')
  const [vehicle, setVehicle] = useState<VehicleContext | null>(null)
  const [player, setPlayer] = useState<PlayerPick | null>(null)
  const [ign, setIgn] = useState('')
  const [ignTouched, setIgnTouched] = useState(false)
  const [kills, setKills] = useState('')
  const [patchList, setPatchList] = useState(loaded?.patches ?? [])
  const [patch, setPatch] = useState(loaded?.patches[0]?.version ?? '')
  const [runBr, setRunBr] = useState('')
  const [proofs, setProofs] = useState<ProofDraftState>(emptyProofDrafts)
  const [addingPatch, setAddingPatch] = useState(false)
  const [preview, setPreview] = useState<TitlePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookupVehicles = useCallback(
    (q: string) => adminVehicleLookup({ data: { mode, q } }),
    [mode],
  )
  const searchPlayers = useCallback(
    (q: string) => adminPlayerSearch({ data: q }),
    [],
  )

  const pickVehicle = async (slug: string) => {
    const context = await adminEntryContext({
      data: { mode, vehicleSlug: slug },
    })
    if (!context) return
    setVehicle(context)
    if (context.br != null) setRunBr(String(context.br))
  }

  const pickPlayer = async (p: { id: number; displayName: string }) => {
    setPlayer({ kind: 'existing', ...p })
    const prefill = await adminPlayerPrefill({ data: p.id })
    if (!ignTouched) setIgn(prefill?.lastIgn ?? p.displayName)
  }

  const requestSave = async () => {
    setError(null)
    if (!vehicle) return setError('Pick a vehicle')
    if (!player) return setError('Pick a player or create one')
    if (!ign.trim()) return setError('An IGN is required')
    const killCount = Number(kills)
    if (!Number.isInteger(killCount) || killCount <= 0) {
      return setError('Kills must be a positive whole number')
    }
    if (!patch) return setError('Pick the patch the run was achieved on')
    if (proofs.files.length === 0 && !proofs.videoUrl.trim()) {
      return setError(
        'At least one proof (screenshot or video URL) is required',
      )
    }
    try {
      setPreview(
        await adminTitlePreview({
          data: {
            kind: 'entry',
            mode,
            vehicleId: vehicle.vehicleId,
            kills: killCount,
          },
        }),
      )
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const confirmSave = async () => {
    if (!vehicle || !player) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('mode', mode)
      form.set('vehicleId', String(vehicle.vehicleId))
      if (player.kind === 'existing') form.set('playerId', String(player.id))
      else form.set('newPlayerName', player.displayName)
      form.set('ignSnapshot', ign.trim())
      form.set('kills', kills)
      form.set('patch', patch)
      if (runBr.trim()) form.set('runBr', runBr.trim())
      appendProofFormData(form, proofs)
      const result = await adminSaveRecord({ data: form })
      navigate({
        to: '/admin/records/$id',
        params: { id: String(result.recordId) },
      })
    } catch (e) {
      setError(errorMessage(e))
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Panel title="New record">
        <div className="space-y-4">
          <Field label="Mode">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value)
                setVehicle(null)
              }}
              className={selectClass}
            >
              {modes.map((m) => (
                <option key={m.mode} value={m.mode}>
                  {m.mode.toUpperCase()} · {m.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vehicle">
            <AsyncCombobox
              id="entry-vehicle"
              placeholder="Type a vehicle name…"
              fetchItems={lookupVehicles}
              itemKey={(v) => v.slug}
              renderItem={(v) => (
                <span className="flex items-baseline gap-2">
                  <span>{v.name}</span>
                  <span className="text-xs text-fg-faint">
                    {v.nation}
                    {v.br != null ? ` · BR ${formatBr(v.br)}` : ''}
                  </span>
                </span>
              )}
              onSelect={(v) => void pickVehicle(v.slug)}
              onClear={() => setVehicle(null)}
              selectedLabel={vehicle ? vehicle.vehicleName : null}
            />
          </Field>

          {vehicle && (
            <p className="rounded-[10px] border border-hairline-soft px-3 py-2 text-sm text-fg-muted">
              {vehicle.current ? (
                <>
                  Current record:{' '}
                  <strong className="text-fg">
                    {vehicle.current.kills} kills
                  </strong>{' '}
                  by {vehicle.current.playerName}
                  {vehicle.current.verifiedAt &&
                    ` (${new Date(vehicle.current.verifiedAt).toLocaleDateString()})`}
                  . A new entry needs {vehicle.current.kills + 1}+ to take the
                  title.
                </>
              ) : (
                <>Open bounty — any qualifying entry takes the title.</>
              )}
            </p>
          )}

          <Field label="Player">
            <AsyncCombobox
              id="entry-player"
              placeholder="Display name or alias…"
              fetchItems={searchPlayers}
              itemKey={(p) => p.id}
              renderItem={(p) => p.displayName}
              onSelect={(p) => void pickPlayer(p)}
              onClear={() => setPlayer(null)}
              selectedLabel={
                player
                  ? player.kind === 'new'
                    ? `${player.displayName} (new player)`
                    : player.displayName
                  : null
              }
              footer={(q, close) =>
                q ? (
                  <li className="border-t border-hairline-soft">
                    <button
                      type="button"
                      className="w-full rounded-[10px] px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-white/5"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPlayer({ kind: 'new', displayName: q })
                        if (!ignTouched) setIgn(q)
                        close()
                      }}
                    >
                      Create player “{q}”
                    </button>
                  </li>
                ) : null
              }
            />
          </Field>

          <Field
            label="IGN at the time of the run"
            hint="Prefilled from the player's last record; an unknown IGN is saved as an alias."
          >
            <input
              type="text"
              value={ign}
              onChange={(e) => {
                setIgn(e.target.value)
                setIgnTouched(true)
              }}
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Kills">
              <input
                type="number"
                min={1}
                value={kills}
                onChange={(e) => setKills(e.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field
              label="Run BR"
              hint="Stored for /admin; public UI shows current BR."
            >
              <input
                type="number"
                step="0.1"
                value={runBr}
                onChange={(e) => setRunBr(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Patch">
            <div className="flex items-center gap-2">
              <select
                value={patch}
                onChange={(e) => setPatch(e.target.value)}
                className={selectClass}
              >
                {patchList.map((p) => (
                  <option key={p.version} value={p.version}>
                    {p.version}
                    {p.name ? ` · ${p.name}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={subtleButtonClass + ' whitespace-nowrap'}
                onClick={() => setAddingPatch(true)}
              >
                Add patch
              </button>
            </div>
          </Field>

          {addingPatch && (
            <AddPatchInline
              onDone={(added) => {
                setAddingPatch(false)
                if (added) {
                  adminPatchOptions().then((list) => {
                    setPatchList(list)
                    setPatch(added)
                  })
                }
              }}
            />
          )}

          <Field label="Proof (≥1 required)">
            <ProofUploader
              value={proofs}
              onChange={setProofs}
              idPrefix="entry"
            />
          </Field>

          <ErrorNote error={error} />

          <div className="flex justify-end">
            <button type="button" className={buttonClass} onClick={requestSave}>
              Save record…
            </button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={preview != null}
        title="Save this record?"
        confirmLabel="Save record"
        busy={busy}
        onConfirm={confirmSave}
        onCancel={() => setPreview(null)}
      >
        {preview && (
          <>
            <p>
              {preview.wouldBeCurrent
                ? preview.demoted
                  ? `Saving this demotes ${preview.demoted.playerName}'s ${preview.demoted.kills}-kill record — this entry becomes the current title.`
                  : 'This entry becomes the current record for the vehicle.'
                : 'This entry does NOT take the title — it lands in history below the current record.'}
            </p>
            {preview.belowThreshold && (
              <p className="text-amber-300">
                {Number(kills)} kills is below the qualifying threshold
                {preview.threshold != null
                  ? ` of ${preview.threshold}`
                  : ''}{' '}
                for this vehicle — saving anyway will be noted in the audit log.
              </p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}

function AddPatchInline({
  onDone,
}: {
  onDone: (added: string | null) => void
}) {
  const [version, setVersion] = useState('')
  const [name, setName] = useState('')
  const [releasedAt, setReleasedAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="rounded-[10px] border border-hairline-soft p-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Version">
          <input
            type="text"
            value={version}
            placeholder="2.54"
            onChange={(e) => setVersion(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Name (optional)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Release date" hint="Orders the dropdown.">
          <input
            type="date"
            value={releasedAt}
            onChange={(e) => setReleasedAt(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <ErrorNote error={error} />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => onDone(null)}
        >
          Cancel
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !version.trim()}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await adminAddPatch({
                data: {
                  version: version.trim(),
                  name: name.trim() || undefined,
                  releasedAt: releasedAt || undefined,
                },
              })
              onDone(version.trim())
            } catch (e) {
              setError(errorMessage(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          Add patch
        </button>
      </div>
    </div>
  )
}
