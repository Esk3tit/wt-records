import { RecordCard } from '#/components/record-card'
import type { RecordCardRow } from '#/components/record-card'

/** How many feats the strip shows. */
export const SPOTLIGHT_SHOWS = 3

/** Held titles needed before three of them read as a selection. The query
    fetches exactly this many, so the count is held titles, not rows. */
export const SPOTLIGHT_MIN_HELD = 8

/** Absent on the unfiltered view — the Mode landing already shows the Mode's
    best — and absent whenever the strip would not be summarising. */
export function spotlightVisible({
  activeFilters,
  candidates,
}: {
  activeFilters: number
  candidates: RecordCardRow[]
}): boolean {
  return activeFilters > 0 && candidates.length >= SPOTLIGHT_MIN_HELD
}

/* The best feats inside the active filter set, in the record wall's own cards.
   No acquisition tint here: among three ranked cards a lone gilded pane reads
   as a medal rather than as premium. */
export function Spotlight({
  mode,
  candidates,
}: {
  mode: string
  candidates: RecordCardRow[]
}) {
  return (
    <section aria-labelledby="spotlight-heading" className="mt-5">
      <div className="flex items-center gap-3">
        <h2
          id="spotlight-heading"
          className="text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase"
        >
          Spotlight
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-linear-to-r from-[var(--hairline)] to-transparent"
        />
        <span className="text-[0.6875rem] font-medium text-fg-faint">
          best of these filters
        </span>
      </div>
      {/* A rail below sm: three stacked cards would push the ledger, which is
          what the page is for, off a phone entirely. */}
      <ul className="-mx-1 mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {candidates.slice(0, SPOTLIGHT_SHOWS).map((row) => (
          <li
            key={row.vehicleSlug}
            className="w-[14.5rem] shrink-0 snap-start sm:w-auto"
          >
            <RecordCard row={row} mode={mode} />
          </li>
        ))}
      </ul>
    </section>
  )
}
