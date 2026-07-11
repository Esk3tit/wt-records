import process from 'node:process'
import { isLocalDatabaseUrl, openCliDb } from '#/db/cli'
import { resetFixture, seed } from '#/db/seed'
import { seedDemo } from '#/db/seed-demo'

// Applies the deterministic dev fixture (src/db/seed.ts) to the DATABASE_URL
// target. For local dev bootstrap and staging/preview — never the real data.
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// The fixture is FAKE data — refuse to seed a non-local database unless the
// caller opts in, so a stray DATABASE_URL can't overwrite staging/production.
if (!isLocalDatabaseUrl(url) && process.env.SEED_REMOTE !== '1') {
  throw new Error(
    'Refusing to seed a non-local database. Set SEED_REMOTE=1 to override.',
  )
}

const { db, close } = openCliDb(url)
try {
  // Opt-in wipe: the seed is not idempotent, so re-seeding a populated DB
  // needs the fixture tables cleared. Cascades cover every dependent table.
  if (process.env.SEED_RESET === '1') {
    await resetFixture(db)
    console.log('Fixture tables truncated.')
  }
  await seed(db)
  await seedDemo(db)
  console.log('Seeded (fixture + demo dressing).')
} finally {
  await close()
}
