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
  approveClaimRequest,
  approvePendingAmendment,
  clearClaimDenialRequest,
  denyClaimRequest,
  rejectPendingAmendment,
  reviewQueue,
} from '#/claims/api'
import { alreadyBroken } from '#/lib/images'

/* Review: one screen where things await a Moderator, in two panels that never
   merge — a claim judges identity, an Amendment judges content. The route
   keeps its path; the tab and the screen are Review. */

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

/* A row's key across all three lists: a claim id and an Amendment id are both
   small integers, and the busy control must be the one that was pressed. The
   prefix is also which list a failure belongs under. */
const claimKey = (id: number) => `claim:${id}`
const amendmentKey = (id: number) => `amendment:${id}`
const denialKey = (id: number) => `denial:${id}`

/* What an action says when it did not do what pressing it implied. Neither is
   a failure, and both outlive the row they were about. */
const SETTLED =
  'That one was already settled — nothing was changed, and the list is up to date.'
const SEED_GONE =
  'That picture was gone by the time we fetched it, so the claim was approved onto the Medallion.'

const settledNotice = (outcome: { resolved: boolean }) =>
  outcome.resolved ? null : SETTLED

function ReviewQueue() {
  const queue = Route.useLoaderData()
  const page = Route.useSearch().page ?? 1
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [denying, setDenying] = useState<QueuedClaim | null>(null)
  const [rejecting, setRejecting] = useState<QueuedAmendment | null>(null)
  const [reason, setReason] = useState('')
  // Held by list rather than by row: a decision that lost its race takes the
  // row away, and a message that goes with it reads exactly like success.
  const [failed, setFailed] = useState<{
    list: string
    message: string
  } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  if (!queue) return null
  const { claims, amendments } = queue
  const errorIn = (list: string) =>
    failed?.list === list ? failed.message : null

  const act = async (key: string, fn: () => Promise<string | null>) => {
    setBusyKey(key)
    setFailed(null)
    setNotice(null)
    try {
      setNotice(await fn())
    } catch (e) {
      setFailed({ list: key.split(':')[0], message: errorMessage(e) })
    }
    // Refetched whichever way it went, so a row somebody else resolved leaves
    // rather than inviting a second press. A failed refresh is not a failure.
    await router.invalidate().catch(() => undefined)
    setBusyKey(null)
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p
          role="status"
          className="rounded-[10px] border border-hairline-soft bg-[var(--tint)] px-4 py-2.5 text-sm text-fg-muted"
        >
          {notice}
        </p>
      )}

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
        {claims.length === 0 ? (
          <p className="text-sm text-fg-faint">
            No claims are awaiting review.
          </p>
        ) : (
          <>
            <p className="mb-4 max-w-prose text-sm text-fg-muted">
              Verify the requester on Discord before approving — recognise them,
              or ask in the server. The picture they chose is a second decision.
            </p>
            <ul className="space-y-3">
              {claims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  busy={busyKey === claimKey(claim.id)}
                  disabled={busyKey != null}
                  now={queue.now}
                  onApprove={(acceptSeed) =>
                    act(claimKey(claim.id), async () => {
                      const { avatarSeeded } = await approveClaimRequest({
                        data: { claimId: claim.id, acceptSeed },
                      })
                      return acceptSeed && claim.seedAvatarUrl && !avatarSeeded
                        ? SEED_GONE
                        : null
                    })
                  }
                  onDeny={() => setDenying(claim)}
                />
              ))}
            </ul>
          </>
        )}

        <ErrorNote error={errorIn('claim')} />
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
        {amendments.length === 0 ? (
          <p className="text-sm text-fg-faint">
            No changes are awaiting review.
          </p>
        ) : (
          <>
            <p className="mb-4 max-w-prose text-sm text-fg-muted">
              The holder is being served this already — nobody else sees it
              until you approve.
            </p>
            <ul className="space-y-3">
              {amendments.map((amendment) => (
                <AmendmentRow
                  key={amendment.id}
                  amendment={amendment}
                  busy={busyKey === amendmentKey(amendment.id)}
                  disabled={busyKey != null}
                  now={queue.now}
                  onApprove={() =>
                    act(amendmentKey(amendment.id), async () =>
                      settledNotice(
                        await approvePendingAmendment({
                          data: { amendmentId: amendment.id },
                        }),
                      ),
                    )
                  }
                  onReject={() => setRejecting(amendment)}
                />
              ))}
            </ul>
          </>
        )}

        <ErrorNote error={errorIn('amendment')} />
      </Panel>

      <DenyDialog
        claim={denying}
        reason={reason}
        onReason={setReason}
        onCancel={() => {
          setDenying(null)
          setReason('')
        }}
        onConfirm={() => {
          const claim = denying
          if (!claim) return
          setDenying(null)
          setReason('')
          act(claimKey(claim.id), async () => {
            await denyClaimRequest({ data: { claimId: claim.id, reason } })
            return null
          })
        }}
      />

      <RejectDialog
        amendment={rejecting}
        reason={reason}
        onReason={setReason}
        onCancel={() => {
          setRejecting(null)
          setReason('')
        }}
        onConfirm={() => {
          const amendment = rejecting
          if (!amendment) return
          setRejecting(null)
          setReason('')
          act(amendmentKey(amendment.id), async () =>
            settledNotice(
              await rejectPendingAmendment({
                data: { amendmentId: amendment.id, reason },
              }),
            ),
          )
        }}
      />

      <DeniedClaims
        claims={queue.denied.rows}
        hasMore={queue.denied.hasMore}
        page={page}
        onPage={(p) => navigate({ search: { page: p } })}
        busyKey={busyKey}
        error={errorIn('denial')}
        onClear={(id) =>
          act(denialKey(id), async () => {
            await clearClaimDenialRequest({ data: { claimId: id } })
            return null
          })
        }
      />
    </div>
  )
}

/* Denying is the one moderator action with no undo but another moderator, so
   it confirms — and the reason is what that moderator will weigh. */
function DenyDialog({
  claim,
  reason,
  onReason,
  onConfirm,
  onCancel,
}: {
  claim: QueuedClaim | null
  reason: string
  onReason: (reason: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={claim != null}
      title={`Deny the claim on ${claim?.playerDisplayName ?? ''}?`}
      confirmLabel="Deny"
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
  onConfirm,
  onCancel,
}: {
  amendment: QueuedAmendment | null
  reason: string
  onReason: (reason: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={amendment != null}
      title={`Refuse this change to ${amendment?.playerDisplayName ?? ''}?`}
      confirmLabel="Reject"
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
              {busyKey === denialKey(claim.id) ? 'Working…' : 'Clear denial'}
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
  busy,
  disabled,
  now,
  onApprove,
  onDeny,
}: {
  claim: QueuedClaim
  busy: boolean
  disabled: boolean
  now: number
  onApprove: (acceptSeed: boolean) => void
  onDeny: () => void
}) {
  // The seed decision lives with the row it is about; rows are keyed by id, so
  // it survives a refetch exactly as the row does.
  const [acceptSeed, setAcceptSeed] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  // No URL at all is as unseeable as one that would not load, and derived
  // rather than remembered so the two can never disagree. A picture nobody
  // could look at is never seeded — but the claim itself is a separate
  // decision, and stays open.
  const unseeable = claim.seedAvatarUrl == null || loadFailed
  const seeding = acceptSeed && !unseeable
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
            <AgeStamp at={claim.createdAt} now={now} />
          </div>

          {claim.seedAvatarUrl ? (
            <figure className="mt-3">
              <ProposedImage
                url={claim.seedAvatarUrl}
                alt={`Avatar ${claim.requesterHandle ?? 'this user'} would seed`}
                onUnseeable={() => setLoadFailed(true)}
              />
              <figcaption className="mt-2 max-w-[200px] text-xs text-fg-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={seeding}
                    disabled={disabled || unseeable}
                    onChange={(e) => setAcceptSeed(e.target.checked)}
                  />
                  Seed this picture
                </label>
                {!seeding && (
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
            className={commitButtonClass}
            disabled={disabled}
            onClick={() => onApprove(seeding)}
          >
            {busy ? 'Working…' : 'Approve'}
          </button>
        </div>
      </div>
    </li>
  )
}

/* One row per Amendment. Avatar is the only shadowed field, so this renders
   images; a second field brings its own rendering here, not its own screen. */
function AmendmentRow({
  amendment,
  busy,
  disabled,
  now,
  onApprove,
  onReject,
}: {
  amendment: QueuedAmendment
  busy: boolean
  disabled: boolean
  now: number
  onApprove: () => void
  onReject: () => void
}) {
  // Publishing is the one thing that must not be possible without having seen
  // it: a load that failed here proves the picture is unseen, never that it is
  // harmless, and no URL at all is the same fact arriving earlier. Reject stays
  // open — refusing something unshowable is a decision.
  const [loadFailed, setLoadFailed] = useState(false)
  const unseeable = amendment.valueUrl == null || loadFailed
  return (
    <li className={`${claimCardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              to="/admin/players/$id"
              params={{ id: String(amendment.playerId) }}
              className="font-semibold"
            >
              {amendment.playerDisplayName}
            </Link>
            <span className="text-xs text-fg-faint">
              {amendment.submitterHandle ?? 'Unknown handle'}
            </span>
            <AgeStamp at={amendment.submittedAt} now={now} />
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-5">
            <figure>
              <ProposedImage
                url={amendment.valueUrl}
                alt={`Proposed avatar for ${amendment.playerDisplayName}`}
                onUnseeable={() => setLoadFailed(true)}
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

          <PriorRejections
            rejections={amendment.priorRejections}
            total={amendment.priorRejectionCount}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
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
              className={commitButtonClass}
              disabled={disabled || unseeable}
              onClick={onApprove}
            >
              {busy ? 'Working…' : 'Approve'}
            </button>
          </div>
          {unseeable && (
            <p className="max-w-[15rem] text-right text-xs text-status-warn">
              Nothing to approve until the picture loads — reload, or reject it.
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

/** The picture under judgement. A Discord CDN URL dies the moment its owner
    changes their picture, so a dead link renders as plainly missing — never as
    a broken frame, and never as the Medallion, which would read as a decision
    about something that is live.

    `onUnseeable` fires when it cannot be shown, because a load that failed on
    this machine says nothing about whether the picture exists: the row must
    stop offering to publish what nobody has looked at. */
function ProposedImage({
  url,
  alt,
  onUnseeable,
}: {
  url: string | null
  alt: string
  onUnseeable: () => void
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const missed = (node: HTMLImageElement | null) => {
    if (!alreadyBroken(node)) return
    setFailedUrl(url)
    onUnseeable()
  }
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
        // The seed is a third-party CDN URL, and a Referer would tell that host
        // the review path exists. The queue's existence is not public.
        referrerPolicy="no-referrer"
        style={{ width: JUDGEABLE, height: JUDGEABLE }}
        className="rounded-[10px] border border-hairline-soft object-cover"
        ref={missed}
        onError={() => {
          setFailedUrl(url)
          onUnseeable()
        }}
      />
    </a>
  )
}

/** A day is a target carried by the UI, never an expiry: no automatic
    disposition is acceptable in either direction. The nag is the semantic warn
    token — /admin spends its amber on the commit action. `now` is stamped by
    the loader, so a skewed client clock cannot invent or hide the nag. */
function AgeStamp({ at, now }: { at: Date | string | null; now: number }) {
  if (!at) return null
  const submitted = at instanceof Date ? at : new Date(at)
  const overdue = now - submitted.getTime() >= DAY_MS
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
  total,
}: {
  rejections: QueuedAmendment['priorRejections']
  total: number
}) {
  if (total === 0) return null
  return (
    <div className="mt-3 max-w-prose rounded-[8px] bg-[var(--tint-strong)] px-3 py-2 text-xs">
      <p className="text-status-warn">
        Refused {total} {total === 1 ? 'time' : 'times'} before
      </p>
      <ul className="mt-1 space-y-0.5 text-fg-muted">
        {rejections.map((rejection, at) => (
          <li key={at}>
            {rejection.reason ? `“${rejection.reason}”` : 'No reason recorded'}
            {rejection.reviewedAt &&
              ` · ${formatDayTime(rejection.reviewedAt)}`}
          </li>
        ))}
        {total > rejections.length && (
          <li className="text-fg-faint">
            and {total - rejections.length} older
          </li>
        )}
      </ul>
    </div>
  )
}
