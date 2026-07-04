import { RecordMonument } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

const allTimeHigh = {
  kills: 42,
  vehicleSlug: 'leopard-2a7v',
  vehicleName: 'Leopard 2A7V',
  isRemoved: false,
  nationName: 'Germany',
  playerSlug: 'blitzkrieg-ace',
  displayName: 'BlitzkriegAce',
  ignSnapshot: null,
  displayNameSnapshot: null,
}

const removedVehicle = {
  kills: 38,
  vehicleSlug: 'maus',
  vehicleName: 'Maus',
  isRemoved: true,
  nationName: 'Germany',
  playerSlug: 'red-baron-wt',
  displayName: 'RedBaron_WT',
  ignSnapshot: 'BaronVonRed',
  displayNameSnapshot: null,
}

export function AllTimeHigh() {
  return (
    <Hall>
      <div className="glass-thick w-[24rem] p-8">
        <RecordMonument
          mode="grb"
          record={allTimeHigh}
          eligibleVehicles={2145}
        />
      </div>
    </Hall>
  )
}

export function RemovedVehicle() {
  return (
    <Hall>
      <div className="glass-thick w-[24rem] p-8">
        <RecordMonument
          mode="grb"
          record={removedVehicle}
          eligibleVehicles={2145}
        />
      </div>
    </Hall>
  )
}

export function TitlesOpen() {
  return (
    <Hall>
      <div className="glass-thick w-[24rem] p-8">
        <RecordMonument mode="grb" record={null} eligibleVehicles={2145} />
      </div>
    </Hall>
  )
}
