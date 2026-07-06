import { VehicleLink } from 'wt-records'
import { Hall } from './hall'

const treeOnly = {
  isEvent: false,
  isPremium: false,
  isSquadron: false,
  isRemoved: false,
}

export function CurrentVehicle() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold">
        <VehicleLink
          mode="grb"
          slug="leopard-2a7v"
          name="Leopard 2A7V"
          tags={treeOnly}
        />
      </p>
    </Hall>
  )
}

export function RemovedEventVehicle() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold">
        <VehicleLink
          mode="grb"
          slug="maus"
          name="Maus"
          tags={{ ...treeOnly, isEvent: true, isRemoved: true }}
        />
      </p>
    </Hall>
  )
}
