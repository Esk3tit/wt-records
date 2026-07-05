import { CountUp } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

export function ScoreboardTally() {
  return (
    <Hall>
      <p className="text-5xl font-bold text-accent-text">
        <CountUp value={42} />
      </p>
    </Hall>
  )
}

export function PercentSuffix() {
  return (
    <Hall>
      <p className="text-sm text-fg-muted">
        <CountUp value={2} suffix="%" /> of eligible vehicles claimed
      </p>
    </Hall>
  )
}
