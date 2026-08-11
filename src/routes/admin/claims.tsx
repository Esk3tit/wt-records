import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ImageOff, Image as ImageIcon } from 'lucide-react'
import {
  ErrorNote,
  Panel,
  buttonClass,
  commitButtonClass,
  errorMessage,
  subtleButtonClass,
} from '#/components/admin/ui'
import { formatDayTime } from '#/lib/dates'
import {
  approveClaimRequest,
  claimQueue,
  clearClaimDenialRequest,
  denyClaimRequest,
} from '#/claims/api'

export const Route = createFileRoute('/admin/claims')({
  loader: async ({ context }) => {
    if (context.gate.state !== 'moderator') return null
    return claimQueue()
  },
  component: ClaimsQueue,
})

type Queue = NonNullable<Awaited<ReturnType<typeof claimQueue>>>
type QueuedClaim = Queue['pending'][number]

/* Both lists sit on the same card: a request, whichever way it went. */
const claimCardClass =
  'rounded-[14px] border border-hairline-soft bg-[var(--tint)]'

function ClaimsQueue() {
  const queue = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  // Kept per row, so the message lands under the list being worked in.
  const [failed, setFailed] = useState<{ id: number; message: string } | null>(
    null,
  )
  if (!queue) return null
  const claims = queue.pending
  const errorIn = (rows: { id: number }[]) =>
    failed && rows.some((r) => r.id === failed.id) ? failed.message : null

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id)
    setFailed(null)
    try {
      await fn()
    } catch (e) {
      // Only a failed mutation is an error; a failed refresh below is not.
      setFailed({ id, message: errorMessage(e) })
      setBusyId(null)
      return
    }
    // The approve/deny committed — a failed refresh must not read as a failure
    // and invite a duplicate action against a row that no longer exists.
    await router.invalidate().catch(() => undefined)
    setBusyId(null)
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Pending claims"
        aside={
          claims.length > 0 ? (
            <span className="text-sm text-fg-muted">
              {claims.length} awaiting review
            </span>
          ) : undefined
        }
      >
        <p className="mb-4 max-w-prose text-sm text-fg-muted">
          Verify the requester on Discord — recognise them, or ask in the server
          — before approving. Approving links the account and grants their
          avatar. A claim is permanent: only a revoke undoes it. Denying is
          remembered, and refuses that user this player for good.
        </p>

        {claims.length === 0 ? (
          <p className="text-sm text-fg-faint">
            No claims are awaiting review.
          </p>
        ) : (
          <ul className="space-y-3">
            {claims.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                busy={busyId === claim.id}
                disabled={busyId != null}
                onApprove={() =>
                  act(claim.id, () =>
                    approveClaimRequest({ data: { claimId: claim.id } }),
                  )
                }
                onDeny={() =>
                  act(claim.id, () =>
                    denyClaimRequest({ data: { claimId: claim.id } }),
                  )
                }
              />
            ))}
          </ul>
        )}

        <ErrorNote error={errorIn(claims)} />
      </Panel>

      <DeniedClaims
        claims={queue.denied.rows}
        hasMore={queue.denied.hasMore}
        busyId={busyId}
        error={errorIn(queue.denied.rows)}
        onClear={(id) =>
          act(id, () => clearClaimDenialRequest({ data: { claimId: id } }))
        }
      />
    </div>
  )
}

function DeniedClaims({
  claims,
  hasMore,
  busyId,
  error,
  onClear,
}: {
  claims: QueuedClaim[]
  hasMore: boolean
  busyId: number | null
  error: string | null
  onClear: (claimId: number) => void
}) {
  if (claims.length === 0) return null
  return (
    <Panel title="Denied requests">
      <p className="mb-4 max-w-prose text-sm text-fg-muted">
        A denied request is remembered: that user can never ask for that player
        again. Clear one you denied for something fixable — a useless note, the
        wrong player picked by accident — and they may ask once more.
      </p>
      <ul className="space-y-2">
        {claims.map((claim) => (
          <li
            key={claim.id}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm ${claimCardClass}`}
          >
            <span className="min-w-0">
              <Link
                to="/admin/players/$id"
                params={{ id: String(claim.playerId) }}
                className="font-semibold"
              >
                {claim.playerDisplayName}
              </Link>{' '}
              <span className="text-fg-muted">
                asked by {claim.requesterHandle ?? 'Unknown handle'}
              </span>
              <span className="block text-xs text-fg-faint">
                denied by {claim.decidedByHandle ?? 'a moderator'}
                {claim.decidedAt && ` · ${formatDayTime(claim.decidedAt)}`}
              </span>
            </span>
            <button
              type="button"
              className={subtleButtonClass}
              disabled={busyId != null}
              onClick={() => onClear(claim.id)}
            >
              {busyId === claim.id ? 'Working…' : 'Clear denial'}
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <p className="mt-3 text-xs text-fg-faint">
          The {claims.length} most recent — older denials still stand.
        </p>
      )}
      <ErrorNote error={error} />
    </Panel>
  )
}

function ClaimRow({
  claim,
  busy,
  disabled,
  onApprove,
  onDeny,
}: {
  claim: QueuedClaim
  busy: boolean
  disabled: boolean
  onApprove: () => void
  onDeny: () => void
}) {
  return (
    <li className={`${claimCardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              to="/admin/players/$id"
              params={{ id: String(claim.playerId) }}
              className="font-semibold"
            >
              {claim.playerDisplayName}
            </Link>
            {claim.aliases.length > 0 && (
              <span className="text-xs text-fg-faint">
                aka {claim.aliases.slice(0, 5).join(', ')}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-fg-muted">
            <span className="text-fg">
              {claim.requesterHandle ?? 'Unknown handle'}
            </span>
            {claim.requesterDiscordId && (
              <span className="text-xs text-fg-faint">
                Discord ID {claim.requesterDiscordId}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-faint">
            {claim.wantsAvatarSeed ? (
              <>
                <ImageIcon size={13} aria-hidden />
                seeds their avatar
              </>
            ) : (
              <>
                <ImageOff size={13} aria-hidden />
                keeps the Medallion
              </>
            )}
            {claim.createdAt && <span>· {formatDayTime(claim.createdAt)}</span>}
          </div>

          {claim.note && (
            <p className="mt-2 max-w-prose rounded-[8px] bg-[var(--tint-strong)] px-3 py-2 text-sm text-fg-muted">
              “{claim.note}”
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={subtleButtonClass}
            disabled={disabled}
            onClick={onDeny}
          >
            Deny
          </button>
          <button
            type="button"
            className={busy ? buttonClass : commitButtonClass}
            disabled={disabled}
            onClick={onApprove}
          >
            {busy ? 'Working…' : 'Approve'}
          </button>
        </div>
      </div>
    </li>
  )
}
