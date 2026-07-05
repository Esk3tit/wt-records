import { VehicleLink } from 'wt-records'
import { Hall } from './hall'

export function CurrentVehicle() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold">
        <VehicleLink
          mode="grb"
          slug="leopard-2a7v"
          name="Leopard 2A7V"
          isRemoved={false}
        />
      </p>
    </Hall>
  )
}

export function RemovedVehicle() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold">
        <VehicleLink mode="grb" slug="maus" name="Maus" isRemoved />
      </p>
    </Hall>
  )
}
