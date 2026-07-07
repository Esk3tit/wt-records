import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { drizzle } from 'drizzle-orm/pglite'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '#/db/schema'

// Supabase-provided objects the committed migrations reference; the CI migration
// check applies the same file, so this is the one source of truth.
const SUPABASE_SHIM = readFileSync(
  fileURLToPath(new URL('../supabase-shim.sql', import.meta.url)),
  'utf8',
)

export interface TestDb {
  db: PgliteDatabase<typeof schema>
  client: PGlite
}

/** Fresh in-memory Postgres with the committed migrations applied. */
export async function freshDb(): Promise<TestDb> {
  const client = new PGlite({ extensions: { pg_trgm } })
  await client.exec(SUPABASE_SHIM)
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return { db, client }
}
