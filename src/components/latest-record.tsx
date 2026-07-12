import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { RecordName } from '#/components/record-name'
import { VehicleIcon } from '#/components/vehicle-icon'
import { VehicleTags } from '#/components/vehicle-tags'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface LatestRecordData extends VehicleTagFlags {
  kills: number
  vehicleSlug: string
  vehicleName: string
  nationSlug: string
  vehicleImage: string | null
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
      <NationFlag slug={record.nationSlug} className="mr-1.5" />
      <VehicleIcon src={record.vehicleImage} className="mr-1.5" />
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
