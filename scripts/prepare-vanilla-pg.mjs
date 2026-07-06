// Applies the Supabase-provided objects (auth schema/roles) and the Realtime
// publication to a bare Postgres, mirroring migration-check.yml's psql steps,
// so drizzle migrations replay unchanged. Run before `bun run db:migrate`.
import { resolve } from 'node:path'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
  onnotice: () => {},
})

try {
  await sql.file(resolve(import.meta.dirname, '..', 'tests/supabase-shim.sql'))

  const [pub] =
    await sql`select 1 as ok from pg_publication where pubname = 'supabase_realtime'`
  if (!pub) await sql`create publication supabase_realtime`

  console.log('shim + publication applied')
} finally {
  await sql.end()
}
