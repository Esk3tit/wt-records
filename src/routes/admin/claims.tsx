import { useState } from 'react'
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { ImageOff } from 'lucide-react'
import { PlayerAvatar } from '#/components/player-avatar'
import {
  ErrorNote,
  Field,
  Panel,
  buttonClass,
  commitButtonClass,
  errorMessage,
  inputClass,
  subtleButtonClass,
} from '#/components/admin/ui'
import { ConfirmDialog } from '#/components/admin/confirm-dialog'
import { MAX_NOTE_LENGTH } from '#/claims/limits'
import { ADMIN_PAGE_SIZE, Pager, pageParam } from '#/components/admin/pager'
import { formatDayTime } from '#/lib/dates'
import {
  approveAmendmentRequest,
  approveClaimRequest,
  clearClaimDenialRequest,
  denyClaimRequest,
  rejectAmendmentRequest,
  reviewQueue,
} from '#/claims/api'

/* Review: one screen where things await a Moderator, in two panels that never
   merge — a claim is a judgement about identity, verified on Discord, and an
   Amendment is a judgement about content. The route keeps its path; the tab
   and the screen are Review. */

export const Route = createFileRoute('/admin/claims')({
  validateSearch: (s: Record<string, unknown>) => ({ page: pageParam(s.page) }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (context.gate.state !== 'moderator') return null
    return reviewQueue({
      data: { deniedOffset: ((deps.page ?? 1) - 1) * ADMIN_PAGE_SIZE },
    })
  },
  component: ReviewQueue,
})

type Queue = NonNullable<Awaited<ReturnType<typeof reviewQueue>>>
type QueuedClaim = Queue['claims'][number]
type QueuedAmendment = Queue['amendments'][number]

/* Both lists sit on the same card: a request, whichever way it went. */
const claimCardClass =
  'rounded-[14px] border border-hairline-soft bg-[var(--tint)]'

/** Big enough to actually judge: offensive detail is often small, and a
    thumbnail-sized decision surface is how a bad image gets through. */
const JUDGEABLE = 200

const DAY_MS = 86_400_000

/* A row's key across both queues: a claim id and an Amendment id are both
   small integers, and the busy control must be the one that was pressed. */
const claimKey = (id: number) => `claim:${id}`
const amendmentKey = (id: number) => `amendment:${id}`

function ReviewQueue() {
  const queue = Route.useLoaderData()
  const page = Route.useSearch().page ?? 1
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [denying, setDenying] = useState<QueuedClaim | null>(null)
  const [rejecting, setRejecting] = useState<QueuedAmendment | null>(null)
  const [reason, setReason] = useState('')
  // The seed is decided beside the claim, not inside it: unticked here, the
  // approval links the User onto the Medallion instead.
  const [declinedSeeds, setDeclinedSeeds] = useState<number[]>([])
  // Kept per row, so the message lands under the list being worked in.
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(
    null,
  )
  const [handledElsewhere, setHandledElsewhere] = useState(false)
  if (!queue) return null
  const { claims, amendments } = queue
  const errorIn = (keys: string[]) =>
    failed && keys.includes(failed.key) ? failed.message : null

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusyKey(key)
    setFailed(null)
    setHandledElsewhere(false)
    let outcome: unknown
    try {
      outcome = await fn()
    } catch (e) {
      // Only a failed mutation is an error; a failed refresh below is not.
      setFailed({ key, message: errorMessage(e) })
      setBusyKey(null)
      return
    }
    // A resolve that lost the compare-and-set: the other Moderator's decision
    // stands, which is an outcome rather than a failure.
    if (unresolved(outcome)) setHandledElsewhere(true)
    // The decision committed — a failed refresh must not read as a failure
    // and invite a duplicate action against a row that no longer exists.
    await router.invalidate().catch(() => undefined)
    setBusyKey(null)
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
          — before approving. The picture they chose to seed is a second
          decision: untick it and the claim is approved onto the Medallion. A
          claim is permanent: only a revoke undoes it. Denying is remembered,
          and refuses that user this player for good.
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
                acceptSeed={!declinedSeeds.includes(claim.id)}
                onSeed={(accept) =>
                  setDeclinedSeeds((declined) =>
                    accept
                      ? declined.filter((id) => id !== claim.id)
                      : [...declined, claim.id],
                  )
                }
                busy={busyKey === claimKey(claim.id)}
                disabled={busyKey != null}
                onApprove={() =>
                  act(claimKey(claim.id), () =>
                    approveClaimRequest({
                      data: {
                        claimId: claim.id,
                        acceptSeed: !declinedSeeds.includes(claim.id),
                      },
                    }),
                  )
                }
                onDeny={() => setDenying(claim)}
              />
            ))}
          </ul>
        )}

        <ErrorNote error={errorIn(claims.map((c) => claimKey(c.id)))} />
      </Panel>

      <Panel
        title="Pending amendments"
        aside={
          amendments.length > 0 ? (
            <span className="text-sm text-fg-muted">
              {amendments.length} awaiting review
            </span>
          ) : undefined
        }
      >
        <p className="mb-4 max-w-prose text-sm text-fg-muted">
          A holder proposed this change to their own profile and is being served
          it already — nobody else sees it until you approve. Refusing is not
          taking anything down: what is live now stays live, and the refused
          picture is deleted. To clear a published avatar instead, use Reset to
          Medallion on the player.
        </p>

        {amendments.length === 0 ? (
          <p className="text-sm text-fg-faint">
            No changes are awaiting review.
          </p>
        ) : (
          <ul className="space-y-3">
            {amendments.map((amendment) => (
              <AmendmentRow
                key={amendment.id}
                amendment={amendment}
                busy={busyKey === amendmentKey(amendment.id)}
                disabled={busyKey != null}
                onApprove={() =>
                  act(amendmentKey(amendment.id), () =>
                    approveAmendmentRequest({
                      data: { amendmentId: amendment.id },
                    }),
                  )
                }
                onReject={() => setRejecting(amendment)}
              />
            ))}
          </ul>
        )}

        {handledElsewhere && (
          <p role="status" className="mt-3 text-sm text-fg-muted">
            Another moderator resolved that one first — the list is up to date.
          </p>
        )}
        <ErrorNote error={errorIn(amendments.map((a) => amendmentKey(a.id)))} />
      </Panel>

      <DenyDialog
        claim={denying}
        reason={reason}
        onReason={setReason}
        busy={denying != null && busyKey === claimKey(denying.id)}
        onCancel={() => {
          setDenying(null)
          setReason('')
        }}
        onConfirm={() => {
          const claim = denying
          if (!claim) return
          setDenying(null)
          setReason('')
          act(claimKey(claim.id), () =>
            denyClaimRequest({ data: { claimId: claim.id, reason } }),
          )
        }}
      />

      <RejectDialog
        amendment={rejecting}
        reason={reason}
        onReason={setReason}
        busy={rejecting != null && busyKey === amendmentKey(rejecting.id)}
        onCancel={() => {
          setRejecting(null)
          setReason('')
        }}
        onConfirm={() => {
          const amendment = rejecting
          if (!amendment) return
          setRejecting(null)
          setReason('')
          act(amendmentKey(amendment.id), () =>
            rejectAmendmentRequest({
              data: { amendmentId: amendment.id, reason },
            }),
          )
        }}
      />

      <DeniedClaims
        claims={queue.denied.rows}
        hasMore={queue.denied.hasMore}
        page={page}
        onPage={(p) => navigate({ search: { page: p } })}
        busyKey={busyKey}
        error={errorIn(queue.denied.rows.map((c) => claimKey(c.id)))}
        onClear={(id) =>
          act(claimKey(id), () =>
            clearClaimDenialRequest({ data: { claimId: id } }),
          )
        }
      />
    </div>
  )
}

function unresolved(outcome: unknown): boolean {
  return (
    typeof outcome === 'object' &&
    outcome !== null &&
    'resolved' in outcome &&
    outcome.resolved === false
  )
}

/* Denying is the one moderator action with no undo but another moderator, so
   it confirms — and the reason is what that moderator will weigh. */
function DenyDialog({
  claim,
  reason,
  onReason,
  busy,
  onConfirm,
  onCancel,
}: {
  claim: QueuedClaim | null
  reason: string
  onReason: (reason: string) => void
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={claim != null}
      title={`Deny the claim on ${claim?.playerDisplayName ?? ''}?`}
      confirmLabel="Deny"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        {claim?.requesterHandle ?? 'This user'} can never ask for this player
        again — the refusal is remembered. Any moderator can clear it here if it
        turns out to be fixable.
      </p>
      <Field label="Reason" hint="Optional — shown to whoever weighs a clear.">
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          placeholder="e.g. no proof they are this holder"
          className={inputClass}
        />
      </Field>
    </ConfirmDialog>
  )
}

/* The reason is the entire record of a refusal: four rejections mean something
   different if they were all blurry rather than all hateful. It stays in
   /admin — the holder is told nothing, which is the shadow working. */
function RejectDialog({
  amendment,
  reason,
  onReason,
  busy,
  onConfirm,
  onCancel,
}: {
  amendment: QueuedAmendment | null
  reason: string
  onReason: (reason: string) => void
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={amendment != null}
      title={`Refuse this change to ${amendment?.playerDisplayName ?? ''}?`}
      confirmLabel="Reject"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        What is published stays exactly as it is — refusing a change is not
        removing what is already live. The proposed image is deleted, and the
        holder is told nothing.
      </p>
      <Field label="Reason" hint="Optional — kept here, never shown publicly.">
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          placeholder="e.g. not a picture of a person"
          className={inputClass}
        />
      </Field>
    </ConfirmDialog>
  )
}

function DeniedClaims({
  claims,
  hasMore,
  page,
  onPage,
  busyKey,
  error,
  onClear,
}: {
  claims: QueuedClaim[]
  hasMore: boolean
  page: number
  onPage: (page: number | undefined) => void
  busyKey: string | null
  error: string | null
  onClear: (claimId: number) => void
}) {
  if (claims.length === 0 && page <= 1) return null
  return (
    <Panel title="Denied requests">
      <p className="mb-4 max-w-prose text-sm text-fg-muted">
        A denied request is remembered: that user can never ask for that player
        again. Clear a denial made for something fixable — a useless note, the
        wrong player picked by accident — and they may ask once more.
      </p>
      {claims.length === 0 && (
        <p className="text-sm text-fg-faint">Nothing this far back.</p>
      )}
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
              {claim.decidedReason && (
                <span className="mt-1 block text-xs text-fg-muted italic">
                  “{claim.decidedReason}”
                </span>
              )}
            </span>
            <button
              type="button"
              className={subtleButtonClass}
              disabled={busyKey != null}
              onClick={() => onClear(claim.id)}
            >
              {busyKey === claimKey(claim.id) ? 'Working…' : 'Clear denial'}
            </button>
          </li>
        ))}
      </ul>
      <Pager page={page} hasMore={hasMore} onPage={onPage} />
      <ErrorNote error={error} />
    </Panel>
  )
}

function ClaimRow({
  claim,
  acceptSeed,
  onSeed,
  busy,
  disabled,
  onApprove,
  onDeny,
}: {
  claim: QueuedClaim
  acceptSeed: boolean
  onSeed: (accept: boolean) => void
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
            <AgeStamp at={claim.createdAt} />
          </div>

          {claim.seedAvatarUrl ? (
            <figure className="mt-3">
              <ProposedImage
                url={claim.seedAvatarUrl}
                alt={`Avatar ${claim.requesterHandle ?? 'this user'} would seed`}
              />
              <figcaption className="mt-2 max-w-[200px] text-xs text-fg-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={acceptSeed}
                    disabled={disabled}
                    onChange={(e) => onSeed(e.target.checked)}
                  />
                  Seed this picture
                </label>
                {!acceptSeed && (
                  <span className="mt-1 block text-fg-faint">
                    Approving keeps the Medallion.
                  </span>
                )}
              </figcaption>
            </figure>
          ) : (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-faint">
              <ImageOff size={13} aria-hidden />
              keeps the Medallion
            </div>
          )}

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

/* One row per Amendment, rendered on `field` — a second shadowed field is a
   renderer here and a row in this switch, not a new screen. */
function AmendmentRow({
  amendment,
  busy,
  disabled,
  onApprove,
  onReject,
}: {
  amendment: QueuedAmendment
  busy: boolean
  disabled: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <li className={`${claimCardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            <Link
              to="/admin/players/$id"
              params={{ id: String(amendment.playerId) }}
              className="font-semibold text-fg"
            >
              {amendment.playerDisplayName}
            </Link>
            <span className="text-xs text-fg-faint">
              {amendment.submitterHandle ?? 'Unknown handle'}
            </span>
            <AgeStamp at={amendment.submittedAt} />
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-5">
            <figure>
              <ProposedImage
                url={amendment.valueUrl}
                alt={`Proposed avatar for ${amendment.playerDisplayName}`}
              />
              <figcaption className="mt-2 text-xs tracking-wide text-fg-faint uppercase">
                Proposed
              </figcaption>
            </figure>
            <figure>
              <PlayerAvatar
                avatarUrl={amendment.publishedUrl}
                displayName={amendment.playerDisplayName}
                size={96}
              />
              <figcaption className="mt-2 text-xs tracking-wide text-fg-faint uppercase">
                Live now · {amendment.publishedValue ? 'Avatar' : 'Medallion'}
              </figcaption>
            </figure>
          </div>

          <PriorRejections rejections={amendment.priorRejections} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={subtleButtonClass}
            disabled={disabled}
            onClick={onReject}
          >
            Reject
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

/** The picture under judgement. A key can outlive its object and a Discord CDN
    URL dies the moment its owner changes their picture, so a dead link renders
    as plainly missing — never as a broken frame, and never as the Medallion,
    which would read as a decision about something that is live. */
function ProposedImage({ url, alt }: { url: string | null; alt: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url || failedUrl === url) {
    return (
      <div
        role="img"
        aria-label="Image missing"
        style={{ width: JUDGEABLE, height: JUDGEABLE }}
        className="flex items-center justify-center rounded-[10px] border border-dashed border-hairline-soft bg-[var(--tint-strong)] px-4 text-center text-sm text-fg-muted"
      >
        Image missing — nothing is there to look at.
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open full size">
      <img
        src={url}
        alt={alt}
        width={JUDGEABLE}
        height={JUDGEABLE}
        style={{ width: JUDGEABLE, height: JUDGEABLE }}
        className="rounded-[10px] border border-hairline-soft object-cover"
        // A server-rendered image that failed before hydration never fires an
        // error at React, and a broken frame is exactly what must not render.
        ref={(node) => {
          if (node?.complete && node.naturalWidth === 0) setFailedUrl(url)
        }}
        onError={() => setFailedUrl(url)}
      />
    </a>
  )
}

/** The target is a day, carried by the UI rather than by policy: pending never
    expires, in either direction. One threshold, not two — and the nag is the
    semantic warn token, because /admin reserves the amber primary for the
    single commit action per view. */
function AgeStamp({ at }: { at: Date | string | null }) {
  if (!at) return null
  const submitted = at instanceof Date ? at : new Date(at)
  const overdue = Date.now() - submitted.getTime() >= DAY_MS
  return (
    <time
      dateTime={submitted.toISOString()}
      className={`text-xs ${overdue ? 'text-status-warn' : 'text-fg-faint'}`}
    >
      {formatDayTime(submitted)}
      {overdue && ' · waiting over a day'}
    </time>
  )
}

/** Shown only when there are any: the row is quiet by default, and a count on
    its own would say nothing a reason does not say better. */
function PriorRejections({
  rejections,
}: {
  rejections: QueuedAmendment['priorRejections']
}) {
  if (rejections.length === 0) return null
  return (
    <div className="mt-3 max-w-prose rounded-[8px] bg-[var(--tint-strong)] px-3 py-2 text-xs">
      <p className="text-status-warn">
        Refused {rejections.length} {rejections.length === 1 ? 'time' : 'times'}{' '}
        before
      </p>
      <ul className="mt-1 space-y-0.5 text-fg-muted">
        {rejections.map((rejection, at) => (
          <li key={at}>
            {rejection.reason ? `“${rejection.reason}”` : 'No reason recorded'}
            {rejection.reviewedAt &&
              ` · ${formatDayTime(rejection.reviewedAt)}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
