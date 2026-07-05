import { SiteNav } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-[26px] bg-base p-8 text-fg"
      style={{ width: '42rem' }}
    >
      {children}
    </div>
  )
}

export function AllModesLive() {
  return (
    <Hall>
      <SiteNav
        modes={[
          { mode: 'grb', name: 'Ground RB', isLive: true },
          { mode: 'arb', name: 'Air RB', isLive: true },
          { mode: 'nrb', name: 'Naval RB', isLive: true },
        ]}
      />
    </Hall>
  )
}

export function TwoModesLive() {
  return (
    <Hall>
      <SiteNav
        modes={[
          { mode: 'grb', name: 'Ground RB', isLive: true },
          { mode: 'arb', name: 'Air RB', isLive: true },
        ]}
      />
    </Hall>
  )
}
