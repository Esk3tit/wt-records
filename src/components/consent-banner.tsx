import { useEffect, useState } from 'react'
import { readConsent, writeConsent } from '#/lib/consent'
import { grantConsent, revokeConsent } from '#/lib/observability'

// Renders nothing on the server and until mounted, so there's no hydration
// mismatch and no flash before we know the stored consent decision.
export function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(readConsent() === 'unknown')
  }, [])

  if (!visible) return null

  function accept() {
    writeConsent('granted')
    grantConsent()
    setVisible(false)
  }

  function decline() {
    writeConsent('denied')
    revokeConsent()
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Privacy consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-base/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-4 text-sm text-fg-muted sm:flex-row sm:items-center">
        <p className="flex-1">
          We use cookies to understand how WT Records gets used so we can keep
          making it better. To respect your privacy — and the rules — we ask
          before setting them. Accepting helps us improve the site for everyone.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded border border-white/15 px-3 py-1.5 text-fg-muted hover:text-fg"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded bg-accent px-3 py-1.5 font-medium text-black hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
