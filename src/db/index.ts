import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '#/db/schema'

// This client holds the RLS-bypassing service-role connection; it must never
// reach the browser bundle. Fail loudly if it is ever imported client-side.
if (typeof window !== 'undefined') {
  throw new Error('#/db must not be imported in the browser')
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// prepare:false is mandatory for Supabase's transaction-mode pooler (Supavisor
// reuses connections across statements, so prepared statements break). The URL
// carries the service-role / direct role, so these SSR reads bypass RLS.
const globalForDb = globalThis as typeof globalThis & {
  __wtRecordsPg?: ReturnType<typeof postgres>
}
const client = globalForDb.__wtRecordsPg ?? postgres(url, { prepare: false })
if (import.meta.env.DEV) globalForDb.__wtRecordsPg = client

export const db = drizzle(client, { schema })
export { schema }

export type Db = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>
