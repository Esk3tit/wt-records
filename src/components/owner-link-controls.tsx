import { useId, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { MAX_NAMED_LINKS, PLATFORMS, WEBSITE_PLATFORM } from '#/links/platforms'
import { fieldPrefix, platformName, previewLinkUrl } from '#/links/parse'
import { MAX_LINK_INPUT } from '#/claims/limits'
import { errorMessage } from '#/lib/errors'
import { removeMyLink, setMyLink } from '#/claims/api'

/* The owner's Profile links, shown only on their own Player page. They publish
   the moment they are saved — nothing waits on anybody — so what this screen
   owes its owner is not a status but certainty: the constructed prefix is
   welded to the field as static text, and the full URL is shown beneath it as
   it is typed. A pasted URL then looks wrong on screen before it is ever
   submitted, and what was stored is echoed back afterwards.

   Saved on an explicit press, never on change, for the reason the Country
   picker records: one press is one write, so there is no ordering left for a
   slow response to lose. */

const inputClass =
  'min-h-11 w-full rounded-r-[10px] border border-l-0 border-hairline bg-transparent px-2 py-1 text-sm text-fg transition-colors duration-200 hover:border-[var(--hairline-hover)]'

const prefixClass =
  'inline-flex min-h-11 shrink-0 items-center rounded-l-[10px] border border-hairline bg-[var(--row-hover)] px-2 text-sm text-fg-faint select-none'

const actionButton =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-hairline-soft px-3 py-1.5 text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50'

export function OwnerLinkControls({
  playerId,
  links,
}: {
  playerId: number
  links: ReadonlyArray<{ platform: string; handle: string }>
}) {
  const held = new Set(links.map((link) => link.platform))
  const namedHeld = links.filter(
    (link) => link.platform !== WEBSITE_PLATFORM,
  ).length
  // The personal site never counts against the cap: it is what lets the named
  // list refuse the fragmented tail without those creators losing anything.
  const addable = [
    ...(namedHeld < MAX_NAMED_LINKS
      ? PLATFORMS.filter((p) => !held.has(p.id)).map((p) => p.id)
      : []),
    ...(held.has(WEBSITE_PLATFORM) ? [] : [WEBSITE_PLATFORM]),
  ]

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
        Links
      </p>
      <p className="mt-1 text-xs text-fg-faint">
        {MAX_NAMED_LINKS} platforms plus your own site. They go live as soon as
        you save them.
      </p>
      <div className="mt-2 space-y-3">
        {links.map((link) => (
          <LinkField
            key={link.platform}
            playerId={playerId}
            platform={link.platform}
            stored={link.handle}
          />
        ))}
        {addable.length > 0 && (
          // Keyed on what is held, so the add row resets to an empty field once
          // the link it just wrote arrives back as a row of its own.
          <AddLink
            key={[...held].sort().join()}
            playerId={playerId}
            addable={addable}
          />
        )}
      </div>
    </div>
  )
}

function AddLink({
  playerId,
  addable,
}: {
  playerId: number
  addable: string[]
}) {
  const fieldId = useId()
  const [choice, setChoice] = useState(addable[0])
  return (
    <div className="border-t border-hairline-soft pt-3">
      <label
        htmlFor={fieldId}
        className="block text-xs font-semibold tracking-wide text-fg-muted uppercase"
      >
        Add a link
      </label>
      <select
        id={fieldId}
        className="mt-1.5 min-h-11 w-full max-w-xs rounded-[10px] border border-hairline bg-transparent px-2 py-1 text-sm text-fg transition-colors duration-200 hover:border-[var(--hairline-hover)]"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        {addable.map((id) => (
          <option key={id} value={id}>
            {platformName(id)}
          </option>
        ))}
      </select>
      <LinkField key={choice} playerId={playerId} platform={choice} stored="" />
    </div>
  )
}

function LinkField({
  playerId,
  platform,
  stored,
}: {
  playerId: number
  platform: string
  stored: string
}) {
  const router = useRouter()
  const fieldId = useId()
  const [draft, setDraft] = useState(stored)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The whole point of welding the prefix: the owner reads what a visitor will
  // get, character by character, rather than trusting that we agree.
  const preview = previewLinkUrl(platform, draft)
  const prefix = fieldPrefix(platform)

  const call = async (
    which: 'save' | 'remove',
    write: () => Promise<unknown>,
  ) => {
    setBusy(which)
    setError(null)
    setSaved(false)
    try {
      await write()
    } catch (e) {
      // The draft stays in the field: it is an unsaved edit, and snapping it
      // back would make the owner type their handle again to retry.
      setError(errorMessage(e))
      setBusy(null)
      return
    }
    await router.invalidate().catch(() => undefined)
    setBusy(null)
    setSaved(which === 'save')
  }

  return (
    <div>
      <label htmlFor={fieldId} className="block text-xs text-fg-faint">
        {platformName(platform)}
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 items-stretch">
          <span className={prefixClass} aria-hidden="true">
            {prefix}
          </span>
          <input
            id={fieldId}
            type="text"
            className={inputClass}
            // Named so the field says what it wants without the prefix having
            // to be read out as part of the value.
            aria-label={`${platformName(platform)} — ${prefix}`}
            maxLength={MAX_LINK_INPUT}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setSaved(false)
              setError(null)
            }}
          />
        </div>
        <button
          type="button"
          className={actionButton}
          // Named for its own field: the page carries a Save per link and one
          // for the Country, and "Save" alone names none of them.
          aria-label={`Save ${platformName(platform)} link`}
          disabled={busy != null || draft.trim() === '' || draft === stored}
          onClick={() =>
            void call('save', () =>
              setMyLink({ data: { playerId, platform, value: draft } }),
            )
          }
        >
          {busy === 'save' && (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          )}
          Save
        </button>
        {stored !== '' && (
          <button
            type="button"
            className={actionButton}
            aria-label={`Remove ${platformName(platform)} link`}
            disabled={busy != null}
            onClick={() =>
              void call('remove', () =>
                removeMyLink({ data: { playerId, platform } }),
              )
            }
          >
            {busy === 'remove' && (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            )}
            Remove
          </button>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-1 text-xs break-all text-fg-faint"
      >
        {saved ? `Saved — ${previewLinkUrl(platform, stored) ?? ''}` : preview}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
}
