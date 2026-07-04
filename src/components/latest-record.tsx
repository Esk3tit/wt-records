import { Link } from '@tanstack/react-router'
import { RecordName } from '#/components/record-name'
import { RemovedTag } from '#/components/removed-tag'

export interface LatestRecordData {
  kills: number
  vehicleSlug: string
  vehicleName: string
  isRemoved: boolean
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
      {record.isRemoved && <RemovedTag />} — {record.kills} kills by{' '}
      <RecordName
        displayName={record.displayName}
        playerSlug={record.playerSlug}
        ignSnapshot={record.ignSnapshot}
        displayNameSnapshot={record.displayNameSnapshot}
      />
    </span>
  )
}
