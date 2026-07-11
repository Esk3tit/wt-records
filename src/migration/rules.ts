import type { VehicleClass } from '#/lib/vehicle-classes'

/** Shape of data/migration/<mode>/rules.json — the human-transcribed record
    of the sheet's Rules tab. */
export interface MigrationRules {
  minKills: Partial<Record<VehicleClass, number>>
  difficultMinKills: number
  difficultVehicles: Array<{ name: string; nation?: string }>
}

export interface CanonicalMode {
  mode: string
  name: string
  branch: 'ground' | 'air'
  isLive: boolean
  sort: number
}

/* The four modes are near-static config; Load and import:reset upsert them so
   the prod rollout (resetFixture → catalog:sync → load) never runs against an
   empty modes table. */
export const CANONICAL_MODES: ReadonlyArray<CanonicalMode> = [
  {
    mode: 'grb',
    name: 'Ground Realistic Battles',
    branch: 'ground',
    isLive: true,
    sort: 1,
  },
  {
    mode: 'gab',
    name: 'Ground Arcade Battles',
    branch: 'ground',
    isLive: false,
    sort: 2,
  },
  {
    mode: 'arb',
    name: 'Air Realistic Battles',
    branch: 'air',
    isLive: false,
    sort: 3,
  },
  {
    mode: 'aab',
    name: 'Air Arcade Battles',
    branch: 'air',
    isLive: false,
    sort: 4,
  },
]

/** Shape of data/migration/<mode>/patches.json — the historical patches
    backfill (version → name + release date from the official update list). */
export interface PatchBackfillEntry {
  version: string
  name: string | null
  releasedAt: string
}
