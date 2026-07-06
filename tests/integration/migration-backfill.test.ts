import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// Mirror the drizzle migrator: DO $$ blocks hold semicolons, so split on the
// breakpoint marker rather than statement-by-statement.
async function applyMigration(client: PGlite, file: string) {
  for (const stmt of read(`../../drizzle/${file}`).split(
    '--> statement-breakpoint',
  )) {
    await client.exec(stmt)
  }
}

// 0003 runs against populated databases (prod carries fixture/demo rows from
// before the patches table existed), so the backfill path needs data in place
// BEFORE the migration applies — freshDb() can't express that.
describe('0003_patches backfill on a populated database', () => {
  it('registers existing patch values and lands null-patch rows on 2.53', async () => {
    const client = new PGlite()
    await client.exec(read('../supabase-shim.sql'))
    for (const file of [
      '0000_init.sql',
      '0001_realtime_publication.sql',
      '0002_stats_views.sql',
    ]) {
      await applyMigration(client, file)
    }

    await client.exec(`
      insert into modes (mode, name, branch) values ('grb', 'GRB', 'ground');
      insert into nations (slug, name, sort) values ('usa', 'USA', 1);
      insert into vehicles (external_id, name, slug, nation_id, branch, class)
        values ('m4', 'M4', 'm4', 1, 'ground', 'medium'),
               ('m26', 'M26', 'm26', 1, 'ground', 'heavy');
      insert into players (slug, display_name) values ('ace', 'Ace');
      insert into records
        (vehicle_id, mode, player_id, ign_snapshot, kills, patch, status, is_current)
      values
        (1, 'grb', 1, 'Ace', 12, '2.49', 'verified', true),
        (1, 'grb', 1, 'Ace', 10, '2.53', 'verified', false),
        (2, 'grb', 1, 'Ace', 9, null, 'verified', true);
    `)

    await applyMigration(client, '0003_patches.sql')

    const patches = await client.query<{ version: string }>(
      'select version from patches order by version',
    )
    expect(patches.rows.map((r) => r.version)).toEqual(['2.49', '2.53'])

    const backfilled = await client.query<{ patch: string }>(
      'select patch from records where vehicle_id = 2',
    )
    expect(backfilled.rows[0].patch).toBe('2.53')

    await expect(
      client.query(
        `insert into records (vehicle_id, mode, player_id, ign_snapshot, kills, patch)
         values (2, 'grb', 1, 'Ace', 3, null)`,
      ),
    ).rejects.toThrow()

    await client.close()
  })
})
