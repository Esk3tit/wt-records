import { RecordCard } from '#/components/record-card'
import { isHeld } from '#/components/catalog-ledger'
import type { RecordCardRow } from '#/components/record-card'

/** Below this the ledger is short enough to read whole, so three cards would
    restate it rather than summarise it. */
export const SPOTLIGHT_MIN_ROWS = 10

/** The Spotlight is absent on the unfiltered view — the Mode landing already
    shows the Mode's best — and absent whenever it would not be summarising. */
export function spotlightVisible({
  activeFilters,
  total,
  rows,
}: {
  activeFilters: number
  total: number
  rows: RecordCardRow[]
}): boolean {
  return (
    activeFilters > 0 &&
    total >= SPOTLIGHT_MIN_ROWS &&
    rows.filter(isHeld).length >= 3
  )
}

/* The best feats inside the active filter set, in the record wall's own cards.
   No acquisition tint here: among three ranked cards a lone gilded pane reads
   as a medal rather than as premium. */
export function Spotlight({
  mode,
  rows,
}: {
  mode: string
  rows: RecordCardRow[]
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
      {/* A rail below sm: three stacked cards would push the ledger off a
          phone entirely, and the ledger is what the page is for. */}
      <ul className="-mx-1 mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {rows.map((row) => (
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
