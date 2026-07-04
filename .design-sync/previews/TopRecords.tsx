import { TopRecords } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

const chaserPair = [
  {
    kills: 37,
    vehicleSlug: 't-80bvm',
    vehicleName: 'T-80BVM',
    isRemoved: false,
    nationName: 'USSR',
    playerSlug: 'steel-hunter',
    displayName: 'SteelHunter',
    ignSnapshot: null,
    displayNameSnapshot: null,
  },
  {
    kills: 34,
    vehicleSlug: 'challenger-2e',
    vehicleName: 'Challenger 2E',
    isRemoved: false,
    nationName: 'Britain',
    playerSlug: 'night-witch',
    displayName: 'NightWitch',
    ignSnapshot: null,
    displayNameSnapshot: null,
  },
]

const withRemovedAndSnapshot = [
  {
    kills: 31,
    vehicleSlug: 'maus',
    vehicleName: 'Maus',
    isRemoved: true,
    nationName: 'Germany',
    playerSlug: 'red-baron-wt',
    displayName: 'RedBaron_WT',
    ignSnapshot: 'BaronVonRed',
    displayNameSnapshot: null,
  },
  {
    kills: 29,
    vehicleSlug: 'is-7',
    vehicleName: 'IS-7',
    isRemoved: false,
    nationName: 'USSR',
    playerSlug: 'blitzkrieg-ace',
    displayName: 'BlitzkriegAce',
    ignSnapshot: null,
    displayNameSnapshot: null,
  },
]

export function ChaserPair() {
  return (
    <Hall>
      <div style={{ width: '40rem' }}>
        <TopRecords mode="grb" records={chaserPair} />
      </div>
    </Hall>
  )
}

export function RemovedVehicleWithSnapshot() {
  return (
    <Hall>
      <div style={{ width: '40rem' }}>
        <TopRecords mode="grb" records={withRemovedAndSnapshot} />
      </div>
    </Hall>
  )
}
