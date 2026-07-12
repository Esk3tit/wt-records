import { CountUp } from '#/components/count-up'
import { NationFlag } from '#/components/nation-flag'
import { RecordName } from '#/components/record-name'
import { VehicleLink } from '#/components/vehicle-link'
import type { TopRecordRow } from '#/components/top-records'

/* The lock-screen moment: the mode's all-time high standing over the scene.
   With no records yet, it inverts — the count of open titles is the feat. */
export function RecordMonument({
  mode,
  record,
  eligibleVehicles,
}: {
  mode: string
  record: TopRecordRow | null
  eligibleVehicles: number
}) {
  if (!record) {
    return (
      <div className="flex flex-col md:items-end md:text-right">
        <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
          Titles open
        </p>
        <p className="text-[clamp(4rem,9vw,6rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
          <CountUp value={eligibleVehicles} />
        </p>
        <p className="mt-2 max-w-[16rem] text-sm text-fg-muted">
          Every vehicle is an open bounty waiting for its first verified holder.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:items-end md:text-right">
      {record.vehicleImage && (
        <img
          src={record.vehicleImage}
          alt=""
          className="vehicle-portrait mb-3 h-24 self-start md:h-32 md:self-end"
          loading="eager"
          draggable={false}
        />
      )}
      <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
        All-time high
      </p>
      <p className="text-[clamp(4rem,9vw,6rem)] leading-none font-bold tracking-[-0.03em] text-accent-text">
        <CountUp value={record.kills} />
        <span className="ml-2 text-[0.9375rem] font-medium tracking-[0.06em] text-fg-muted">
          kills
        </span>
      </p>
      <p className="mt-2 text-[1.0625rem] font-semibold">
        <VehicleLink
          mode={mode}
          slug={record.vehicleSlug}
          name={record.vehicleName}
          tags={record}
        />
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
        <RecordName
          displayName={record.displayName}
          playerSlug={record.playerSlug}
          ignSnapshot={record.ignSnapshot}
          displayNameSnapshot={record.displayNameSnapshot}
        />
        {' · '}
        <NationFlag slug={record.nationSlug} className="mr-0.5" />
        {record.nationName}
      </p>
    </div>
  )
}
