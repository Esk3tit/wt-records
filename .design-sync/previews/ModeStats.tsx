import { ModeStats } from 'wt-records'
import { Hall } from './hall'

export function Canonical() {
  return (
    <Hall>
      <div className="w-[26rem]">
        <h2 className="text-lg font-semibold">Ground Realistic Battles</h2>
        <ModeStats
          stats={{
            records: 128,
            holders: 57,
            eligibleVehicles: 2145,
            coveredVehicles: 48,
            remainingVehicles: 2097,
            completionPct: 2,
          }}
        />
      </div>
    </Hall>
  )
}

export function EarlyRegistry() {
  return (
    <Hall>
      <div className="w-[26rem]">
        <h2 className="text-lg font-semibold">Air Realistic Battles</h2>
        <ModeStats
          stats={{
            records: 3,
            holders: 2,
            eligibleVehicles: 2145,
            coveredVehicles: 3,
            remainingVehicles: 2142,
            completionPct: 0,
          }}
        />
      </div>
    </Hall>
  )
}
