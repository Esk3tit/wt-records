import { eq } from 'drizzle-orm'
import * as schema from '#/db/schema'
import type { SeedDb } from '#/db/seed'

const DAY_MS = 86_400_000

const verified = (daysAgo: number) => ({
  status: 'verified' as const,
  submittedAt: new Date(Date.now() - daysAgo * DAY_MS - 3 * 3_600_000),
  verifiedAt: new Date(Date.now() - daysAgo * DAY_MS),
})

// Rough patch eras so demo records don't all claim the current version.
const PATCH_ERAS: Array<[minDaysAgo: number, version: string]> = [
  [1200, '2.29'],
  [800, '2.33'],
  [400, '2.37'],
  [250, '2.41'],
  [180, '2.45'],
  [100, '2.49'],
  [40, '2.51'],
  [0, '2.53'],
]
const patchFor = (daysAgo: number): string =>
  PATCH_ERAS.find(([min]) => daysAgo >= min)![1]

// Demo dressing on top of the canonical fixture (src/db/seed.ts): enough
// records, nations, and recency for every landing band to demonstrate itself
// — week carousel drifting, podium full, dethronements, a deep history chain.
// Dev/staging only; integration tests seed the canonical fixture alone.
export async function seedDemo(db: SeedDb): Promise<void> {
  const usaRows = await db
    .select()
    .from(schema.nations)
    .where(eq(schema.nations.slug, 'usa'))
  const germanyRows = await db
    .select()
    .from(schema.nations)
    .where(eq(schema.nations.slug, 'germany'))
  if (usaRows.length === 0 || germanyRows.length === 0)
    throw new Error(
      'seedDemo requires seed() to have run first (missing usa/germany nations)',
    )
  const [usa] = usaRows
  const [germany] = germanyRows

  const [ussr, britain, france, sweden, japan] = await db
    .insert(schema.nations)
    .values([
      { slug: 'ussr', name: 'USSR', sort: 3 },
      { slug: 'britain', name: 'Britain', sort: 4 },
      { slug: 'france', name: 'France', sort: 5 },
      { slug: 'sweden', name: 'Sweden', sort: 6 },
      { slug: 'japan', name: 'Japan', sort: 7 },
    ])
    .returning()

  const vehicleRows = await db
    .insert(schema.vehicles)
    .values([
      // prettier-ignore
      { externalId: 'ussr_obj279', name: 'Object 279', slug: 'object-279', nationId: ussr.id, branch: 'ground' as const, class: 'heavy' as const, rank: 5, isDifficult: true },
      // prettier-ignore
      { externalId: 'ussr_t80bvm', name: 'T-80BVM', slug: 't-80bvm', nationId: ussr.id, branch: 'ground' as const, class: 'medium' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'ussr_is7', name: 'IS-7', slug: 'is-7', nationId: ussr.id, branch: 'ground' as const, class: 'heavy' as const, rank: 5, isDifficult: true },
      // prettier-ignore
      { externalId: 'ussr_t34_100', name: 'T-34-100', slug: 't-34-100', nationId: ussr.id, branch: 'ground' as const, class: 'medium' as const, rank: 4, isRemoved: true },
      // prettier-ignore
      { externalId: 'ussr_2s38', name: '2S38', slug: '2s38', nationId: ussr.id, branch: 'ground' as const, class: 'light' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'ussr_obj120', name: 'Object 120', slug: 'object-120', nationId: ussr.id, branch: 'ground' as const, class: 'spg' as const, rank: 6 },
      // prettier-ignore
      { externalId: 'ussr_bmp2m', name: 'BMP-2M', slug: 'bmp-2m', nationId: ussr.id, branch: 'ground' as const, class: 'light' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'gb_chall2e', name: 'Challenger 2E', slug: 'challenger-2e', nationId: britain.id, branch: 'ground' as const, class: 'medium' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'gb_cent3', name: 'Centurion Mk 3', slug: 'centurion-mk-3', nationId: britain.id, branch: 'ground' as const, class: 'medium' as const, rank: 5 },
      // prettier-ignore
      { externalId: 'ger_leo2a7v', name: 'Leopard 2A7V', slug: 'leopard-2a7v', nationId: germany.id, branch: 'ground' as const, class: 'medium' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'ger_maus', name: 'Maus', slug: 'maus', nationId: germany.id, branch: 'ground' as const, class: 'heavy' as const, rank: 5, isDifficult: true, isRemoved: true },
      // prettier-ignore
      { externalId: 'us_m1a2sep2', name: 'M1A2 SEP v2', slug: 'm1a2-sep-v2', nationId: usa.id, branch: 'ground' as const, class: 'medium' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'fr_amx40', name: 'AMX-40', slug: 'amx-40', nationId: france.id, branch: 'ground' as const, class: 'medium' as const, rank: 6 },
      // prettier-ignore
      { externalId: 'fr_amx13', name: 'AMX-13', slug: 'amx-13', nationId: france.id, branch: 'ground' as const, class: 'light' as const, rank: 4 },
      // prettier-ignore
      { externalId: 'se_strv122b', name: 'Strv 122B PLSS', slug: 'strv-122b-plss', nationId: sweden.id, branch: 'ground' as const, class: 'medium' as const, rank: 8 },
      // prettier-ignore
      { externalId: 'se_strv103', name: 'Strv 103-0', slug: 'strv-103-0', nationId: sweden.id, branch: 'ground' as const, class: 'medium' as const, rank: 6 },
      // prettier-ignore
      { externalId: 'jp_type90b', name: 'Type 90 (B)', slug: 'type-90-b', nationId: japan.id, branch: 'ground' as const, class: 'medium' as const, rank: 7 },
      // prettier-ignore
      { externalId: 'jp_type74', name: 'Type 74', slug: 'type-74', nationId: japan.id, branch: 'ground' as const, class: 'medium' as const, rank: 6 },
    ])
    .returning()
  const veh: Record<string, (typeof vehicleRows)[number]> = {}
  for (const v of vehicleRows) veh[v.slug] = v

  await db.insert(schema.vehicleBr).values(
    (
      [
        ['object-279', 9.0],
        ['t-80bvm', 11.3],
        ['is-7', 9.3],
        ['t-34-100', 6.0],
        ['2s38', 10.0],
        ['object-120', 8.3],
        ['bmp-2m', 10.0],
        ['challenger-2e', 11.3],
        ['centurion-mk-3', 7.3],
        ['leopard-2a7v', 12.0],
        ['maus', 7.7],
        ['m1a2-sep-v2', 11.7],
        ['amx-40', 8.0],
        ['amx-13', 6.7],
        ['strv-122b-plss', 11.7],
        ['strv-103-0', 8.7],
        ['type-90-b', 11.0],
        ['type-74', 9.3],
      ] as const
    ).map(([slug, br]) => ({ vehicleId: veh[slug].id, mode: 'grb', br })),
  )

  const playerRows = await db
    .insert(schema.players)
    .values(
      [
        'KurskPhantom',
        'SteelHunter',
        'NightWitch',
        'RedBaron_WT',
        'BlitzkriegAce',
        'PanzerLehr',
        'VolgaVerdict',
        'AbramsPrime',
        'GallicRooster',
        'NorrlandWolf',
        'FujiLancer',
        'UralEcho',
        'TaranDriver',
      ].map((displayName) => ({
        slug: displayName.toLowerCase().replace(/_/g, '-'),
        displayName,
      })),
    )
    .returning()
  const who: Record<string, (typeof playerRows)[number]> = {}
  for (const p of playerRows) who[p.displayName] = p

  await db.insert(schema.playerAliases).values(
    playerRows.map((p) => ({
      playerId: p.id,
      name: p.displayName,
      kind: 'ign' as const,
      source: 'migration' as const,
    })),
  )

  // Demo-only patch eras; the fixture (seed.ts) owns 2.49–2.53.
  await db
    .insert(schema.patches)
    .values(PATCH_ERAS.map(([, version]) => ({ version })))
    .onConflictDoNothing()

  type Rec = typeof schema.records.$inferInsert
  const rec = (
    vehicleSlug: string,
    player: string,
    kills: number,
    daysAgo: number,
    extra: Partial<Rec> = {},
  ): Rec => ({
    vehicleId: veh[vehicleSlug].id,
    mode: 'grb',
    playerId: who[player].id,
    ignSnapshot: player,
    displayNameSnapshot: player,
    kills,
    patch: patchFor(daysAgo),
    isCurrent: true,
    importedFrom: 'sheet',
    ...verified(daysAgo),
    ...extra,
  })

  await db.insert(schema.records).values([
    // Object 279 — the monument, with a deep progression behind it.
    rec('object-279', 'UralEcho', 18, 440, { isCurrent: false }),
    rec('object-279', 'SteelHunter', 24, 300, { isCurrent: false }),
    rec('object-279', 'KurskPhantom', 27, 210, { isCurrent: false }),
    rec('object-279', 'NightWitch', 35, 150, { isCurrent: false }),
    rec('object-279', 'KurskPhantom', 42, 0.3),

    // The chasers.
    rec('t-80bvm', 'SteelHunter', 37, 90),
    rec('challenger-2e', 'NightWitch', 34, 120),
    rec('maus', 'RedBaron_WT', 31, 1289, { ignSnapshot: 'BaronVonRed' }),
    rec('is-7', 'BlitzkriegAce', 29, 864),
    rec('object-120', 'TaranDriver', 12, 412),

    // This week's records (fractions of a day keep them inside any week).
    rec('t-34-100', 'VolgaVerdict', 21, 200, { isCurrent: false }),
    rec('t-34-100', 'KurskPhantom', 24, 0.5),
    rec('2s38', 'NightWitch', 26, 45, { isCurrent: false }),
    rec('2s38', 'VolgaVerdict', 28, 0.6),
    rec('leopard-2a7v', 'GallicRooster', 17, 30, { isCurrent: false }),
    rec('leopard-2a7v', 'PanzerLehr', 19, 0.4),
    rec('strv-122b-plss', 'NorrlandWolf', 21, 0.7),
    rec('m1a2-sep-v2', 'AbramsPrime', 18, 0.8),
    rec('amx-40', 'GallicRooster', 17, 0.85),
    rec('type-90-b', 'FujiLancer', 16, 0.9),

    // The moderation queue.
    rec('bmp-2m', 'NightWitch', 23, 0, {
      status: 'pending',
      isCurrent: false,
      verifiedAt: null,
      submittedAt: new Date(Date.now() - 5 * 3_600_000),
    }),
    rec('centurion-mk-3', 'BlitzkriegAce', 12, 0, {
      status: 'pending',
      isCurrent: false,
      verifiedAt: null,
      submittedAt: new Date(Date.now() - 26 * 3_600_000),
    }),
    rec('m1a2-sep-v2', 'AbramsPrime', 20, 0, {
      status: 'pending',
      isCurrent: false,
      verifiedAt: null,
      submittedAt: new Date(Date.now() - 11 * 3_600_000),
    }),
  ])
}
