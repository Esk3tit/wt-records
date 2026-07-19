import { useState } from 'react'
import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from '@tanstack/react-router'
import {
  ErrorNote,
  Field,
  Panel,
  StatusChip,
  blurOnWheel,
  buttonClass,
  commitButtonClass,
  dangerButtonClass,
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
import { formatDayTime, formatDayYear } from '#/lib/dates'
import { displayVehicleName } from '#/lib/vehicle-name'
import {
  adminAttachProofs,
  adminDemoteRecord,
  adminMakeCurrent,
  adminPatchOptions,
  adminPlayerSearch,
  adminRecordDetail,
  adminRetireRecord,
  adminReverifyRecord,
  adminTitlePreview,
  adminUpdateRecord,
} from '#/admin/api'

export const Route = createFileRoute('/admin/records/$id')({
  validateSearch: (s: Record<string, unknown>): { saved?: boolean } =>
    s.saved === true ? { saved: true } : {},
  loader: async ({ context, params }) => {
    if (context.gate.state !== 'moderator') return null
    const id = Number(params.id)
    if (!Number.isInteger(id)) throw notFound()
    const [detail, patches] = await Promise.all([
      adminRecordDetail({ data: id }),
      adminPatchOptions(),
    ])
    if (!detail) throw notFound()
    return { detail, patches }
  },
  component: RecordDetail,
})

type Confirmation = {
  title: string
  confirmLabel: string
  body: React.ReactNode
  run: () => Promise<unknown>
}

function RecordDetail() {
  const loaded = Route.useLoaderData()
  if (!loaded) return null
  // Keyed so ALL page state (edit form, drafts, error, retire reason) resets
  // when navigating between records without a remount.
  return <RecordDetailInner key={loaded.detail.record.id} />
}

function RecordDetailInner() {
  const loaded = Route.useLoaderData()
  const { saved } = Route.useSearch()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [busy, setBusy] = useState(false)
  const [retireReason, setRetireReason] = useState('')

  if (!loaded) return null
  const { detail, patches } = loaded
  const { record, vehicle, player, proofs, siblings, threshold } = detail
  const recordId = record.id

  const refresh = () => router.invalidate()

  const runConfirmed = async () => {
    if (!confirmation) return
    setBusy(true)
    setError(null)
    try {
      await confirmation.run()
      setRetireReason('')
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      // Always close: a failure's message lands in the page ErrorNote, which
      // an open modal would otherwise hide.
      setConfirmation(null)
      setBusy(false)
    }
  }

  const previewThen = async (
    req: Parameters<typeof adminTitlePreview>[0]['data'],
    build: (
      preview: Awaited<ReturnType<typeof adminTitlePreview>>,
    ) => Confirmation,
  ) => {
    setError(null)
    try {
      setConfirmation(build(await adminTitlePreview({ data: req })))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link to="/admin" className="text-fg-muted no-underline hover:text-fg">
          ← Records
        </Link>
      </p>
      {saved && (
        <p
          role="status"
          className="rounded border border-hairline-soft px-3 py-2 text-sm"
        >
          <span className="font-semibold text-accent-text">Record saved</span>
          <span className="text-fg-muted">
            {record.isCurrent
              ? ' — now the current title.'
              : ' — landed in history below the current record.'}
          </span>
        </p>
      )}
      <Panel
        title={`${displayVehicleName(vehicle.name)} · ${record.mode.toUpperCase()}`}
        aside={
          <StatusChip status={record.status} isCurrent={record.isCurrent} />
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Meta label="Player">
            <Link to="/admin/players/$id" params={{ id: String(player.id) }}>
              {player.displayName}
            </Link>
          </Meta>
          <Meta label="IGN snapshot">{record.ignSnapshot}</Meta>
          <Meta label="Kills">{record.kills}</Meta>
          <Meta label="Patch">{record.patch}</Meta>
          <Meta label="Run BR">{record.runBr ?? '—'}</Meta>
          <Meta label="Verified">
            {record.verifiedAt ? formatDayTime(record.verifiedAt) : '—'}
          </Meta>
          <Meta label="Verifier">
            {detail.verifierHandle ??
              (record.importedFrom === 'sheet' ? (
                <span className="text-fg-faint">migrated</span>
              ) : (
                '—'
              ))}
          </Meta>
          <Meta label="Threshold">
            {threshold != null ? `${threshold} kills` : 'not configured'}
            {vehicle.isDifficult ? ' (difficult)' : ''}
          </Meta>
        </dl>
      </Panel>

      <EditPanel
        record={record}
        patches={patches}
        onPreviewKills={(kills, apply) =>
          previewThen({ kind: 'update', recordId, kills }, (preview) => ({
            title: 'Apply this kills edit?',
            confirmLabel: 'Save changes',
            body: (
              <>
                <p>
                  {preview.demoted
                    ? `This edit demotes ${preview.demoted.playerName}'s ${preview.demoted.kills}-kill record.`
                    : preview.promoted
                      ? `This edit hands the title to ${preview.promoted.playerName}'s ${preview.promoted.kills}-kill record.`
                      : preview.wouldBeCurrent
                        ? 'The record stays the current title.'
                        : 'The title does not change.'}
                </p>
                {preview.belowThreshold && (
                  <p className="text-status-warn">
                    The new kill count is below the qualifying threshold
                    {preview.threshold != null
                      ? ` of ${preview.threshold}`
                      : ''}
                    — saving anyway will be noted in the audit log.
                  </p>
                )}
              </>
            ),
            run: apply,
          }))
        }
        onPlainSave={async (patch) => {
          setError(null)
          try {
            await adminUpdateRecord({ data: { recordId, patch } })
            await refresh()
          } catch (e) {
            setError(errorMessage(e))
          }
        }}
      />

      <Panel title="Lifecycle">
        <div className="flex flex-wrap items-end gap-2">
          {record.status === 'verified' && (
            <>
              {!record.isCurrent && (
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={() =>
                    setConfirmation({
                      title: 'Make this record current?',
                      confirmLabel: 'Make current',
                      body: (
                        <p>
                          Overrides the automatic title rule for this vehicle —
                          the current holder is demoted.
                        </p>
                      ),
                      run: () => adminMakeCurrent({ data: { recordId } }),
                    })
                  }
                >
                  Make current…
                </button>
              )}
              {record.isCurrent && (
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={() =>
                    setConfirmation({
                      title: 'Demote this record?',
                      confirmLabel: 'Demote',
                      body: (
                        <p>
                          Clears the current flag; the next-best verified record
                          takes the title.
                        </p>
                      ),
                      run: () => adminDemoteRecord({ data: { recordId } }),
                    })
                  }
                >
                  Demote…
                </button>
              )}
              <div className="ml-auto flex items-end gap-2">
                <Field label="Retire reason">
                  <input
                    type="text"
                    value={retireReason}
                    onChange={(e) => setRetireReason(e.target.value)}
                    placeholder="e.g. debunked proof"
                    className={inputClass + ' w-72'}
                  />
                </Field>
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={!retireReason.trim()}
                  onClick={() =>
                    previewThen({ kind: 'retire', recordId }, (preview) => ({
                      title: 'Retire this record?',
                      confirmLabel: 'Retire record',
                      body: (
                        <>
                          <p>
                            The record leaves every public surface but stays
                            stored with its proof and audit trail.
                          </p>
                          <p>
                            {preview.promoted
                              ? `Retiring promotes ${preview.promoted.playerName}'s ${preview.promoted.kills}-kill record to the title.`
                              : record.isCurrent
                                ? 'No other verified record exists — the vehicle becomes an open bounty.'
                                : 'The current title is unaffected.'}
                          </p>
                        </>
                      ),
                      run: () =>
                        adminRetireRecord({
                          data: { recordId, reason: retireReason.trim() },
                        }),
                    }))
                  }
                >
                  Retire…
                </button>
              </div>
            </>
          )}
          {record.status === 'retired' && (
            <button
              type="button"
              className={commitButtonClass}
              onClick={() =>
                previewThen({ kind: 'reverify', recordId }, (preview) => ({
                  title: 'Re-verify this record?',
                  confirmLabel: 'Re-verify',
                  body: (
                    <p>
                      The record returns to public view.{' '}
                      {preview.wouldBeCurrent
                        ? preview.demoted
                          ? `It retakes the title, demoting ${preview.demoted.playerName}'s ${preview.demoted.kills}-kill record.`
                          : 'It becomes the current record.'
                        : 'It lands in history below the current record.'}
                    </p>
                  ),
                  run: () => adminReverifyRecord({ data: { recordId } }),
                }))
              }
            >
              Re-verify
            </button>
          )}
        </div>
      </Panel>

      <Panel title="Proof">
        {proofs.length === 0 ? (
          <p className="text-sm text-status-warn">
            No proof attached — this record needs at least one.
          </p>
        ) : (
          <ul className="flex flex-wrap items-start gap-4">
            {proofs.map((p) => (
              <li key={p.id} className="max-w-56 text-sm">
                {p.kind !== 'video' && p.url ? (
                  // The evidence IS the page's content — show it, don't cite it.
                  <ProofThumb
                    url={p.url}
                    kind={p.kind.replace('_', ' ')}
                    originalUrl={p.originalUrl}
                  />
                ) : (
                  <a
                    href={p.url ?? p.originalUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all"
                  >
                    {p.kind === 'video'
                      ? p.originalUrl
                      : (p.storagePath ?? p.url)}
                  </a>
                )}
                <span className="mt-1 flex items-center gap-2">
                  <span className="text-xs tracking-wide text-fg-faint uppercase">
                    {p.kind.replace('_', ' ')}
                  </span>
                  {p.storagePath && p.originalUrl && (
                    <a
                      href={p.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-fg-faint"
                    >
                      original
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <AttachProofs recordId={recordId} onAttached={refresh} />
      </Panel>

      <Panel title="Other records for this vehicle">
        {siblings.length === 0 ? (
          <p className="text-sm text-fg-faint">None.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {siblings.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <Link to="/admin/records/$id" params={{ id: String(s.id) }}>
                  {s.kills} kills — {s.playerName}
                </Link>
                <StatusChip status={s.status} isCurrent={s.isCurrent} />
                {s.verifiedAt && (
                  <span className="text-xs text-fg-faint">
                    {formatDayYear(s.verifiedAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ErrorNote error={error} />

      <ConfirmDialog
        open={confirmation != null}
        title={confirmation?.title ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirm'}
        busy={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmation(null)}
      >
        {confirmation?.body}
      </ConfirmDialog>
    </div>
  )
}

function ProofThumb({
  url,
  kind,
  originalUrl,
}: {
  url: string
  kind: string
  originalUrl: string | null
}) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    // A blank slab is indistinguishable from "no proof" — say what happened.
    return (
      <span className="proof-thumb flex items-center justify-center px-3 text-center text-xs text-fg-faint">
        Couldn't load —{' '}
        <a
          href={originalUrl ?? url}
          target="_blank"
          rel="noreferrer"
          className="ml-1 text-fg-muted"
        >
          open original
        </a>
      </span>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="proof-thumb">
      <img src={url} alt={`${kind} proof`} onError={() => setBroken(true)} />
    </a>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-fg-faint uppercase">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function EditPanel({
  record,
  patches,
  onPreviewKills,
  onPlainSave,
}: {
  record: {
    id: number
    kills: number
    ignSnapshot: string
    runBr: number | null
    patch: string
    playerId: number
  }
  patches: { version: string; name: string | null }[]
  onPreviewKills: (kills: number, apply: () => Promise<unknown>) => void
  onPlainSave: (patch: {
    kills?: number
    playerId?: number
    ignSnapshot?: string
    runBr?: number | null
    patch?: string
  }) => Promise<void>
}) {
  const [kills, setKills] = useState(String(record.kills))
  const [ign, setIgn] = useState(record.ignSnapshot)
  const [runBr, setRunBr] = useState(
    record.runBr != null ? String(record.runBr) : '',
  )
  const [patch, setPatch] = useState(record.patch)
  const [holder, setHolder] = useState<{
    id: number
    displayName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buildPatch = () => {
    const out: Parameters<typeof onPlainSave>[0] = {}
    const killCount = Number(kills)
    if (killCount !== record.kills) out.kills = killCount
    // A cleared IGN still goes to the server, whose required-check rejects
    // it visibly — silently keeping the old value would read as saved.
    if (ign.trim() !== record.ignSnapshot) out.ignSnapshot = ign.trim()
    const br = runBr.trim() === '' ? null : Number(runBr)
    if (br !== record.runBr) out.runBr = br
    if (patch !== record.patch) out.patch = patch
    if (holder) out.playerId = holder.id
    return out
  }

  const save = () => {
    setError(null)
    const patchSet = buildPatch()
    if (Object.keys(patchSet).length === 0) return
    if (
      patchSet.kills != null &&
      (!Number.isInteger(patchSet.kills) || patchSet.kills <= 0)
    ) {
      setError('Kills must be a positive whole number')
      return
    }
    if (patchSet.kills != null) {
      onPreviewKills(patchSet.kills, () =>
        Promise.resolve(onPlainSave(patchSet)),
      )
    } else {
      void onPlainSave(patchSet)
    }
  }

  return (
    <Panel title="Edit">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kills">
          <input
            type="number"
            min={1}
            value={kills}
            onWheel={blurOnWheel}
            onChange={(e) => setKills(e.target.value)}
            className={inputClass + ' max-w-32'}
          />
        </Field>
        <Field label="IGN snapshot">
          <input
            type="text"
            value={ign}
            onChange={(e) => setIgn(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Run BR">
          <input
            type="number"
            step="0.1"
            value={runBr}
            onWheel={blurOnWheel}
            onChange={(e) => setRunBr(e.target.value)}
            className={inputClass + ' max-w-32'}
          />
        </Field>
        <Field label="Patch">
          <select
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
            className={selectClass + ' w-full'}
          >
            {patches.map((p) => (
              <option key={p.version} value={p.version}>
                {p.version}
                {p.name ? ` · ${p.name}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Reassign holder"
          hint="Snapshots stay untouched — only the linked player changes."
        >
          <AsyncCombobox
            id="edit-holder"
            placeholder="Search players…"
            fetchItems={(q) => adminPlayerSearch({ data: q })}
            onError={(e) => setError(errorMessage(e))}
            itemKey={(p) => p.id}
            renderItem={(p) => p.displayName}
            onSelect={(p) =>
              setHolder({ id: p.id, displayName: p.displayName })
            }
            onClear={() => setHolder(null)}
            selectedLabel={holder ? holder.displayName : null}
          />
        </Field>
      </div>
      <ErrorNote error={error} />
      <div className="mt-4 flex justify-end">
        <button type="button" className={commitButtonClass} onClick={save}>
          Save changes
        </button>
      </div>
    </Panel>
  )
}

function AttachProofs({
  recordId,
  onAttached,
}: {
  recordId: number
  onAttached: () => void
}) {
  const [drafts, setDrafts] = useState<ProofDraftState>(emptyProofDrafts)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasAnything = drafts.files.length > 0 || drafts.videoUrl.trim() !== ''

  return (
    <div className="mt-4 border-t border-hairline-soft pt-4">
      <h3 className="mb-2 text-xs tracking-wide text-fg-faint uppercase">
        Attach more proof
      </h3>
      <ProofUploader value={drafts} onChange={setDrafts} idPrefix="attach" />
      <ErrorNote error={error} />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className={buttonClass}
          disabled={!hasAnything || busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              const form = new FormData()
              form.set('recordId', String(recordId))
              appendProofFormData(form, drafts)
              await adminAttachProofs({ data: form })
              setDrafts(emptyProofDrafts)
              onAttached()
            } catch (e) {
              setError(errorMessage(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Uploading…' : 'Attach proof'}
        </button>
      </div>
    </div>
  )
}
