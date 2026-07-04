import { VehicleLink } from '#/components/vehicle-link'

export interface HotVehicleRow {
  vehicleSlug: string
  vehicleName: string
  isRemoved: boolean
  nationName: string
  submissions: number
}

export function HotVehicles({
  mode,
  rows,
}: {
  mode: string
  rows: HotVehicleRow[]
}) {
  const max = rows[0].submissions
  return (
    <div className="glass-mid overflow-hidden">
      <ol>
        {rows.map((v, i) => (
          <li
            key={v.vehicleSlug}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3.5 border-b border-hairline-soft px-5 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-[var(--row-hover)]"
          >
            <span className="text-center font-bold text-fg-faint">{i + 1}</span>
            <span className="min-w-0">
              <span className="font-semibold text-fg">
                <VehicleLink
                  mode={mode}
                  slug={v.vehicleSlug}
                  name={v.vehicleName}
                  isRemoved={v.isRemoved}
                />
              </span>
              <span className="mt-0.5 block text-[0.6875rem] font-medium text-fg-muted">
                {v.nationName}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="hidden h-1.5 w-[4.5rem] overflow-hidden rounded-full bg-tint-strong sm:block"
              >
                <span
                  className="block h-full rounded-full bg-[var(--ink-faint)]"
                  style={{ width: `${(v.submissions / max) * 100}%` }}
                />
              </span>
              <span className="min-w-[2.25rem] text-right text-[1.0625rem] font-bold text-fg">
                {v.submissions}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
