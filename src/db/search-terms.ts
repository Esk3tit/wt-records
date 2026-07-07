import { inArray } from 'drizzle-orm'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '#/db/schema'
import { nameSearchTerms } from '#/lib/search-terms'

type TermsDb = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

const CHUNK = 500

/** Rewrite the search terms for the given vehicles — delete + insert, so a
 * rename never leaves stale terms behind. Vehicles not passed (e.g. flagged
 * removed) keep their terms and stay searchable. */
export function replaceSearchTerms(
  db: TermsDb,
  vehicles: Array<{ id: number; name: string }>,
): Promise<number> {
  // Own transaction (a savepoint when the caller is already in one), so a
  // failure mid-swap can't leave vehicles termless.
  return db.transaction(async (tx) => {
    const ids = vehicles.map((v) => v.id)
    for (let i = 0; i < ids.length; i += CHUNK) {
      await tx
        .delete(schema.vehicleSearchTerms)
        .where(
          inArray(schema.vehicleSearchTerms.vehicleId, ids.slice(i, i + CHUNK)),
        )
    }
    const rows = vehicles.flatMap((v) =>
      nameSearchTerms(v.name).map((term) => ({ vehicleId: v.id, term })),
    )
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx
        .insert(schema.vehicleSearchTerms)
        .values(rows.slice(i, i + CHUNK))
    }
    return rows.length
  })
}
