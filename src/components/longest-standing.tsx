import { Link } from '@tanstack/react-router'
import { VehicleLink } from '#/components/vehicle-link'
import { daysSince } from '#/lib/dates'
import type { PodiumRecord } from '#/components/podium'

export function LongestStanding({
  mode,
  rows,
}: {
  mode: string
  rows: PodiumRecord[]
}) {
  return (
    <div className="glass-mid overflow-hidden">
      <ol>
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-6 border-b border-hairline-soft px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <span className="min-w-0">
              <span className="font-semibold text-fg">
                <VehicleLink
                  mode={mode}
                  slug={r.vehicleSlug}
                  name={r.vehicleName}
                  isRemoved={r.isRemoved}
                />
              </span>
              <span className="mt-0.5 block text-xs font-medium text-fg-muted">
                {r.kills} kills ·{' '}
                <Link
                  to="/player/$slug"
                  params={{ slug: r.playerSlug }}
                  className="text-fg-muted no-underline hover:underline"
                >
                  {r.displayName}
                </Link>
              </span>
            </span>
            <span className="text-right">
              <span className="block text-2xl leading-none font-bold tracking-[-0.03em] tabular-nums text-fg">
                {r.verifiedAt
                  ? daysSince(r.verifiedAt).toLocaleString('en-US')
                  : '—'}
              </span>
              <span className="text-[0.6875rem] font-medium tracking-[0.08em] uppercase text-fg-faint">
                days untouched
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
