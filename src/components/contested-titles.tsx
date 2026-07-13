import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { VehicleIcon } from '#/components/vehicle-icon'
import { VehicleLink } from '#/components/vehicle-link'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface ContestedTitleRow extends VehicleTagFlags {
  vehicleSlug: string
  vehicleName: string
  nationName: string
  nationSlug: string
  vehicleImage: string | null
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
            className="relative overflow-hidden border-b border-hairline-soft transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <NationFlag slug={r.nationSlug} variant="wash-row" />
            <div className="relative z-[1] flex items-center justify-between gap-6 px-5 py-4">
              <span className="min-w-0">
                <span className="font-semibold text-fg">
                  <VehicleIcon src={r.vehicleImage} className="mr-1" />
                  <VehicleLink
                    mode={mode}
                    slug={r.vehicleSlug}
                    name={r.vehicleName}
                    tags={r}
                  />
                </span>
                <span className="mt-0.5 block text-xs font-medium text-fg-muted">
                  <NationFlag slug={r.nationSlug} className="mr-0.5" />
                  {r.nationName} · {r.kills} kills ·{' '}
                  <Link
                    to="/player/$slug"
                    params={{ slug: r.playerSlug }}
                    className="font-semibold text-fg no-underline hover:underline"
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
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
