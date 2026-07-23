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
import { approveClaimRequest, claimQueue, denyClaimRequest } from '#/claims/api'

export const Route = createFileRoute('/admin/claims')({
  loader: async ({ context }) => {
    if (context.gate.state !== 'moderator') return null
    return claimQueue()
  },
  component: ClaimsQueue,
})

type PendingClaim = NonNullable<Awaited<ReturnType<typeof claimQueue>>>[number]

function ClaimsQueue() {
  const claims = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!claims) return null

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await router.invalidate()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
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
        Verify the requester on Discord — recognise them, or ask in the server —
        before approving. Approving links the account and grants their avatar.
        Denying leaves no trace on the player.
      </p>

      {claims.length === 0 ? (
        <p className="text-sm text-fg-faint">No claims are awaiting review.</p>
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
  claim: PendingClaim
  busy: boolean
  disabled: boolean
  onApprove: () => void
  onDeny: () => void
}) {
  return (
    <li className="rounded-[14px] border border-hairline-soft bg-[var(--tint)] p-4">
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
