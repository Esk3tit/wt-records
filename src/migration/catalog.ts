import { eq } from 'drizzle-orm'
import * as schema from '#/db/schema'
import type { SeedDb } from '#/db/seed'
import type { CatalogVehicle } from '#/migration/match'

/** The catalog slice Resolve matches against — every vehicle of the mode's
    branch (removed ones included; they hold records like any other). */
export async function loadCatalogVehicles(
  db: SeedDb,
  branch: 'ground' | 'air' | 'naval',
): Promise<Array<CatalogVehicle>> {
  const rows = await db
    .select({
      id: schema.vehicles.id,
      externalId: schema.vehicles.externalId,
      name: schema.vehicles.name,
      nation: schema.nations.slug,
      class: schema.vehicles.class,
      isRemoved: schema.vehicles.isRemoved,
    })
    .from(schema.vehicles)
    .innerJoin(schema.nations, eq(schema.vehicles.nationId, schema.nations.id))
    .where(eq(schema.vehicles.branch, branch))

  const terms = await db
    .select({
      vehicleId: schema.vehicleSearchTerms.vehicleId,
      term: schema.vehicleSearchTerms.term,
    })
    .from(schema.vehicleSearchTerms)

  const termsByVehicle = new Map<number, Array<string>>()
  for (const { vehicleId, term } of terms) {
    const list = termsByVehicle.get(vehicleId)
    if (list) list.push(term)
    else termsByVehicle.set(vehicleId, [term])
  }

  return rows.map((row) => ({
    externalId: row.externalId,
    name: row.name,
    nation: row.nation,
    class: row.class,
    isRemoved: row.isRemoved,
    terms: termsByVehicle.get(row.id) ?? [],
  }))
}
