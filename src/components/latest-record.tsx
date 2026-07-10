import { Link } from '@tanstack/react-router'
import { RecordName } from '#/components/record-name'
import { VehicleTags } from '#/components/vehicle-tags'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface LatestRecordData extends VehicleTagFlags {
  kills: number
  vehicleSlug: string
  vehicleName: string
  playerSlug: string
  displayName: string
  ignSnapshot: string | null
  displayNameSnapshot: string | null
}

export function LatestRecord({
  mode,
  record,
}: {
  mode: string
  record: LatestRecordData
}) {
  return (
    <span>
      <Link
        to="/$mode/vehicle/$slug"
        params={{ mode, slug: record.vehicleSlug }}
      >
        {record.vehicleName}
      </Link>
      <VehicleTags tags={record} /> —{' '}
      <span className="font-semibold">{record.kills}</span> kills by{' '}
      <RecordName
        displayName={record.displayName}
        playerSlug={record.playerSlug}
        ignSnapshot={record.ignSnapshot}
        displayNameSnapshot={record.displayNameSnapshot}
      />
    </span>
  )
}
