import { ComingSoon } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

export function NavalRealistic() {
  return (
    <Hall>
      <ComingSoon modeName="Naval Realistic" />
    </Hall>
  )
}
