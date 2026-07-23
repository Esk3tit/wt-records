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
  buttonClass,
  errorMessage,
  inputClass,
  subtleButtonClass,
} from '#/components/admin/ui'
import { AsyncCombobox } from '#/components/admin/combobox'
import { ConfirmDialog } from '#/components/admin/confirm-dialog'
import {
  adminAddAlias,
  adminMergePlayers,
  adminPlayerDetail,
  adminPlayerSearch,
  adminRemoveAlias,
  adminRenamePlayer,
} from '#/admin/api'
import { ClaimedChip } from '#/components/claimed-chip'
import { revokePlayerClaim } from '#/claims/api'

export const Route = createFileRoute('/admin/players/$id')({
  loader: async ({ context, params }) => {
    if (context.gate.state !== 'moderator') return null
    const id = Number(params.id)
    if (!Number.isInteger(id)) throw notFound()
    const detail = await adminPlayerDetail({ data: id })
    if (!detail) throw notFound()
    return detail
  },
  component: PlayerDetail,
})

function PlayerDetail() {
  const detail = Route.useLoaderData()
  if (!detail) return null
  // Keyed so ALL page state (rename, alias, merge pick, error) resets when
  // navigating player-to-player without a remount.
  return <PlayerDetailInner key={detail.player.id} />
}

function PlayerDetailInner() {
  const detail = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  if (!detail) return null
  const { player, aliases, records, lastIgn } = detail

  const refresh = () => router.invalidate()

  const call = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    // The mutation committed — a failed refresh must not read as a failure
    // (e.g. a revoke that succeeded but left the ClaimedChip until reload).
    await refresh().catch(() => undefined)
  }

  if (player.mergedInto != null) {
    return (
      <Panel title={player.displayName}>
        <p className="text-sm text-fg-muted">
          This player was merged into another —{' '}
          <Link
            to="/admin/players/$id"
            params={{ id: String(player.mergedInto) }}
          >
            open the survivor
          </Link>
          . The public page redirects there.
        </p>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <Panel
        title={player.displayName}
        aside={
          <Link
            to="/player/$slug"
            params={{ slug: player.slug }}
            className="text-sm text-fg-muted"
          >
            public page
          </Link>
        }
      >
        <RenameForm
          key={player.displayName}
          current={player.displayName}
          onRename={(name) =>
            call(() =>
              adminRenamePlayer({
                data: { playerId: player.id, displayName: name },
              }),
            )
          }
        />
        <p className="mt-2 text-xs text-fg-faint">Last IGN used: {lastIgn}</p>
        {player.userId && (
          <ClaimStatus
            onRevoke={() =>
              call(() => revokePlayerClaim({ data: { playerId: player.id } }))
            }
          />
        )}
      </Panel>

      <Panel title="Aliases">
        {aliases.length === 0 ? (
          <p className="text-sm text-fg-faint">No aliases.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {aliases.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span>{a.name}</span>
                <span className="text-xs text-fg-faint">
                  {a.kind} · {a.source}
                </span>
                <button
                  type="button"
                  className="text-xs text-fg-muted hover:text-fg"
                  onClick={() =>
                    call(() => adminRemoveAlias({ data: { aliasId: a.id } }))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddAliasForm
          onAdd={(name) =>
            call(() => adminAddAlias({ data: { playerId: player.id, name } }))
          }
        />
      </Panel>

      <Panel title="Records">
        {records.length === 0 ? (
          <p className="text-sm text-fg-faint">No records.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {records.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <Link to="/admin/records/$id" params={{ id: String(r.id) }}>
                  {r.vehicleName} · {r.mode.toUpperCase()} — {r.kills} kills
                </Link>
                <StatusChip status={r.status} isCurrent={r.isCurrent} />
                <span className="text-xs text-fg-faint">
                  as {r.ignSnapshot}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <MergePanel
        survivor={{ id: player.id, displayName: player.displayName }}
        // Already on the survivor's page — reload it to show the merge result.
        onMerged={refresh}
      />

      <ErrorNote error={error} />
    </div>
  )
}

function RenameForm({
  current,
  onRename,
}: {
  current: string
  onRename: (name: string) => void
}) {
  const [name, setName] = useState(current)
  return (
    <div>
      <div className="flex items-end gap-2">
        <Field label="Display name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass + ' w-72'}
          />
        </Field>
        <button
          type="button"
          className={buttonClass}
          disabled={!name.trim() || name.trim() === current}
          onClick={() => onRename(name.trim())}
        >
          Rename
        </button>
      </div>
      <p className="mt-1 text-xs text-fg-faint">
        The old name auto-drops to an alias.
      </p>
    </div>
  )
}

function AddAliasForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="mt-3 flex items-end gap-2 border-t border-hairline-soft pt-3">
      <Field label="Add alias">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass + ' w-72'}
        />
      </Field>
      <button
        type="button"
        className={subtleButtonClass}
        disabled={!name.trim()}
        onClick={() => {
          onAdd(name.trim())
          setName('')
        }}
      >
        Add
      </button>
    </div>
  )
}

function MergePanel({
  survivor,
  onMerged,
}: {
  survivor: { id: number; displayName: string }
  onMerged: () => void
}) {
  const [duplicate, setDuplicate] = useState<{
    id: number
    displayName: string
  } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Panel title="Merge a duplicate into this player">
      <p className="mb-3 text-sm text-fg-muted">
        <strong className="text-fg">{survivor.displayName}</strong> survives:
        the duplicate's records repoint here, its names become aliases, and its
        page redirects here. Refused when both players are claimed by different
        users.
      </p>
      <div className="max-w-sm">
        <AsyncCombobox
          id="merge-duplicate"
          placeholder="Search the duplicate player…"
          fetchItems={(q) => adminPlayerSearch({ data: q })}
          onError={(e) => setError(errorMessage(e))}
          itemKey={(p) => p.id}
          renderItem={(p) => p.displayName}
          onSelect={(p) => {
            if (p.id === survivor.id) {
              setError('That is the survivor — pick the duplicate to fold in')
              return
            }
            setError(null)
            setDuplicate({ id: p.id, displayName: p.displayName })
          }}
          onClear={() => setDuplicate(null)}
          selectedLabel={duplicate ? duplicate.displayName : null}
        />
      </div>
      <ErrorNote error={error} />
      <div className="mt-3">
        <button
          type="button"
          className={buttonClass}
          disabled={!duplicate}
          onClick={() => setConfirming(true)}
        >
          Merge…
        </button>
      </div>

      <ConfirmDialog
        open={confirming && duplicate != null}
        title="Merge players?"
        confirmLabel="Merge"
        busy={busy}
        onConfirm={async () => {
          if (!duplicate) return
          setBusy(true)
          setError(null)
          try {
            await adminMergePlayers({
              data: { survivorId: survivor.id, duplicateId: duplicate.id },
            })
            setDuplicate(null)
            setConfirming(false)
            onMerged()
          } catch (e) {
            setError(errorMessage(e))
            setConfirming(false)
          } finally {
            setBusy(false)
          }
        }}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {duplicate?.displayName} will be collapsed into {survivor.displayName}
          . This repoints every record and cannot be undone from the UI.
        </p>
      </ConfirmDialog>
    </Panel>
  )
}

function ClaimStatus({ onRevoke }: { onRevoke: () => Promise<void> | void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-hairline-soft pt-3">
      <ClaimedChip />
      <button
        type="button"
        className="text-sm text-status-danger transition-[filter] duration-200 hover:brightness-110"
        onClick={() => setConfirming(true)}
      >
        Revoke claim
      </button>
      <ConfirmDialog
        open={confirming}
        title="Revoke this claim?"
        confirmLabel="Revoke"
        busy={busy}
        onConfirm={async () => {
          setBusy(true)
          try {
            await onRevoke()
          } finally {
            setBusy(false)
            setConfirming(false)
          }
        }}
        onCancel={() => setConfirming(false)}
      >
        <p>
          The player returns to the accountless state and its avatar resets to
          the Medallion. Records and snapshots are untouched, and the user can
          claim again.
        </p>
      </ConfirmDialog>
    </div>
  )
}
