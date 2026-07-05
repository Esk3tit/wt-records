import { LatestFeed } from 'wt-records'
import { Hall } from './hall'

const entries = [
  // prettier-ignore
  { id: 1, kills: 42, vehicleSlug: 'object-279', vehicleName: 'Object 279', isRemoved: false, playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-02T12:00:00Z') },
  // prettier-ignore
  { id: 2, kills: 28, vehicleSlug: '2s38', vehicleName: '2S38', isRemoved: false, playerSlug: 'volgaverdict', displayName: 'VolgaVerdict', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-01T12:00:00Z') },
  // prettier-ignore
  { id: 3, kills: 24, vehicleSlug: 't-34-100', vehicleName: 'T-34-100', isRemoved: true, playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-30T12:00:00Z') },
  // prettier-ignore
  { id: 4, kills: 21, vehicleSlug: 'strv-122b-plss', vehicleName: 'Strv 122B PLSS', isRemoved: false, playerSlug: 'norrlandwolf', displayName: 'NorrlandWolf', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-29T12:00:00Z') },
  // prettier-ignore
  { id: 5, kills: 19, vehicleSlug: 'leopard-2a7v', vehicleName: 'Leopard 2A7V', isRemoved: false, playerSlug: 'panzerlehr', displayName: 'PanzerLehr', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-28T12:00:00Z') },
]

export function StaticLog() {
  return (
    <Hall width="24rem">
      <div style={{ height: '22rem' }}>
        <LatestFeed mode="grb" entries={entries} />
      </div>
    </Hall>
  )
}

export function Empty() {
  return (
    <Hall width="24rem">
      <LatestFeed mode="grb" entries={[]} />
    </Hall>
  )
}
