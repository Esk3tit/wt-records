import { VehicleTags } from 'wt-records'
import { Hall } from './hall'

const treeOnly = {
  isEvent: false,
  isPremium: false,
  isSquadron: false,
  isRemoved: false,
}

export function OneChipEach() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold text-fg">
        Object 279
        <VehicleTags tags={{ ...treeOnly, isEvent: true }} />
      </p>
      <p className="mt-3 text-[1.0625rem] font-semibold text-fg">
        2S38
        <VehicleTags tags={{ ...treeOnly, isPremium: true }} />
      </p>
      <p className="mt-3 text-[1.0625rem] font-semibold text-fg">
        BMP-2M
        <VehicleTags tags={{ ...treeOnly, isSquadron: true }} />
      </p>
    </Hall>
  )
}

export function StackedWithRemoved() {
  return (
    <Hall>
      <p className="text-[1.0625rem] font-semibold text-fg">
        IS-7
        <VehicleTags
          tags={{ ...treeOnly, isEvent: true, isPremium: true }}
        />
      </p>
      <p className="mt-3 text-[1.0625rem] font-semibold text-fg">
        Maus
        <VehicleTags tags={{ ...treeOnly, isEvent: true, isRemoved: true }} />
      </p>
    </Hall>
  )
}
