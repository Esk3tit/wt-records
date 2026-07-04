import { RecordName } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

export function SnapshotsMatch() {
  return (
    <Hall>
      <p className="text-[0.8125rem] text-fg-muted">
        <RecordName
          displayName="SteelHunter"
          playerSlug="steel-hunter"
          ignSnapshot="SteelHunter"
          displayNameSnapshot="SteelHunter"
        />
        {' · '}USSR
      </p>
    </Hall>
  )
}

export function DifferingIgn() {
  return (
    <Hall>
      <p className="text-[0.8125rem] text-fg-muted">
        <RecordName
          displayName="RedBaron_WT"
          playerSlug="red-baron-wt"
          ignSnapshot="BaronVonRed"
          displayNameSnapshot="RedBaron_WT"
        />
        {' · '}Germany
      </p>
    </Hall>
  )
}

export function FullAnnotations() {
  return (
    <Hall>
      <p className="text-[0.8125rem] text-fg-muted">
        <RecordName
          displayName="NightWitch"
          playerSlug="night-witch"
          ignSnapshot="NachtHexe"
          displayNameSnapshot="MidnightWitch"
        />
        {' · '}Britain
      </p>
    </Hall>
  )
}
