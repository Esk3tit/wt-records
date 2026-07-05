import { NationCompletion } from 'wt-records'
import { Hall } from './hall'

const nations = [
  // prettier-ignore
  { slug: 'ussr', name: 'USSR', eligibleVehicles: 330, coveredVehicles: 291, completionPct: 88 },
  // prettier-ignore
  { slug: 'germany', name: 'Germany', eligibleVehicles: 335, coveredVehicles: 289, completionPct: 86 },
  // prettier-ignore
  { slug: 'usa', name: 'USA', eligibleVehicles: 320, coveredVehicles: 232, completionPct: 73 },
  // prettier-ignore
  { slug: 'britain', name: 'Britain', eligibleVehicles: 232, coveredVehicles: 172, completionPct: 74 },
  // prettier-ignore
  { slug: 'france', name: 'France', eligibleVehicles: 202, coveredVehicles: 128, completionPct: 63 },
  // prettier-ignore
  { slug: 'japan', name: 'Japan', eligibleVehicles: 178, coveredVehicles: 108, completionPct: 61 },
]

export function CompletionBars() {
  return (
    <Hall width="42rem">
      <NationCompletion mode="grb" nations={nations} />
    </Hall>
  )
}
