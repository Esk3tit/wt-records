// Single source of truth for vehicle classes. Both the Drizzle `vehicle_class`
// enum (src/db/schema.ts) and the rule logic (src/lib/rules.ts) derive from
// this, so adding/removing a class can't silently desync them. Order is
// significant — it's the Postgres enum order.
export const VEHICLE_CLASSES = [
  'light',
  'medium',
  'heavy',
  'spg',
  'spaa',
  'fighter',
  'attacker',
  'bomber',
  'heli',
  'other',
] as const

export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

// Display label for a class: acronyms stay upper-case (SPG/SPAA), the rest are
// title-cased. Plain CSS `capitalize` gets the acronyms wrong ("Spg").
const CLASS_ACRONYMS: Partial<Record<VehicleClass, string>> = {
  spg: 'SPG',
  spaa: 'SPAA',
}

export function classLabel(c: string): string {
  return (
    CLASS_ACRONYMS[c as VehicleClass] ?? c.charAt(0).toUpperCase() + c.slice(1)
  )
}
