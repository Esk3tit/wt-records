import { RemovedTag } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

export function Standalone() {
  return (
    <Hall>
      <RemovedTag />
    </Hall>
  )
}

export function AfterVehicleName() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold text-fg">
        Maus
        <RemovedTag />
      </p>
    </Hall>
  )
}
