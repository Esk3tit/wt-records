import { Podium } from 'wt-records'
import { Hall } from './hall'

const records = [
  // prettier-ignore
  { id: 1, kills: 42, vehicleSlug: 'object-279', vehicleName: 'Object 279', isRemoved: false, nationName: 'USSR', playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-02T12:00:00Z') },
  // prettier-ignore
  { id: 2, kills: 37, vehicleSlug: 't-80bvm', vehicleName: 'T-80BVM', isRemoved: false, nationName: 'USSR', playerSlug: 'steelhunter', displayName: 'SteelHunter', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-04-05T12:00:00Z') },
  // prettier-ignore
  { id: 3, kills: 34, vehicleSlug: 'challenger-2e', vehicleName: 'Challenger 2E', isRemoved: false, nationName: 'Britain', playerSlug: 'nightwitch', displayName: 'NightWitch', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-03-06T12:00:00Z') },
  // prettier-ignore
  { id: 4, kills: 31, vehicleSlug: 'maus', vehicleName: 'Maus', isRemoved: true, nationName: 'Germany', playerSlug: 'redbaron-wt', displayName: 'RedBaron_WT', ignSnapshot: 'BaronVonRed', displayNameSnapshot: null, verifiedAt: new Date('2022-12-24T12:00:00Z') },
  // prettier-ignore
  { id: 5, kills: 29, vehicleSlug: 'is-7', vehicleName: 'IS-7', isRemoved: false, nationName: 'USSR', playerSlug: 'blitzkriegace', displayName: 'BlitzkriegAce', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2024-02-21T12:00:00Z') },
]

export function TopFive() {
  return (
    <Hall width="38rem">
      <Podium mode="grb" records={records} />
    </Hall>
  )
}

export function TopThree() {
  return (
    <Hall width="38rem">
      <Podium mode="grb" records={records.slice(0, 3)} />
    </Hall>
  )
}
