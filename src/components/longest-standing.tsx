import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { VehicleIcon } from '#/components/vehicle-icon'
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
            className="relative overflow-hidden border-b border-hairline-soft transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <NationFlag slug={r.nationSlug} variant="wash-row" />
            <div className="relative z-[1] grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-5">
              {r.vehicleImage ? (
                <VehicleIcon
                  src={r.vehicleImage}
                  className="vehicle-icon-row hidden sm:block"
                />
              ) : (
                <span className="hidden w-0 sm:block" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="font-semibold text-fg">
                  <NationFlag slug={r.nationSlug} className="mr-1" />
                  <VehicleLink
                    mode={mode}
                    slug={r.vehicleSlug}
                    name={r.vehicleName}
                    tags={r}
                  />
                </span>
                <span className="mt-0.5 block text-sm text-fg">
                  <Link
                    to="/player/$slug"
                    params={{ slug: r.playerSlug }}
                    className="font-semibold no-underline hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  <span className="text-fg-muted"> holds it</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[1.0625rem] leading-tight font-bold tabular-nums text-fg">
                  {r.kills}
                </span>
                <span className="text-[0.6875rem] font-medium tracking-[0.08em] uppercase text-fg-faint">
                  kills
                </span>
              </span>
              <span className="min-w-[6.5rem] text-right">
                <span className="block text-2xl leading-none font-bold tracking-[-0.03em] tabular-nums text-fg">
                  {r.verifiedAt
                    ? daysSince(r.verifiedAt).toLocaleString('en-US')
                    : '—'}
                </span>
                <span className="text-[0.6875rem] font-medium tracking-[0.08em] uppercase text-fg-faint">
                  days untouched
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
