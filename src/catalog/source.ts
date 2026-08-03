/* The source-adapter seam: adapters emit datamine vocabulary; country/type
   mapping stays in the sync engine so every source shares it. */

/** A vehicle's artwork upstream. One object rather than two nullable fields:
    a source that knows the URL always knows the content id, and vice versa. */
export interface SourcePortrait {
  url: string
  /** Opaque upstream identifier where equal strings mean identical bytes. */
  contentId: string
}

export interface SourceVehicle {
  /** Datamine unit identifier, e.g. "us_m1_abrams" — `vehicles.external_id`. */
  externalId: string
  /** English display name, e.g. "M1 Abrams". */
  name: string
  /** Datamine country, e.g. "usa", "britain". */
  country: string
  /** Datamine vehicle type, e.g. "medium_tank", "assault". */
  vehicleType: string
  /** In-game rank (datamine "era"), 1-based. */
  era: number
  arcadeBr: number
  realisticBr: number
  simulatorBr: number
  isPremium: boolean
  isSquadron: boolean
  /** Source event tag (battlepass/craft/summer…), null for non-event. */
  event: string | null
  /** null when the source publishes no artwork for this vehicle — an ordinary
      permanent state for test rigs and event props, not a missing asset. */
  portrait: SourcePortrait | null
}

export interface CatalogSnapshot {
  /** Full game build version the snapshot reflects, e.g. "2.57.0.8". */
  gameVersion: string
  /** Ownable/researchable units ONLY — adapters must drop scripted and
      killstreak units (nuke bombers, event bosses) before emitting. */
  vehicles: Array<SourceVehicle>
  /** Source-side anomalies (skipped units etc.) — merged into the sync summary. */
  warnings?: Array<string>
}

export interface CatalogSource {
  /** Human-readable source label for logs/summaries. */
  readonly name: string
  fetchSnapshot: () => Promise<CatalogSnapshot>
}
