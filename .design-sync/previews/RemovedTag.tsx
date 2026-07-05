import { RemovedTag } from 'wt-records'
import { Hall } from './hall'

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
