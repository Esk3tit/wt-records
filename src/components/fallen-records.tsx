import { Link } from '@tanstack/react-router'
import { VehicleLink } from '#/components/vehicle-link'
import { formatDaysAgo } from '#/lib/dates'

export interface FallenRow {
  vehicleSlug: string
  vehicleName: string
  isRemoved: boolean
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
    <div className="glass-mid overflow-hidden">
      <ol>
        {rows.map((f) => (
          <li
            key={f.vehicleSlug}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-hairline-soft px-5 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <span className="min-w-0">
              <span className="font-semibold text-fg">
                <VehicleLink
                  mode={mode}
                  slug={f.vehicleSlug}
                  name={f.vehicleName}
                  isRemoved={f.isRemoved}
                />
              </span>
              <span className="mt-0.5 block text-[0.6875rem] font-medium text-fg-muted">
                <Link
                  to="/player/$slug"
                  params={{ slug: f.newHolderSlug }}
                  className="text-fg no-underline hover:underline"
                >
                  {f.newHolder}
                </Link>{' '}
                dethroned {f.oldHolder}
                {f.verifiedAt && ` · ${formatDaysAgo(f.verifiedAt)}`}
              </span>
            </span>
            <span className="text-right tabular-nums">
              <span className="text-sm text-fg-faint line-through">
                {f.oldKills}
              </span>
              <span className="mx-1.5 text-sm text-fg-faint">→</span>
              <span className="text-[1.0625rem] font-bold text-fg">
                {f.newKills}
              </span>
              <span className="ml-1 text-[0.6875rem] font-medium tracking-[0.06em] text-fg-muted">
                kills
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
