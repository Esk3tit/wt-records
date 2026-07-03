import process from 'node:process'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '#/db/schema'
import { seed } from '#/db/seed'

// Applies the deterministic dev fixture (src/db/seed.ts) to the DATABASE_URL
// target. For local dev bootstrap and staging/preview — never the real data.
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const sql = postgres(url, { prepare: false })
try {
  await seed(drizzle(sql, { schema }))
  console.log('Seeded.')
} finally {
  await sql.end()
}
