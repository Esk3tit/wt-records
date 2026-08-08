import { useId, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { COUNTRIES } from '#/lib/countries'
import { errorMessage } from '#/lib/errors'
import { setMyCountry } from '#/claims/api'

// A select takes no pseudo-element, so its 44px has to be real height. Capped
// in width: left alone it sizes to "South Georgia & South Sandwich Islands".
const selectClass =
  'min-h-11 w-full max-w-xs rounded-[10px] border border-hairline bg-transparent px-2 py-1 text-sm text-fg transition-colors duration-200 hover:border-[var(--hairline-hover)] disabled:cursor-not-allowed disabled:opacity-50'

/* The owner's Country picker, shown only on their own Player page. Unlimited
   and self-serve with no cooldown — correct here precisely because the country
   is stated rather than shadowed, so a mistake costs one action to fix. */
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
  const [code, setCode] = useState(countryCode ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (next: string) => {
    const previous = code
    setCode(next)
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await setMyCountry({ data: { playerId, countryCode: next || null } })
    } catch (e) {
      setCode(previous)
      setError(errorMessage(e))
      setBusy(false)
      return
    }
    // The write committed: reload so the flag (or nothing) renders beside the name.
    await router.invalidate().catch(() => undefined)
    setBusy(false)
    setSaved(true)
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
        <select
          id={fieldId}
          aria-describedby={ruleId}
          className={selectClass}
          disabled={busy}
          value={code}
          onChange={(e) => void save(e.target.value)}
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
          {saved && !busy ? 'Saved' : ''}
        </span>
      </div>
      {/* The rule belongs under the field, not in the label: the site states it
          and does not verify it, so a dispute has something to be judged
          against. */}
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
