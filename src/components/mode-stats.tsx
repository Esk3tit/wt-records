import { completionPct } from '#/lib/completion'

export interface ModeStatsData {
  records: number
  holders: number
  eligibleVehicles: number
  coveredVehicles: number
}

export function ModeStats({ stats }: { stats: ModeStatsData }) {
  return (
    <dl className="flex gap-8">
      <Stat label="Records" value={stats.records} />
      <Stat label="Holders" value={stats.holders} />
      <Stat
        label="Completion"
        value={`${completionPct(stats.coveredVehicles, stats.eligibleVehicles)}%`}
      />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-sm text-fg-faint">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  )
}
