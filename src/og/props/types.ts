// The pure card model the image AND the unfurl copy both consume, so picture
// and text can't disagree. `artUrl` is remote art the route pre-fetches.

export interface CardChip {
  label: string
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
  /** A verified score still standing on a title nobody holds. Omitted (not
      null) elsewhere, so no other card's content version shifts for it. */
  standing?: number
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
  /** R2 key of the Player's Avatar (null = Medallion). Enters the version so
      set/replace/remove busts the card URL; the route resolves it to bytes. */
  avatarKey: string | null
  /** ISO-3166 alpha-2, never the resolved mark: `head()` computes this model
      on the client too, and the 250 marks are server-only. */
  countryCode: string | null
  version: string
}
