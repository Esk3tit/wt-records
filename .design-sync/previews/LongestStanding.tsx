import { LongestStanding } from 'wt-records'
import { Hall } from './hall'

const rows = [
  // prettier-ignore
  { id: 1, kills: 31, vehicleSlug: 'maus', vehicleName: 'Maus', isEvent: true, isPremium: false, isSquadron: false, isRemoved: true, nationName: 'Germany', playerSlug: 'redbaron-wt', displayName: 'RedBaron_WT', ignSnapshot: 'BaronVonRed', displayNameSnapshot: null, verifiedAt: new Date('2022-12-24T12:00:00Z') },
  // prettier-ignore
  { id: 2, kills: 29, vehicleSlug: 'is-7', vehicleName: 'IS-7', isEvent: true, isPremium: true, isSquadron: false, isRemoved: false, nationName: 'USSR', playerSlug: 'blitzkriegace', displayName: 'BlitzkriegAce', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2024-02-21T12:00:00Z') },
  // prettier-ignore
  { id: 3, kills: 12, vehicleSlug: 'object-120', vehicleName: 'Object 120', isEvent: false, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'USSR', playerSlug: 'tarandriver', displayName: 'TaranDriver', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2025-05-18T12:00:00Z') },
]

export function Unbroken() {
  return (
    <Hall width="30rem">
      <LongestStanding mode="grb" rows={rows} />
    </Hall>
  )
}
