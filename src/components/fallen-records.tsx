import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { VehicleIcon } from '#/components/vehicle-icon'
import { VehicleLink } from '#/components/vehicle-link'
import { formatDaysAgo } from '#/lib/dates'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface FallenRow extends VehicleTagFlags {
  vehicleSlug: string
  vehicleName: string
  nationSlug: string
  vehicleImage: string | null
  oldKills: number
  oldHolder: string
  oldHolderSlug: string
  newKills: number
  newHolder: string
  newHolderSlug: string
  verifiedAt: Date | null
}

export function FallenRecords({
  mode,
  rows,
}: {
  mode: string
  rows: FallenRow[]
}) {
  return (
    <div className="glass-mid @container overflow-hidden">
      <ol>
        {rows.map((f) => (
          <li
            key={f.vehicleSlug}
            className="relative overflow-hidden border-b border-hairline-soft transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <NationFlag slug={f.nationSlug} variant="wash-row" />
            <div className="relative z-[1] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 px-5 py-4 @[30rem]:grid-cols-[auto_minmax(0,1fr)_auto] @[30rem]:gap-x-5">
              <VehicleIcon src={f.vehicleImage} variant="row" />
              <span className="min-w-0">
                <span className="font-semibold text-fg">
                  <NationFlag slug={f.nationSlug} className="mr-1" />
                  <VehicleLink
                    mode={mode}
                    slug={f.vehicleSlug}
                    name={f.vehicleName}
                    tags={f}
                  />
                </span>
                <span className="mt-0.5 block text-sm text-fg">
                  <Link
                    to="/player/$slug"
                    params={{ slug: f.newHolderSlug }}
                    className="font-semibold no-underline hover:underline"
                  >
                    {f.newHolder}
                  </Link>
                  <span className="text-fg-muted">
                    {' '}
                    dethroned {f.oldHolder}
                    {f.verifiedAt && ` · ${formatDaysAgo(f.verifiedAt)}`}
                  </span>
                </span>
              </span>
              <span className="text-right">
                <span className="block leading-tight tabular-nums">
                  <span className="text-sm text-fg-faint line-through">
                    {f.oldKills}
                  </span>
                  <span className="mx-1.5 text-sm text-fg-faint">→</span>
                  <span className="text-[1.0625rem] font-bold text-fg">
                    {f.newKills}
                  </span>
                </span>
                <span className="text-[0.6875rem] font-medium tracking-[0.08em] uppercase text-fg-faint">
                  kills
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
