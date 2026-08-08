import { Link } from '@tanstack/react-router'
import { CountUp } from '#/components/count-up'
import { formatMonthYear } from '#/lib/dates'
import type { LongestHeldTitle } from '#/components/profile-enrichment'

const DAY_SECONDS = 86_400

/* A reign that exists is never zero days, the same ground formatHeldDays says
   "under a day" on. Only a player who never held a title has spent none. */
function daysAtTheTop(longestHeld: LongestHeldTitle | null): number {
  if (!longestHeld) return 0
  return Math.max(1, Math.round(longestHeld.heldSeconds / DAY_SECONDS))
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
  const days = daysAtTheTop(longestHeld)

  return (
    <div className="flex flex-col md:items-end md:text-right">
      <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
        Days at the top
      </p>
      <p className="text-[clamp(3.25rem,8vw,5rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
        {/* The figure apart from its unit, so a spec can read what the
            count-up arrives at rather than the whole line. */}
        <span data-monument-days="">
          <CountUp value={days} />
        </span>
        <span className="ml-2 stat-unit text-[0.9375rem]">
          {days === 1 ? 'day' : 'days'}
        </span>
      </p>
      <p className="mt-2 text-[1.0625rem] font-semibold">
        {titlesHeld === 0
          ? 'No titles standing'
          : `${titlesHeld} ${titlesHeld === 1 ? 'title' : 'titles'} held now`}
      </p>
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
