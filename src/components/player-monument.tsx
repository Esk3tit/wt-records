import { Link } from '@tanstack/react-router'
import { CountUp } from '#/components/count-up'
import { formatMonthYear, heldDays } from '#/lib/dates'
import type { LongestHeldTitle } from '#/components/profile-enrichment'

export interface Standing {
  titlesHeld: number
  longestHeld: LongestHeldTitle | null
}

/* No tenure and nothing standing is no subject, and a monument to nothing spends
   the page's one amber on the absence of a feat. The glow answers to this too. */
export function hasMonument({ titlesHeld, longestHeld }: Standing): boolean {
  return longestHeld != null || titlesHeld > 0
}

/* A monument cannot say "under a day", so the shortest real reign is its 1. */
function daysAtTheTop(longestHeld: LongestHeldTitle | null): number {
  if (!longestHeld) return 0
  return Math.max(1, heldDays(longestHeld.heldSeconds))
}

/** How far the monument's light pools, 0–1. Logarithmic, because tenure is: a
    two-month reign and a two-year one have to differ visibly while a decade
    still has somewhere to go. Two years is the far end. */
export function monumentReach(standing: Standing): number {
  if (!hasMonument(standing)) return 0
  const undated = standing.longestHeld == null
  const figure = undated ? standing.titlesHeld : daysAtTheTop(standing.longestHeld)
  const far = undated ? 12 : 730
  return Math.min(1, Math.log1p(figure) / Math.log1p(far))
}

/** Whether the reign the numeral counts is still running. The registry's own
    liveness, in the one place on this page it has been earned. */
export function monumentStanding({ longestHeld }: Standing): boolean {
  return longestHeld != null && longestHeld.lostAt == null
}

/* The profile's monument. Days rather than titles held: almost every player
   holds one to three, and a monumental 1 is ceremony without substance. */
export function PlayerMonument({ titlesHeld, longestHeld }: Standing) {
  if (!hasMonument({ titlesHeld, longestHeld })) return null

  /* Titles can stand with nothing to date them — a migrated record often has
     no date — and "0 days" over "3 titles held now" is a lie, not a feat. */
  const undated = longestHeld == null && titlesHeld > 0
  const days = daysAtTheTop(longestHeld)
  const figure = undated ? titlesHeld : days
  const unit = undated
    ? titlesHeld === 1
      ? 'record'
      : 'records'
    : days === 1
      ? 'day'
      : 'days'

  /* The plinth is the header's own rule, not a second one drawn beside it: the
     figure takes the hero row and the plaque takes the row under it, so the
     line the stats strip already hangs from is the line the figure stands on.
     Two rules six pixels apart in adjacent columns read as one, broken. Hence
     `md:contents` — this composes into the header's grid rather than nesting
     inside one cell of it. */
  return (
    <div className="flex flex-col md:contents">
      <div className="flex flex-col md:col-start-2 md:row-start-1 md:items-end md:text-right">
        <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
          {undated ? 'Titles held' : 'Days at the top'}
        </p>
        {/* Up to the band's own ceiling on a desktop, where this card is the
            page's hero and had been standing a step below the one on the mode
            landing. The phone floor does not move — 3.25rem is what fits. */}
        <p className="text-[clamp(3.25rem,9vw,6rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
          {/* The figure apart from its unit, so a spec can read what the
              count-up arrives at rather than the whole line. */}
          <span data-monument-figure="">
            <CountUp value={figure} />
          </span>
          <span className="ml-2 stat-unit text-[0.9375rem]">{unit}</span>
        </p>
      </div>

      {/* Suppressed where the count above already is the titles held — and with
          it the plinth, which would then rule off nothing. */}
      {!undated && (
        <div className="mt-6 flex flex-col border-t border-hairline-soft pt-5 md:col-start-2 md:row-start-2 md:mt-0 md:items-end md:text-right">
          <p className="text-[1.0625rem] font-semibold">
            {titlesHeld === 0
              ? 'No titles standing'
              : `${titlesHeld} ${titlesHeld === 1 ? 'title' : 'titles'} held now`}
          </p>
          {longestHeld && (
            <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
              <Link
                to="/$mode/vehicle/$slug"
                params={{
                  mode: longestHeld.mode,
                  slug: longestHeld.vehicleSlug,
                }}
                className="font-medium text-fg decoration-hairline underline-offset-2 hover:decoration-current"
              >
                {longestHeld.vehicleName}
              </Link>
              {` · ${longestHeld.mode.toUpperCase()}`}
              {/* A closed window is history: say so, or an ex-holder reads as
                  current. */}
              {longestHeld.lostAt != null &&
                ` · ended ${formatMonthYear(longestHeld.lostAt)}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
