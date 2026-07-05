import { HotVehicles } from 'wt-records'
import { Hall } from './hall'

const rows = [
  // prettier-ignore
  { vehicleSlug: 'm1a2-sep-v2', vehicleName: 'M1A2 SEP v2', isRemoved: false, nationName: 'USA', submissions: 12 },
  // prettier-ignore
  { vehicleSlug: '2s38', vehicleName: '2S38', isRemoved: false, nationName: 'USSR', submissions: 9 },
  // prettier-ignore
  { vehicleSlug: 'leopard-2a7v', vehicleName: 'Leopard 2A7V', isRemoved: false, nationName: 'Germany', submissions: 7 },
  // prettier-ignore
  { vehicleSlug: 't-34-100', vehicleName: 'T-34-100', isRemoved: true, nationName: 'USSR', submissions: 5 },
]

export function SevenDayHeat() {
  return (
    <Hall width="30rem">
      <HotVehicles mode="grb" rows={rows} />
    </Hall>
  )
}
