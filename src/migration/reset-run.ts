/* Truncates the dev/design fixture and re-seeds the canonical modes, so a
   following catalog:sync has branches to fill BRs for (docs/catalog-sync.md). */

import process from 'node:process'
import { isLocalDatabaseUrl, openCliDb } from '#/db/cli'
import * as schema from '#/db/schema'
import { CANONICAL_MODES } from '#/db/modes'
import { resetFixture } from '#/db/seed'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

if (!isLocalDatabaseUrl(url) && process.env.IMPORT_RESET_REMOTE !== '1') {
  throw new Error(
    'Refusing to reset a non-local database. Set IMPORT_RESET_REMOTE=1 to override.',
  )
}

const { db, close } = openCliDb(url)
try {
  await resetFixture(db)
  await db.insert(schema.modes).values([...CANONICAL_MODES])
  console.log(
    `Fixture truncated; ${CANONICAL_MODES.length} canonical modes seeded. ` +
      'Next: catalog:sync, then import:load.',
  )
} finally {
  await close()
}
