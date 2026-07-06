import { LatestRecord } from 'wt-records'
import { Hall } from './hall'

const currentVehicle = {
  kills: 28,
  vehicleSlug: 'f-14b-tomcat',
  vehicleName: 'F-14B Tomcat',
  isEvent: false, isPremium: false, isSquadron: false, isRemoved: false,
  playerSlug: 'night-witch',
  displayName: 'NightWitch',
  ignSnapshot: null,
  displayNameSnapshot: null,
}

const removedWithSnapshots = {
  kills: 24,
  vehicleSlug: 'maus',
  vehicleName: 'Maus',
  isEvent: false, isPremium: false, isSquadron: false, isRemoved: true,
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
