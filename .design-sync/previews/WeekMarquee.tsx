import { WeekMarquee } from 'wt-records'
import { Hall } from './hall'

const records = [
  // prettier-ignore
  { id: 1, kills: 42, vehicleSlug: 'object-279', vehicleName: 'Object 279', isRemoved: false, nationName: 'USSR', playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-02T12:00:00Z') },
  // prettier-ignore
  { id: 2, kills: 28, vehicleSlug: '2s38', vehicleName: '2S38', isRemoved: false, nationName: 'USSR', playerSlug: 'volgaverdict', displayName: 'VolgaVerdict', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-01T12:00:00Z') },
  // prettier-ignore
  { id: 3, kills: 24, vehicleSlug: 't-34-100', vehicleName: 'T-34-100', isRemoved: true, nationName: 'USSR', playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-30T12:00:00Z') },
]

/* Three cards renders the static snap row — the deterministic form; the
   drift engages at four or more cards in the real page. */
export function WeeklyPodium() {
  return (
    <Hall width="44rem">
      <WeekMarquee mode="grb" records={records} />
    </Hall>
  )
}
