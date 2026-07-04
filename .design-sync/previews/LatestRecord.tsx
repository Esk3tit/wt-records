import { LatestRecord } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

const currentVehicle = {
  kills: 28,
  vehicleSlug: 'f-14b-tomcat',
  vehicleName: 'F-14B Tomcat',
  isRemoved: false,
  playerSlug: 'night-witch',
  displayName: 'NightWitch',
  ignSnapshot: null,
  displayNameSnapshot: null,
}

const removedWithSnapshots = {
  kills: 24,
  vehicleSlug: 'maus',
  vehicleName: 'Maus',
  isRemoved: true,
  playerSlug: 'red-baron-wt',
  displayName: 'RedBaron_WT',
  ignSnapshot: 'BaronVonRed',
  displayNameSnapshot: 'TheRedBaron',
}

export function CurrentVehicle() {
  return (
    <Hall>
      <p className="text-sm text-fg-muted">
        <span className="font-semibold text-fg">Latest — </span>
        <LatestRecord mode="arb" record={currentVehicle} />
      </p>
    </Hall>
  )
}

export function RemovedVehicleSnapshots() {
  return (
    <Hall>
      <p className="text-sm text-fg-muted">
        <span className="font-semibold text-fg">Latest — </span>
        <LatestRecord mode="grb" record={removedWithSnapshots} />
      </p>
    </Hall>
  )
}
