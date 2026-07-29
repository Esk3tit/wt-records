import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <section className="flex justify-center pt-[10vh] pb-16 sm:pt-[14vh]">
      <title>Something went wrong — WT Records</title>
      <div className="glass-mid w-full max-w-[30rem] px-6 py-10 text-center sm:px-10">
        <p className="text-[0.6875rem] font-semibold tracking-[0.24em] text-fg-muted uppercase">
          Registry fault
        </p>
        <h1 className="mt-4 text-2xl font-semibold">
          The registry failed to answer.
        </h1>
        <p className="mx-auto mt-2 max-w-[24rem] text-[0.9375rem] text-fg-muted">
          A fault on our side stopped this page from loading — the records
          themselves are untouched. Try again in a moment.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-4 overflow-x-auto rounded-[10px] border border-hairline bg-[var(--pill-track)] p-3 text-left text-xs text-fg-muted">
            {error.message}
          </pre>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
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
        </div>
      </div>
    </section>
  )
}
