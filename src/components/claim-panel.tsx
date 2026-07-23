import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { BadgeCheck, Clock, Loader2 } from 'lucide-react'
import { Medallion } from '#/components/medallion'
import { MAX_NOTE_LENGTH } from '#/claims/limits'
import { errorMessage } from '#/lib/errors'
import { releaseMyClaim, submitClaimRequest } from '#/claims/api'

export type ClaimViewer =
  | { signedIn: false }
  | {
      signedIn: true
      isOwner: boolean
      pending: boolean
      canClaim: boolean
      providerAvatarUrl: string | null
    }

const amberButton =
  'inline-flex items-center justify-center gap-1.5 rounded bg-accent px-3.5 py-2 text-sm font-semibold text-black no-underline transition-[filter] duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50'
const ghostButton =
  'inline-flex items-center justify-center gap-1.5 rounded border border-hairline-soft px-3.5 py-2 text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50'

/* The one claim affordance on a Player page, resolving to exactly one state for
   the viewer: sign-in-to-claim, request a claim, pending review, or "your page"
   with release. A page claimed by someone else shows nothing here — only the
   quiet indicator in the header. */
export function ClaimPanel({
  playerId,
  slug,
  viewer,
}: {
  playerId: number
  slug: string
  viewer: ClaimViewer
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await router.invalidate()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  let content: React.ReactNode = null

  if (!viewer.signedIn) {
    content = (
      <ClaimPrompt>
        <a
          className={amberButton}
          href={`/auth/login?next=${encodeURIComponent(`/player/${slug}`)}`}
        >
          Claim this page
        </a>
      </ClaimPrompt>
    )
  } else if (viewer.isOwner) {
    content = (
      <OwnerControls
        busy={busy}
        error={error}
        onRelease={() => run(() => releaseMyClaim({ data: { playerId } }))}
      />
    )
  } else if (viewer.pending) {
    content = (
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Clock size={15} className="shrink-0" aria-hidden />
        <span>
          Claim pending review — a moderator verifies this on Discord.
        </span>
      </div>
    )
  } else if (viewer.canClaim) {
    content = (
      <ClaimForm
        providerAvatarUrl={viewer.providerAvatarUrl}
        busy={busy}
        error={error}
        onSubmit={(note, seedAvatar) =>
          run(() =>
            submitClaimRequest({ data: { playerId, note, seedAvatar } }),
          )
        }
      />
    )
  }

  if (!content) return null
  return (
    <div className="mt-5 border-t border-hairline-soft pt-5">{content}</div>
  )
}

function ClaimPrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-fg-muted">Is this you?</p>
      {children}
    </div>
  )
}

function ClaimForm({
  providerAvatarUrl,
  busy,
  error,
  onSubmit,
}: {
  providerAvatarUrl: string | null
  busy: boolean
  error: string | null
  onSubmit: (note: string, seedAvatar: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [seedAvatar, setSeedAvatar] = useState(false)

  if (!open) {
    return (
      <ClaimPrompt>
        <button
          type="button"
          className={amberButton}
          onClick={() => setOpen(true)}
        >
          Claim this page
        </button>
      </ClaimPrompt>
    )
  }

  return (
    <form
      className="w-full max-w-sm space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(note.trim(), seedAvatar)
      }}
    >
      <div>
        <label
          htmlFor="claim-note"
          className="mb-1.5 block text-xs font-medium tracking-wide text-fg-faint uppercase"
        >
          Note for the moderator{' '}
          <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea
          id="claim-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          placeholder="e.g. same name in the Discord, or a match you're in"
          className="w-full resize-y rounded-[10px] border border-hairline bg-[var(--tint)] px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-[var(--glass-edge)]"
        />
      </div>

      {providerAvatarUrl && (
        <AvatarSeedChoice
          providerAvatarUrl={providerAvatarUrl}
          seedAvatar={seedAvatar}
          onChange={setSeedAvatar}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-status-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" className={amberButton} disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {busy ? 'Sending…' : 'Request claim'}
        </button>
        <button
          type="button"
          className={ghostButton}
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-fg-faint">
        Claims are approved by a moderator — never automatic.
      </p>
    </form>
  )
}

function AvatarSeedChoice({
  providerAvatarUrl,
  seedAvatar,
  onChange,
}: {
  providerAvatarUrl: string
  seedAvatar: boolean
  onChange: (seed: boolean) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium tracking-wide text-fg-faint uppercase">
        Starting avatar
      </legend>
      <div role="radiogroup" className="flex gap-2">
        <SeedOption
          selected={!seedAvatar}
          onSelect={() => onChange(false)}
          label="Medallion"
          preview={
            <span className="block h-9 w-9">
              <Medallion name="?" />
            </span>
          }
        />
        <SeedOption
          selected={seedAvatar}
          onSelect={() => onChange(true)}
          label="This picture"
          preview={
            <img
              src={providerAvatarUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
          }
        />
      </div>
      <p className="mt-1.5 text-xs text-fg-faint">
        Your Discord picture is only used if you pick it here.
      </p>
    </fieldset>
  )
}

function SeedOption({
  selected,
  onSelect,
  label,
  preview,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  preview: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        'flex flex-1 items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left transition-colors duration-200 ' +
        (selected
          ? 'border-transparent bg-[var(--pill-active)] text-fg'
          : 'border-hairline-soft text-fg-muted hover:text-fg')
      }
    >
      <span className="shrink-0">{preview}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function OwnerControls({
  busy,
  error,
  onRelease,
}: {
  busy: boolean
  error: string | null
  onRelease: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        <BadgeCheck size={16} className="shrink-0 text-fg-muted" aria-hidden />
        This is your page
      </p>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-fg-muted">Release this claim?</span>
          <button
            type="button"
            className="text-sm font-semibold text-status-danger hover:brightness-110 disabled:opacity-50"
            disabled={busy}
            onClick={onRelease}
          >
            {busy ? 'Releasing…' : 'Release'}
          </button>
          <button
            type="button"
            className="text-sm text-fg-muted hover:text-fg disabled:opacity-50"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-sm text-fg-muted underline decoration-hairline underline-offset-2 hover:text-fg"
          onClick={() => setConfirming(true)}
        >
          Release claim
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
}
