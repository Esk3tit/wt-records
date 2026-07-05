export interface ModeStatsData {
  records: number
  holders: number
  eligibleVehicles: number
  coveredVehicles: number
  remainingVehicles: number
  completionPct: number
}

/* One inline strip, no tiles: the monument owns the page's celebration. */
export function ModeStats({ stats }: { stats: ModeStatsData }) {
  return (
    <dl className="mt-6 flex flex-wrap gap-y-3">
      <Stat label="Records" value={stats.records} />
      <Stat label="Holders" value={stats.holders} />
      <Stat label="Completion" value={`${stats.completionPct}%`} />
      <Stat label="Unclaimed" value={stats.remainingVehicles} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="mr-5 flex flex-col gap-0.5 border-r border-hairline-soft pr-5 last:mr-0 last:border-r-0 last:pr-0">
      <dd className="text-lg leading-none font-semibold">{value}</dd>
      <dt className="text-[0.6875rem] tracking-[0.08em] text-fg-muted uppercase">
        {label}
      </dt>
    </div>
  )
}
