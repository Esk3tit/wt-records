import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { COUNTRIES } from '#/lib/countries'
import { errorMessage } from '#/lib/errors'
import { setMyCountry } from '#/claims/api'

// A select takes no pseudo-element, so its 44px has to be real height. Capped
// in width: left alone it sizes to "South Georgia & South Sandwich Islands".
const selectClass =
  'min-h-11 w-full max-w-xs rounded-[10px] border border-hairline bg-transparent px-2 py-1 text-sm text-fg transition-colors duration-200 hover:border-[var(--hairline-hover)]'

const saveButton =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-hairline-soft px-3 py-1.5 text-sm font-semibold text-fg-muted transition-colors duration-200 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50'

/* The owner's Country picker, shown only on their own Player page. Unlimited
   and self-serve with no cooldown — correct here precisely because the country
   is stated rather than shadowed, so a mistake costs one action to fix.

   Saved on an explicit press, never on change. A closed native <select> fires
   `change` per type-ahead keystroke, so "Japan" passes through Jamaica; any
   autosave has to race that, and the debounce that seems to fix it still
   writes Jamaica for anyone who pauses mid-word. One press is one write: the
   keystrokes stay local, only one request is ever in flight, and there is no
   ordering left for a slow response to lose. The select itself is never
   disabled — disabling a focused control blurs it out from under the owner —
   so only the button goes quiet while the write is going. */
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
  const stored = countryCode ?? ''
  const [choice, setChoice] = useState(stored)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const handBackFocus = useRef(false)

  // After the render that disables the button, so the field is focusable and
  // the button is not; guarded by the ref rather than by deps.
  useEffect(() => {
    if (!handBackFocus.current) return
    handBackFocus.current = false
    selectRef.current?.focus()
  })

  const save = async () => {
    // Captured before the write, not after: the reload re-renders the parent
    // with the new value, which can disable this button — and by then it is no
    // longer the active element to recognise.
    const pressedWhileFocused = document.activeElement === buttonRef.current
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await setMyCountry({ data: { playerId, countryCode: choice || null } })
    } catch (e) {
      // The choice stays in the field: it is an unsaved edit, and snapping it
      // back would make the owner find their country again to retry.
      setError(errorMessage(e))
      setBusy(false)
      return
    }
    // The write committed: reload so the flag renders beside the name.
    await router.invalidate().catch(() => undefined)
    // A saved press leaves nothing to save, so this button disables itself —
    // and a disabled control cannot hold focus. Hand it back to the field
    // instead of dropping the keyboard to the top of the document.
    handBackFocus.current = pressedWhileFocused
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
          ref={selectRef}
          id={fieldId}
          aria-describedby={ruleId}
          className={selectClass}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value)
            setSaved(false)
            setError(null)
          }}
        >
          {/* Pinned first and always offered, so clearing is one action. */}
          <option value="">Not set</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          ref={buttonRef}
          type="button"
          className={saveButton}
          disabled={busy || choice === stored}
          onClick={() => void save()}
        >
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Save
        </button>
        <span
          role="status"
          aria-live="polite"
          className="text-sm text-fg-faint"
        >
          {saved ? 'Saved' : ''}
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
