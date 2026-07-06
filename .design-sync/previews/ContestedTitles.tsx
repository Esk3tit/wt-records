import { ContestedTitles } from 'wt-records'
import { Hall } from './hall'

const rows = [
  // prettier-ignore
  { vehicleSlug: 'object-279', vehicleName: 'Object 279', isEvent: true, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'USSR', contests: 5, kills: 42, playerSlug: 'kurskphantom', displayName: 'KurskPhantom' },
  // prettier-ignore
  { vehicleSlug: 'm4a1', vehicleName: 'M4A1', isEvent: false, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'USA', contests: 3, kills: 14, playerSlug: 'ace', displayName: 'Ace' },
  // prettier-ignore
  { vehicleSlug: '2s38', vehicleName: '2S38', isEvent: false, isPremium: true, isSquadron: false, isRemoved: false, nationName: 'USSR', contests: 2, kills: 28, playerSlug: 'volgaverdict', displayName: 'VolgaVerdict' },
  // prettier-ignore
  { vehicleSlug: 't-34-100', vehicleName: 'T-34-100', isEvent: false, isPremium: true, isSquadron: false, isRemoved: true, nationName: 'USSR', contests: 2, kills: 24, playerSlug: 'kurskphantom', displayName: 'KurskPhantom' },
]

export function HardestFought() {
  return (
    <Hall width="30rem">
      <ContestedTitles mode="grb" rows={rows} />
    </Hall>
  )
}
