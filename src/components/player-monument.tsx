import { Link } from '@tanstack/react-router'
import { CountUp } from '#/components/count-up'
import { formatMonthYear, heldDays } from '#/lib/dates'
import type { LongestHeldTitle } from '#/components/profile-enrichment'

/* A monument cannot say "under a day", so the shortest real reign is its 1.
   Only a player who never held a title has spent no days at the top. */
function daysAtTheTop(longestHeld: LongestHeldTitle | null): number {
  if (!longestHeld) return 0
  return Math.max(1, heldDays(longestHeld.heldSeconds))
}

/* The profile's monument. Days rather than titles held: almost every player
   holds one to three, and a monumental 1 is ceremony without substance. */
export function PlayerMonument({
  titlesHeld,
  longestHeld,
}: {
  titlesHeld: number
  longestHeld: LongestHeldTitle | null
}) {
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

  return (
    <div className="flex flex-col md:items-end md:text-right">
      <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
        {undated ? 'Titles held' : 'Days at the top'}
      </p>
      <p className="text-[clamp(3.25rem,8vw,5rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
        {/* The figure apart from its unit, so a spec can read what the
            count-up arrives at rather than the whole line. */}
        <span data-monument-figure="">
          <CountUp value={figure} />
        </span>
        <span className="ml-2 stat-unit text-[0.9375rem]">{unit}</span>
      </p>
      {/* Suppressed where the count above already is the titles held. */}
      {!undated && (
        <p className="mt-2 text-[1.0625rem] font-semibold">
          {titlesHeld === 0
            ? 'No titles standing'
            : `${titlesHeld} ${titlesHeld === 1 ? 'title' : 'titles'} held now`}
        </p>
      )}
      {longestHeld && (
        <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
          <Link
            to="/$mode/vehicle/$slug"
            params={{ mode: longestHeld.mode, slug: longestHeld.vehicleSlug }}
            className="font-medium text-fg decoration-hairline underline-offset-2 hover:decoration-current"
          >
            {longestHeld.vehicleName}
          </Link>
          {` · ${longestHeld.mode.toUpperCase()}`}
          {/* A closed window is history: say so, or an ex-holder reads as current. */}
          {longestHeld.lostAt != null &&
            ` · ended ${formatMonthYear(longestHeld.lostAt)}`}
        </p>
      )}
    </div>
  )
}
