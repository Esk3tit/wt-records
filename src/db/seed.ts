import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '#/db/schema'

type SeedDb = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

// Deterministic dev/design fixture — NOT the real data. The catalog-sync and
// GRB migration importer replace this later. Moderators (profiles) are omitted
// on purpose: they need real auth.users ids from Discord/Google sign-in.
export async function seed(db: SeedDb): Promise<void> {
  await db.insert(schema.modes).values([
    {
      mode: 'grb',
      name: 'Ground Realistic Battles',
      branch: 'ground',
      difficultMinKills: 5,
      isLive: true,
      sort: 1,
    },
    {
      mode: 'gab',
      name: 'Ground Arcade Battles',
      branch: 'ground',
      isLive: false,
      sort: 2,
    },
    {
      mode: 'arb',
      name: 'Air Realistic Battles',
      branch: 'air',
      isLive: false,
      sort: 3,
    },
    {
      mode: 'aab',
      name: 'Air Arcade Battles',
      branch: 'air',
      isLive: false,
      sort: 4,
    },
  ])

  await db.insert(schema.modeMinKills).values([
    { mode: 'grb', class: 'light', minKills: 8 },
    { mode: 'grb', class: 'medium', minKills: 10 },
    { mode: 'grb', class: 'heavy', minKills: 10 },
    { mode: 'grb', class: 'spg', minKills: 7 },
    { mode: 'grb', class: 'spaa', minKills: 6 },
  ])

  const [usa, germany] = await db
    .insert(schema.nations)
    .values([
      { slug: 'usa', name: 'USA', sort: 1 },
      { slug: 'germany', name: 'Germany', sort: 2 },
    ])
    .returning()

  const vehs = await db
    .insert(schema.vehicles)
    .values([
      {
        externalId: 'us_m4a1',
        name: 'M4A1',
        slug: 'm4a1',
        nationId: usa.id,
        branch: 'ground',
        class: 'medium',
        rank: 2,
      },
      {
        externalId: 'us_m26',
        name: 'M26',
        slug: 'm26',
        nationId: usa.id,
        branch: 'ground',
        class: 'heavy',
        rank: 3,
      },
      {
        externalId: 'us_m18',
        name: 'M18 GMC',
        slug: 'm18-gmc',
        nationId: usa.id,
        branch: 'ground',
        class: 'spg',
        rank: 2,
      },
      {
        externalId: 'us_m163',
        name: 'M163',
        slug: 'm163',
        nationId: usa.id,
        branch: 'ground',
        class: 'spaa',
        rank: 5,
      },
      {
        externalId: 'ger_tiger2h',
        name: 'Tiger II (H)',
        slug: 'tiger-ii-h',
        nationId: germany.id,
        branch: 'ground',
        class: 'heavy',
        rank: 4,
        isDifficult: true,
      },
      {
        externalId: 'ger_panther',
        name: 'Panther D',
        slug: 'panther-d',
        nationId: germany.id,
        branch: 'ground',
        class: 'medium',
        rank: 3,
      },
      {
        externalId: 'ger_wirbel',
        name: 'Wirbelwind',
        slug: 'wirbelwind',
        nationId: germany.id,
        branch: 'ground',
        class: 'spaa',
        rank: 3,
      },
    ])
    .returning()

  const byExt: Record<string, (typeof vehs)[number]> = {}
  for (const v of vehs) byExt[v.externalId] = v

  await db.insert(schema.vehicleBr).values([
    { vehicleId: byExt['us_m4a1'].id, mode: 'grb', br: 3.7 },
    { vehicleId: byExt['us_m26'].id, mode: 'grb', br: 6.7 },
    { vehicleId: byExt['us_m18'].id, mode: 'grb', br: 4.0 },
    { vehicleId: byExt['us_m163'].id, mode: 'grb', br: 8.7 },
    { vehicleId: byExt['ger_tiger2h'].id, mode: 'grb', br: 6.7 },
    { vehicleId: byExt['ger_panther'].id, mode: 'grb', br: 5.7 },
    { vehicleId: byExt['ger_wirbel'].id, mode: 'grb', br: 3.0 },
  ])

  const [ace, maverick, floppa] = await db
    .insert(schema.players)
    .values([
      { slug: 'ace', displayName: 'Ace' },
      { slug: 'maverick', displayName: 'Maverick' },
      { slug: 'floppa', displayName: 'Floppa' },
    ])
    .returning()

  await db.insert(schema.playerAliases).values([
    { playerId: ace.id, name: 'Ace', kind: 'ign', source: 'migration' },
    {
      playerId: maverick.id,
      name: 'Maverick',
      kind: 'ign',
      source: 'migration',
    },
    { playerId: floppa.id, name: 'Floppa', kind: 'ign', source: 'migration' },
  ])

  // M4A1: Maverick held 12 (history), Ace superseded it with 14 (current).
  await db.insert(schema.records).values({
    vehicleId: byExt['us_m4a1'].id,
    mode: 'grb',
    playerId: maverick.id,
    ignSnapshot: 'Maverick',
    displayNameSnapshot: 'Maverick',
    kills: 12,
    runBr: 3.7,
    patch: '2.51',
    status: 'verified',
    isCurrent: false,
    importedFrom: 'sheet',
  })
  const [m4Current] = await db
    .insert(schema.records)
    .values({
      vehicleId: byExt['us_m4a1'].id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      displayNameSnapshot: 'Ace',
      kills: 14,
      runBr: 3.7,
      patch: '2.53',
      status: 'verified',
      isCurrent: true,
      importedFrom: 'sheet',
    })
    .returning()

  await db.insert(schema.records).values([
    {
      vehicleId: byExt['us_m26'].id,
      mode: 'grb',
      playerId: maverick.id,
      ignSnapshot: 'Maverick',
      displayNameSnapshot: 'Maverick',
      kills: 11,
      runBr: 6.7,
      patch: '2.53',
      status: 'verified',
      isCurrent: true,
      importedFrom: 'sheet',
    },
    {
      vehicleId: byExt['ger_tiger2h'].id,
      mode: 'grb',
      playerId: floppa.id,
      ignSnapshot: 'Floppa',
      displayNameSnapshot: 'Floppa',
      kills: 8,
      runBr: 6.7,
      patch: '2.53',
      status: 'verified',
      isCurrent: true,
      importedFrom: 'sheet',
    },
    {
      vehicleId: byExt['ger_panther'].id,
      mode: 'grb',
      playerId: ace.id,
      ignSnapshot: 'Ace',
      displayNameSnapshot: 'Ace',
      kills: 9,
      runBr: 5.7,
      patch: '2.52',
      status: 'verified',
      isCurrent: true,
      importedFrom: 'sheet',
    },
  ])
  // M18 GMC, M163, and Wirbelwind are left unclaimed (open bounties).

  await db.insert(schema.recordProof).values([
    {
      recordId: m4Current.id,
      kind: 'scoreboard',
      originalUrl: 'https://i.imgur.com/example1.png',
      sort: 0,
    },
    {
      recordId: m4Current.id,
      kind: 'video',
      originalUrl: 'https://youtu.be/example',
      sort: 1,
    },
  ])
}
