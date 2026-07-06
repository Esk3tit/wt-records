import { Link } from '@tanstack/react-router'
import { VehicleLink } from '#/components/vehicle-link'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface ContestedTitleRow extends VehicleTagFlags {
  vehicleSlug: string
  vehicleName: string
  nationName: string
  contests: number
  kills: number
  playerSlug: string
  displayName: string
}

export function ContestedTitles({
  mode,
  rows,
}: {
  mode: string
  rows: ContestedTitleRow[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="glass-mid overflow-hidden">
      <ol>
        {rows.map((r) => (
          <li
            key={r.vehicleSlug}
            className="flex items-center justify-between gap-6 border-b border-hairline-soft px-5 py-4 transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <span className="min-w-0">
              <span className="font-semibold text-fg">
                <VehicleLink
                  mode={mode}
                  slug={r.vehicleSlug}
                  name={r.vehicleName}
                  tags={r}
                />
              </span>
              <span className="mt-0.5 block text-xs font-medium text-fg-muted">
                {r.nationName} · {r.kills} kills ·{' '}
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
                {r.contests}
              </span>
              <span className="text-[0.6875rem] font-medium tracking-[0.08em] whitespace-nowrap uppercase text-fg-faint">
                records set
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
