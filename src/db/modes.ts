export interface CanonicalMode {
  mode: string
  name: string
  branch: 'ground' | 'air'
  isLive: boolean
  sort: number
}

// Near-static config shared by the seed and the migration importer, so a
// reset → catalog:sync → import rollout never sees an empty modes table.
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
