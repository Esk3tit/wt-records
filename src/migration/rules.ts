import type { VehicleClass } from '#/lib/vehicle-classes'

/** Shape of data/migration/<mode>/rules.json — the human-transcribed record
    of the sheet's Rules tab. */
export interface MigrationRules {
  minKills: Partial<Record<VehicleClass, number>>
  difficultMinKills: number
  difficultVehicles: Array<{ name: string; nation?: string }>
}

/** Shape of data/migration/<mode>/patches.json — the historical patches
    backfill (version → name + release date from the official update list). */
export interface PatchBackfillEntry {
  version: string
  name: string | null
  releasedAt: string
}
