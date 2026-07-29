import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { FaultPane } from '#/components/fault-pane'

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <FaultPane
      docTitle="Something went wrong — WT Records"
      eyebrow="Registry fault"
      heading="The registry failed to answer."
      body="A fault on our side stopped this page from loading — the records themselves are untouched. Try again in a moment."
      detail={
        import.meta.env.DEV && (
          <pre className="mt-4 overflow-x-auto rounded-[10px] border border-hairline bg-[var(--pill-track)] p-3 text-left text-xs text-fg-muted">
            {error.message}
          </pre>
        )
      }
      actions={
        <>
          <button
            type="button"
            className="glass-pill cursor-pointer"
            onClick={() => {
              reset()
              router.invalidate()
            }}
          >
            Try again
          </button>
          <Link to="/" className="glass-pill no-underline">
            Back to the records
          </Link>
        </>
      }
    />
  )
}
