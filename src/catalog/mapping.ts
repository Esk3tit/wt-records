import type { VehicleClass } from '#/lib/vehicle-classes'
import { slugify } from '#/lib/slug'

export type Branch = 'ground' | 'air' | 'naval'

export interface BranchAndClass {
  branch: Branch
  class: VehicleClass
}

const TYPE_MAP: Record<string, BranchAndClass> = {
  light_tank: { branch: 'ground', class: 'light' },
  medium_tank: { branch: 'ground', class: 'medium' },
  heavy_tank: { branch: 'ground', class: 'heavy' },
  tank_destroyer: { branch: 'ground', class: 'spg' },
  spaa: { branch: 'ground', class: 'spaa' },
  fighter: { branch: 'air', class: 'fighter' },
  assault: { branch: 'air', class: 'attacker' },
  bomber: { branch: 'air', class: 'bomber' },
  attack_helicopter: { branch: 'air', class: 'heli' },
  utility_helicopter: { branch: 'air', class: 'heli' },
  boat: { branch: 'naval', class: 'other' },
  heavy_boat: { branch: 'naval', class: 'other' },
  barge: { branch: 'naval', class: 'other' },
  frigate: { branch: 'naval', class: 'other' },
  destroyer: { branch: 'naval', class: 'other' },
  light_cruiser: { branch: 'naval', class: 'other' },
  heavy_cruiser: { branch: 'naval', class: 'other' },
  battlecruiser: { branch: 'naval', class: 'other' },
  battleship: { branch: 'naval', class: 'other' },
  submarine: { branch: 'naval', class: 'other' },
  ship: { branch: 'naval', class: 'other' },
}

export function branchAndClassForType(
  vehicleType: string,
): BranchAndClass | null {
  return TYPE_MAP[vehicleType] ?? null
}

/* Patches are community-facing major.minor ("2.57"); the datamine reports
   full build versions ("2.57.0.8"). */
export function patchFromGameVersion(gameVersion: string): string {
  const m = /^(\d+)\.(\d+)(?:\.|$)/.exec(gameVersion)
  if (!m) throw new Error(`Not a game version: "${gameVersion}"`)
  return `${m[1]}.${m[2]}`
}

export interface CanonicalNation {
  slug: string
  name: string
  sort: number
}

/* Datamine country → nations row, in in-game tech-tree order. */
const NATIONS: Record<string, CanonicalNation> = {
  usa: { slug: 'usa', name: 'USA', sort: 1 },
  germany: { slug: 'germany', name: 'Germany', sort: 2 },
  ussr: { slug: 'ussr', name: 'USSR', sort: 3 },
  britain: { slug: 'britain', name: 'Great Britain', sort: 4 },
  japan: { slug: 'japan', name: 'Japan', sort: 5 },
  china: { slug: 'china', name: 'China', sort: 6 },
  italy: { slug: 'italy', name: 'Italy', sort: 7 },
  france: { slug: 'france', name: 'France', sort: 8 },
  sweden: { slug: 'sweden', name: 'Sweden', sort: 9 },
  israel: { slug: 'israel', name: 'Israel', sort: 10 },
}

export function nationForCountry(country: string): CanonicalNation | null {
  return NATIONS[country] ?? null
}

export const CANONICAL_NATIONS: ReadonlyArray<CanonicalNation> =
  Object.values(NATIONS)

export type BrField = 'arcadeBr' | 'realisticBr' | 'simulatorBr'

/* Which datamine BR feeds vehicle_br for each mode. A new modes row needs an
   entry here before the sync can fill its BRs. */
const MODE_BR_FIELD: Record<string, BrField> = {
  grb: 'realisticBr',
  gab: 'arcadeBr',
  arb: 'realisticBr',
  aab: 'arcadeBr',
}

export function modeBrField(mode: string): BrField | null {
  return MODE_BR_FIELD[mode] ?? null
}

export function latestGameVersion(versions: Array<string>): string {
  // A non-numeric segment would compare as NaN and silently lose — drop it.
  const numeric = versions.filter((v) =>
    v.split('.').every((s) => /^\d+$/.test(s)),
  )
  if (numeric.length === 0) {
    throw new Error(`No usable game versions in ${JSON.stringify(versions)}`)
  }
  const parts = (v: string) => v.split('.').map(Number)
  return numeric.reduce((best, v) => {
    const a = parts(v)
    const b = parts(best)
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0)
      if (d !== 0) return d > 0 ? v : best
    }
    return best
  })
}

/** Permanent public URL slug for a new vehicle: base name, then a nation
    suffix, then a counter — or null when nothing slugifiable exists. */
export function assignVehicleSlug(
  name: string,
  externalId: string,
  nationSlug: string,
  taken: ReadonlySet<string>,
): string | null {
  const base = slugify(name) || slugify(externalId)
  if (!base) return null
  let candidate = base
  if (taken.has(candidate)) candidate = `${base}-${nationSlug}`
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${base}-${nationSlug}-${n}`
  }
  return candidate
}
