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
