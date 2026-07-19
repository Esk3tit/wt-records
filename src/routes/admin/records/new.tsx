import { useCallback, useRef, useState } from 'react'
import {
  createFileRoute,
  useBlocker,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router'
import {
  ErrorNote,
  Field,
  Panel,
  blurOnWheel,
  buttonClass,
  commitButtonClass,
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
import { formatDayYear } from '#/lib/dates'
import { displayVehicleName } from '#/lib/vehicle-name'
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
  // "Add another" seeds the batch-stable fields from the previous save.
  validateSearch: (s: Record<string, unknown>): { m?: string; p?: string } => {
    const out: { m?: string; p?: string } = {}
    if (typeof s.m === 'string' && s.m) out.m = s.m
    if (typeof s.p === 'string' && s.p) out.p = s.p
    return out
  },
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

// Snapshot taken when the preview is requested: the confirm modal must
// describe and commit the SAME values, whatever the form does meanwhile.
interface SaveSnapshot {
  mode: string
  vehicleId: number
  vehicleName: string
  player: PlayerPick
  ign: string
  kills: number
  patch: string
  runBr: string
  proofs: ProofDraftState
}

function NewRecord() {
  const loaded = Route.useLoaderData()
  const seed = Route.useSearch()
  const { modes } = useLoaderData({ from: '__root__' })
  const navigate = useNavigate()

  const [mode, setMode] = useState(seed.m ?? 'grb')
  const [vehicle, setVehicle] = useState<VehicleContext | null>(null)
  const [player, setPlayer] = useState<PlayerPick | null>(null)
  const [ign, setIgn] = useState('')
  // Ref, not state: the post-await checks below must see the CURRENT value.
  const ignTouched = useRef(false)
  const [kills, setKills] = useState('')
  const [patchList, setPatchList] = useState(loaded?.patches ?? [])
  const [patch, setPatch] = useState(
    seed.p ?? loaded?.patches[0]?.version ?? '',
  )
  const [runBr, setRunBr] = useState('')
  const [proofs, setProofs] = useState<ProofDraftState>(emptyProofDrafts)
  const [addingPatch, setAddingPatch] = useState(false)
  const [pending, setPending] = useState<{
    preview: TitlePreview
    form: SaveSnapshot
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A mis-click on a nav tab must not silently destroy a half-entered record.
  const savedRef = useRef(false)
  const isDirty =
    !savedRef.current &&
    Boolean(
      vehicle ||
      player ||
      ign.trim() ||
      kills ||
      proofs.files.length > 0 ||
      proofs.videoUrl.trim(),
    )
  // In-app navigation goes through the designed dialog; only the hard
  // unload keeps the native prompt (that one can't be styled).
  const blocker = useBlocker({
    shouldBlockFn: () => true,
    disabled: !isDirty,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  })

  const lookupVehicles = useCallback(
    (q: string) => adminVehicleLookup({ data: { mode, q } }),
    [mode],
  )
  const searchPlayers = useCallback(
    (q: string) => adminPlayerSearch({ data: q }),
    [],
  )

  // A pick resolving after a mode switch (or a newer pick) must not land.
  const pickSeq = useRef(0)
  const pickVehicle = async (slug: string) => {
    const requestId = ++pickSeq.current
    try {
      const context = await adminEntryContext({
        data: { mode, vehicleSlug: slug },
      })
      if (pickSeq.current !== requestId || !context) return
      setVehicle(context)
      setRunBr(context.br != null ? formatBr(context.br) : '')
    } catch (e) {
      if (pickSeq.current === requestId) setError(errorMessage(e))
    }
  }

  // A prefill resolving after a clear/switch must not overwrite anything.
  const playerSeq = useRef(0)
  const pickPlayer = async (p: { id: number; displayName: string }) => {
    const requestId = ++playerSeq.current
    setPlayer({ kind: 'existing', ...p })
    try {
      const prefill = await adminPlayerPrefill({ data: p.id })
      if (playerSeq.current !== requestId || ignTouched.current) return
      setIgn(prefill?.lastIgn ?? p.displayName)
    } catch {
      // Prefill is a convenience; never leave the previous player's IGN.
      if (playerSeq.current !== requestId || ignTouched.current) return
      setIgn(p.displayName)
    }
  }

  // A double-click's older preview must not overwrite the newer snapshot.
  const saveSeq = useRef(0)
  const requestSave = async () => {
    const requestId = ++saveSeq.current
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
    const snapshot: SaveSnapshot = {
      mode,
      vehicleId: vehicle.vehicleId,
      vehicleName: vehicle.vehicleName,
      player,
      ign: ign.trim(),
      kills: killCount,
      patch,
      runBr: runBr.trim(),
      proofs,
    }
    try {
      const preview = await adminTitlePreview({
        data: {
          kind: 'entry',
          mode: snapshot.mode,
          vehicleId: snapshot.vehicleId,
          kills: snapshot.kills,
        },
      })
      if (saveSeq.current !== requestId) return
      setPending({ preview, form: snapshot })
    } catch (e) {
      if (saveSeq.current === requestId) setError(errorMessage(e))
    }
  }

  const confirmSave = async () => {
    if (!pending) return
    const snap = pending.form
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('mode', snap.mode)
      form.set('vehicleId', String(snap.vehicleId))
      if (snap.player.kind === 'existing') {
        form.set('playerId', String(snap.player.id))
      } else {
        form.set('newPlayerName', snap.player.displayName)
      }
      form.set('ignSnapshot', snap.ign)
      form.set('kills', String(snap.kills))
      form.set('patch', snap.patch)
      if (snap.runBr) form.set('runBr', snap.runBr)
      appendProofFormData(form, snap.proofs)
      const result = await adminSaveRecord({ data: form })
      savedRef.current = true
      navigate({
        to: '/admin/records/$id',
        params: { id: String(result.recordId) },
        search: { saved: true },
      })
    } catch (e) {
      setError(errorMessage(e))
      setPending(null)
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
                pickSeq.current++
                setMode(e.target.value)
                setVehicle(null)
                setRunBr('')
              }}
              className={selectClass + ' w-full'}
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
              autoFocus
              resetKey={mode}
              onError={(e) => setError(errorMessage(e))}
              itemKey={(v) => v.slug}
              renderItem={(v) => (
                <span className="flex items-baseline gap-2">
                  <span>{displayVehicleName(v.name)}</span>
                  <span className="text-xs text-fg-faint">
                    {v.nation}
                    {v.br != null ? ` · BR ${formatBr(v.br)}` : ''}
                  </span>
                </span>
              )}
              onSelect={(v) => void pickVehicle(v.slug)}
              onClear={() => {
                setVehicle(null)
                setRunBr('')
              }}
              selectedLabel={
                vehicle ? displayVehicleName(vehicle.vehicleName) : null
              }
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
                    ` (${formatDayYear(vehicle.current.verifiedAt)})`}
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
              onError={(e) => setError(errorMessage(e))}
              itemKey={(p) => p.id}
              renderItem={(p) => p.displayName}
              onSelect={(p) => void pickPlayer(p)}
              onClear={() => {
                playerSeq.current++
                setPlayer(null)
              }}
              selectedLabel={
                player
                  ? player.kind === 'new'
                    ? `${player.displayName} (new player)`
                    : player.displayName
                  : null
              }
              action={{
                label: (q) => <>Create player “{q}”</>,
                onAction: (q) => {
                  playerSeq.current++
                  setPlayer({ kind: 'new', displayName: q })
                  if (!ignTouched.current) setIgn(q)
                },
              }}
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
                ignTouched.current = true
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
                onWheel={blurOnWheel}
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
                onWheel={blurOnWheel}
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
                className={selectClass + ' w-full'}
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
                  // The patch row exists either way; select it even if the
                  // dropdown refetch fails.
                  setPatch(added)
                  adminPatchOptions().then(setPatchList, (e: unknown) =>
                    setError(errorMessage(e)),
                  )
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
            <button
              type="button"
              className={commitButtonClass}
              onClick={requestSave}
            >
              Save record…
            </button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={pending != null}
        title="Save this record?"
        confirmLabel="Save record"
        busy={busy}
        onConfirm={confirmSave}
        onCancel={() => setPending(null)}
      >
        {pending && (
          <>
            <p className="font-semibold text-fg">
              {pending.form.kills} kills ·{' '}
              {displayVehicleName(pending.form.vehicleName)} ·{' '}
              {pending.form.player.displayName}
              {pending.form.player.kind === 'new' ? ' (new player)' : ''} ·{' '}
              {pending.form.patch}
            </p>
            <p>
              {pending.preview.wouldBeCurrent
                ? pending.preview.demoted
                  ? `Saving this demotes ${pending.preview.demoted.playerName}'s ${pending.preview.demoted.kills}-kill record — this entry becomes the current title.`
                  : 'This entry becomes the current record for the vehicle.'
                : 'This entry does NOT take the title — it lands in history below the current record.'}
            </p>
            {pending.preview.belowThreshold && (
              <p className="text-status-warn">
                {pending.form.kills} kills is below the qualifying threshold
                {pending.preview.threshold != null
                  ? ` of ${pending.preview.threshold}`
                  : ''}{' '}
                for this vehicle — saving anyway will be noted in the audit log.
              </p>
            )}
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={blocker.status === 'blocked'}
        title="Discard this entry?"
        confirmLabel="Discard"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        <p>The record you're entering hasn't been saved.</p>
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
          disabled={busy}
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
