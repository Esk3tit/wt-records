import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <section className="flex justify-center pt-[10vh] pb-16 sm:pt-[14vh]">
      <title>Page not found — WT Records</title>
      <div className="glass-mid w-full max-w-[30rem] px-6 py-10 text-center sm:px-10">
        <p className="text-[0.6875rem] font-semibold tracking-[0.24em] text-fg-muted uppercase">
          Not in the registry
        </p>
        <p
          aria-hidden="true"
          className="mt-4 text-[clamp(3.5rem,10vw,4.5rem)] leading-none font-bold tracking-[-0.01em]"
        >
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Nothing is hangared here.
        </h1>
        <p className="mx-auto mt-2 max-w-[24rem] text-[0.9375rem] text-fg-muted">
          No page answers this address — the link may be mistyped, or what it
          pointed at may have moved on.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/search" className="glass-pill no-underline">
            Search the registry
          </Link>
          <Link to="/" className="glass-pill no-underline">
            Back to the records
          </Link>
        </div>
      </div>
    </section>
  )
}
