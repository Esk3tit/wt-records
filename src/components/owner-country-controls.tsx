import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { COUNTRIES } from '#/lib/countries'
import { errorMessage } from '#/lib/errors'
import { setMyCountry } from '#/claims/api'

// A select takes no pseudo-element, so its 44px has to be real height. Capped
// in width: left alone it sizes to "South Georgia & South Sandwich Islands".
const selectClass =
  'min-h-11 w-full max-w-xs rounded-[10px] border border-hairline bg-transparent px-2 py-1 text-sm text-fg transition-colors duration-200 hover:border-[var(--hairline-hover)]'

// A closed native select fires `change` on every type-ahead keystroke, so
// "Japan" walks through Jamaica — let the typing settle before writing.
const SETTLE_MS = 600

/* The owner's Country picker, shown only on their own Player page. Unlimited
   and self-serve with no cooldown — the country is stated, not verified, so a
   mistake costs one action to fix. */
export function OwnerCountryControls({
  playerId,
  countryCode,
}: {
  playerId: number
  countryCode: string | null
}) {
  const router = useRouter()
  const fieldId = useId()
  const ruleId = useId()
  // Null follows the server; a string is the owner's pick, still settling.
  const [draft, setDraft] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => clearTimeout(pending.current ?? undefined), [])

  const commit = async (next: string) => {
    setError(null)
    // Only release the draft if it's still this pick — a later one is already
    // settling, and snapping back to the prop would flicker the stale country.
    const release = () => setDraft((held) => (held === next ? null : held))
    try {
      await setMyCountry({ data: { playerId, countryCode: next || null } })
    } catch (e) {
      setError(errorMessage(e))
      release()
      return
    }
    // The write committed: reload so the flag (or nothing) renders by the name.
    await router.invalidate().catch(() => undefined)
    release()
    setSaved(true)
  }

  const pick = (next: string) => {
    setDraft(next)
    setSaved(false)
    clearTimeout(pending.current ?? undefined)
    pending.current = setTimeout(() => {
      pending.current = null
      void commit(next)
    }, SETTLE_MS)
  }

  // Leaving the field is a decision — don't make them wait out the settle.
  const flush = () => {
    if (!pending.current) return
    clearTimeout(pending.current)
    pending.current = null
    if (draft != null) void commit(draft)
  }

  return (
    <div className="mt-4">
      <label
        htmlFor={fieldId}
        className="block text-xs font-semibold tracking-wide text-fg-muted uppercase"
      >
        Country
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Never disabled while saving: disabling a focused control drops focus
            to the body, stranding whoever is operating it from the keyboard. */}
        <select
          id={fieldId}
          aria-describedby={ruleId}
          className={selectClass}
          value={draft ?? countryCode ?? ''}
          onChange={(e) => pick(e.target.value)}
          onBlur={flush}
        >
          {/* Pinned first and always offered, so clearing is one action. */}
          <option value="">Not set</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <span
          role="status"
          aria-live="polite"
          className="text-sm text-fg-faint"
        >
          {saved ? 'Saved' : ''}
        </span>
      </div>
      {/* The rule sits under the field, not in the label: the site states it and
          does not verify it, so a dispute has something to be judged against. */}
      <p id={ruleId} className="mt-1.5 max-w-prose text-xs text-fg-faint">
        Your country is a citizenship you hold. Not where you live, not where
        your family is from, not where you play. If you hold more than one, pick
        the one you want shown.
      </p>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
}
