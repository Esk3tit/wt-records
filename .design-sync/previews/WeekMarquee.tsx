import { WeekMarquee } from 'wt-records'
import { Hall } from './hall'

const records = [
  // prettier-ignore
  { id: 1, kills: 42, vehicleSlug: 'object-279', vehicleName: 'Object 279', isEvent: true, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'USSR', playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-02T12:00:00Z') },
  // prettier-ignore
  { id: 2, kills: 28, vehicleSlug: '2s38', vehicleName: '2S38', isEvent: false, isPremium: true, isSquadron: false, isRemoved: false, nationName: 'USSR', playerSlug: 'volgaverdict', displayName: 'VolgaVerdict', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-07-01T12:00:00Z') },
  // prettier-ignore
  { id: 3, kills: 24, vehicleSlug: 't-34-100', vehicleName: 'T-34-100', isEvent: false, isPremium: true, isSquadron: false, isRemoved: true, nationName: 'USSR', playerSlug: 'kurskphantom', displayName: 'KurskPhantom', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-30T12:00:00Z') },
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

const driftingWeek = [
  ...records,
  // prettier-ignore
  { id: 4, kills: 21, vehicleSlug: 'strv-122b-plss', vehicleName: 'Strv 122B PLSS', isEvent: false, isPremium: false, isSquadron: true, isRemoved: false, nationName: 'Sweden', playerSlug: 'norrlandwolf', displayName: 'NorrlandWolf', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-29T12:00:00Z') },
  // prettier-ignore
  { id: 5, kills: 19, vehicleSlug: 'leopard-2a7v', vehicleName: 'Leopard 2A7V', isEvent: false, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'Germany', playerSlug: 'panzerlehr', displayName: 'PanzerLehr', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-28T12:00:00Z') },
  // prettier-ignore
  { id: 6, kills: 18, vehicleSlug: 'm1a2-sep-v2', vehicleName: 'M1A2 SEP v2', isEvent: false, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'USA', playerSlug: 'abramsprime', displayName: 'AbramsPrime', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-27T12:00:00Z') },
  // prettier-ignore
  { id: 7, kills: 17, vehicleSlug: 'amx-40', vehicleName: 'AMX-40', isEvent: false, isPremium: false, isSquadron: false, isRemoved: false, nationName: 'France', playerSlug: 'gallicrooster', displayName: 'GallicRooster', ignSnapshot: null, displayNameSnapshot: null, verifiedAt: new Date('2026-06-26T12:00:00Z') },
]

/* Seven cards engage the duplicated drifting track — the animated form the
   real page shows on a full week. The capture catches one arbitrary frame. */
export function DriftingSeven() {
  return (
    <Hall width="44rem">
      <WeekMarquee mode="grb" records={driftingWeek} />
    </Hall>
  )
}
