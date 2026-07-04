import { Link } from '@tanstack/react-router'
import { CountUp } from '#/components/count-up'
import { RecordName } from '#/components/record-name'
import { RemovedTag } from '#/components/removed-tag'
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
        <Link
          to="/$mode/vehicle/$slug"
          params={{ mode, slug: record.vehicleSlug }}
          className="no-underline hover:underline"
        >
          {record.vehicleName}
        </Link>
        {record.isRemoved && <RemovedTag />}
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
        <RecordName
          displayName={record.displayName}
          playerSlug={record.playerSlug}
          ignSnapshot={record.ignSnapshot}
          displayNameSnapshot={record.displayNameSnapshot}
        />
        {' · '}
        {record.nationName}
      </p>
    </div>
  )
}
