import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '#/db/schema'

// Supabase provides these in a real project; create them so the committed
// migrations (which reference auth.users + the anon role) apply unchanged.
const SUPABASE_SHIM = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role; exception when duplicate_object then null; end $$;
`

export interface TestDb {
  db: PgliteDatabase<typeof schema>
  client: PGlite
}

/** Fresh in-memory Postgres with the committed migrations applied. */
export async function freshDb(): Promise<TestDb> {
  const client = new PGlite()
  await client.exec(SUPABASE_SHIM)
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return { db, client }
}
