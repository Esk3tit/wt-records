import { Fragment } from 'react'
import { Chip } from '#/components/chip'
import { RemovedTag } from '#/components/removed-tag'

export interface VehicleTagFlags {
  isEvent: boolean
  isPremium: boolean
  isSquadron: boolean
  isRemoved: boolean
}

const ACQUISITION = [
  ['isEvent', 'event', 'Event vehicle — earned in a limited-time event'],
  [
    'isPremium',
    'premium',
    'Premium vehicle — bought with Golden Eagles or a pack',
  ],
  [
    'isSquadron',
    'squadron',
    'Squadron vehicle — researched with squadron activity',
  ],
] as const

export function hasVehicleTags(tags: VehicleTagFlags): boolean {
  return tags.isEvent || tags.isPremium || tags.isSquadron || tags.isRemoved
}

// Overlapping flags stack (an event vehicle can also be premium); tech tree
// renders nothing. The leading spaces let tight rows wrap whole chips.
export function VehicleTags({ tags }: { tags: VehicleTagFlags }) {
  return (
    <>
      {ACQUISITION.map(
        ([flag, label, title]) =>
          tags[flag] && (
            <Fragment key={flag}>
              {' '}
              <Chip title={title}>{label}</Chip>
            </Fragment>
          ),
      )}
      {tags.isRemoved && (
        <>
          {' '}
          <RemovedTag />
        </>
      )}
    </>
  )
}
