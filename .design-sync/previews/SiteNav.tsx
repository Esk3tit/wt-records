import { SiteNav } from 'wt-records'
import { Hall } from './hall'

export function AllModesLive() {
  return (
    <Hall width="42rem">
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
    <Hall width="42rem">
      <SiteNav
        modes={[
          { mode: 'grb', name: 'Ground RB', isLive: true },
          { mode: 'arb', name: 'Air RB', isLive: true },
        ]}
      />
    </Hall>
  )
}
