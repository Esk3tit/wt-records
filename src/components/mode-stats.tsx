import { CountUp } from '#/components/count-up'

export interface ModeStatsData {
  records: number
  holders: number
  eligibleVehicles: number
  coveredVehicles: number
  remainingVehicles: number
  completionPct: number
}

export function ModeStats({ stats }: { stats: ModeStatsData }) {
  return (
    <dl className="mt-7 flex flex-wrap gap-3.5">
      <Stat label="Records" accent>
        <CountUp value={stats.records} />
      </Stat>
      <Stat label="Holders">
        <CountUp value={stats.holders} />
      </Stat>
      <Stat label="Complete" accent>
        <CountUp value={stats.completionPct} suffix="%" />
      </Stat>
      <Stat label="Unclaimed">
        <CountUp value={stats.remainingVehicles} />
      </Stat>
    </dl>
  )
}

function Stat({
  label,
  accent = false,
  children,
}: {
  label: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-w-[7.5rem] flex-1 rounded-[18px] border border-hairline-soft bg-tint px-4.5 py-4">
      <dd
        className={
          'text-3xl font-bold tracking-[-0.02em] ' +
          (accent ? 'text-accent-text' : 'text-fg')
        }
      >
        {children}
      </dd>
      <dt className="mt-1 text-[0.6875rem] tracking-[0.08em] text-fg-muted uppercase">
        {label}
      </dt>
    </div>
  )
}
