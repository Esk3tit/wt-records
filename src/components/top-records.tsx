import { RecordName } from '#/components/record-name'
import { VehicleLink } from '#/components/vehicle-link'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface TopRecordRow extends VehicleTagFlags {
  kills: number
  vehicleSlug: string
  vehicleName: string
  nationName: string
  nationSlug: string
  vehicleImage: string | null
  playerSlug: string
  displayName: string
  ignSnapshot: string | null
  displayNameSnapshot: string | null
}

/* Companion cards to the monument: the #2/#3 chasers. */
export function TopRecords({
  mode,
  records,
}: {
  mode: string
  records: TopRecordRow[]
}) {
  return (
    <ol className="grid gap-3.5 sm:grid-cols-2">
      {records.map((r, i) => (
        <li key={r.vehicleSlug} className="glass-mid pane-lift p-5.5">
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
            #{i + 2}
          </p>
          <p className="mt-2 text-5xl leading-none font-bold tracking-[-0.03em] text-fg">
            {r.kills}
            <span className="ml-1 text-[0.8125rem] font-medium tracking-[0.06em] text-fg-muted">
              kills
            </span>
          </p>
          <p className="mt-3.5 text-[1.0625rem] font-semibold">
            <VehicleLink
              mode={mode}
              slug={r.vehicleSlug}
              name={r.vehicleName}
              tags={r}
            />
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
            <RecordName
              displayName={r.displayName}
              playerSlug={r.playerSlug}
              ignSnapshot={r.ignSnapshot}
              displayNameSnapshot={r.displayNameSnapshot}
            />
            {' · '}
            {r.nationName}
          </p>
        </li>
      ))}
    </ol>
  )
}
