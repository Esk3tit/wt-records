import { RecordHistory } from 'wt-records'
import { Hall } from './hall'

const steps = [
  // prettier-ignore
  { kills: 18, verifiedAt: new Date('2025-04-20T12:00:00Z'), displayName: 'UralEcho', playerSlug: 'uralecho' },
  // prettier-ignore
  { kills: 24, verifiedAt: new Date('2025-09-08T12:00:00Z'), displayName: 'SteelHunter', playerSlug: 'steelhunter' },
  // prettier-ignore
  { kills: 27, verifiedAt: new Date('2025-12-07T12:00:00Z'), displayName: 'KurskPhantom', playerSlug: 'kurskphantom' },
  // prettier-ignore
  { kills: 35, verifiedAt: new Date('2026-02-04T12:00:00Z'), displayName: 'NightWitch', playerSlug: 'nightwitch' },
  // prettier-ignore
  { kills: 42, verifiedAt: new Date('2026-07-02T12:00:00Z'), displayName: 'KurskPhantom', playerSlug: 'kurskphantom' },
]

export function Progression() {
  return (
    <Hall width="38rem">
      <RecordHistory steps={steps} />
    </Hall>
  )
}
