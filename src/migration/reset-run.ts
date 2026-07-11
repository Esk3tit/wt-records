/* Step 1 of the production rollout (docs/catalog-sync.md): truncate the
   dev/design fixture, then re-seed the canonical modes so the following
   catalog:sync has branches to fill BRs for. */

import process from 'node:process'
import { openCliDb } from '#/db/cli'
import * as schema from '#/db/schema'
import { resetFixture } from '#/db/seed'
import { CANONICAL_MODES } from '#/migration/rules'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)
if (!isLocal && process.env.IMPORT_RESET_REMOTE !== '1') {
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
