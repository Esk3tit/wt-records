import { FallenRecords } from 'wt-records'
import { Hall } from './hall'

const rows = [
  // prettier-ignore
  { vehicleSlug: 'object-279', vehicleName: 'Object 279', isRemoved: false, oldKills: 35, oldHolder: 'NightWitch', oldHolderSlug: 'nightwitch', newKills: 42, newHolder: 'KurskPhantom', newHolderSlug: 'kurskphantom', verifiedAt: new Date('2026-07-02T12:00:00Z') },
  // prettier-ignore
  { vehicleSlug: 't-34-100', vehicleName: 'T-34-100', isRemoved: true, oldKills: 21, oldHolder: 'VolgaVerdict', oldHolderSlug: 'volgaverdict', newKills: 24, newHolder: 'KurskPhantom', newHolderSlug: 'kurskphantom', verifiedAt: new Date('2026-06-30T12:00:00Z') },
  // prettier-ignore
  { vehicleSlug: '2s38', vehicleName: '2S38', isRemoved: false, oldKills: 26, oldHolder: 'NightWitch', oldHolderSlug: 'nightwitch', newKills: 28, newHolder: 'VolgaVerdict', newHolderSlug: 'volgaverdict', verifiedAt: new Date('2026-07-01T12:00:00Z') },
]

export function Dethroned() {
  return (
    <Hall width="34rem">
      <FallenRecords mode="grb" rows={rows} />
    </Hall>
  )
}
