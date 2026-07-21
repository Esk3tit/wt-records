/* The card model: the pure, serializable projection every share card renders
   from. One mapper per card type produces it; the card component and the unfurl
   copy both consume it, so the image and the text can never disagree about the
   holder, the score, or the chips. `artUrl` is the remote (R2) art the route
   pre-fetches — the mapper stays sync and pure, so it only names the source. */

export type ChipTone = 'neutral' | 'removed'

export interface CardChip {
  label: string
  tone: ChipTone
}

export interface VehicleCardModel {
  kind: 'vehicle'
  modeLabel: string
  vehicleName: string
  nationSlug: string
  chips: CardChip[]
  /** null = Open bounty (no verified holder yet). */
  kills: number | null
  holder: string | null
  br: string | null
  patch: string | null
  patchName: string | null
  /** Qualifying threshold shown as the amber anchor on an Open bounty card. */
  minKills: number | null
  artUrl: string | null
  /** Content version for the `?v=` cache bust. */
  version: string
}

export interface NationCardModel {
  kind: 'nation'
  modeLabel: string
  nationName: string
  nationSlug: string
  held: number
  total: number
  completionPct: number
  avgKills: number | null
  mostHeldPlayer: string | null
  version: string
}

export interface PlayerModeCount {
  modeLabel: string
  count: number
}

export interface PlayerCardModel {
  kind: 'player'
  displayName: string
  totalRecords: number
  perMode: PlayerModeCount[]
  /** Best current record: highest kills across modes. */
  bestVehicle: string | null
  bestKills: number | null
  nationsSpanned: number
  /** The single Merge-tombstone exception to current-names-only. */
  previouslyKnownAs: string | null
  version: string
}
