import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import { mirrorVehiclePortraits } from '#/catalog/mirror-portraits'
import { portraitObjectKey } from '#/catalog/portrait-key'
import { assertValidObjectKey } from '#/storage/urls'
import { nations, vehicles } from '#/db/schema'

const ABRAMS_URL = 'https://api.test/assets/us_m1_abrams.png'
const SHERMAN_URL = 'https://api.test/assets/us_m4_sherman.png'
const ABRAMS_V1 = '1111111111111111111111111111111111111111'
const ABRAMS_V2 = '2222222222222222222222222222222222222222'
const SHERMAN_V1 = '3333333333333333333333333333333333333333'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  const [nation] = await t.db
    .insert(nations)
    .values({ slug: 'usa', name: 'USA', sort: 1 })
    .returning({ id: nations.id })
  await t.db.insert(vehicles).values([
    {
      externalId: 'us_m1_abrams',
      name: 'M1 Abrams',
      slug: 'm1-abrams',
      nationId: nation.id,
      branch: 'ground',
      class: 'medium',
      portraitUrl: ABRAMS_URL,
      portraitContentId: ABRAMS_V1,
    },
    {
      externalId: 'us_m4_sherman',
      name: 'M4 Sherman',
      slug: 'm4-sherman',
      nationId: nation.id,
      branch: 'ground',
      class: 'medium',
      portraitUrl: SHERMAN_URL,
      portraitContentId: SHERMAN_V1,
    },
    {
      externalId: 'us_no_portrait',
      name: 'No Portrait',
      slug: 'no-portrait',
      nationId: nation.id,
      branch: 'ground',
      class: 'medium',
      portraitUrl: null,
      portraitContentId: null,
    },
  ])
})
afterEach(async () => {
  await t.client.close()
})

function fakeStore() {
  const puts: Array<{ role: string; key: string; contentType: string }> = []
  const deletes: Array<{ role: string; key: string }> = []
  return {
    puts,
    deletes,
    async put(
      role: 'assets',
      key: string,
      _body: Uint8Array,
      contentType: string,
    ) {
      assertValidObjectKey(key)
      puts.push({ role, key, contentType })
    },
    async delete(role: 'assets', key: string) {
      assertValidObjectKey(key)
      deletes.push({ role, key })
    },
  }
}

function fakeFetch(
  byUrl: Record<string, { status?: number; type?: string }> = {},
) {
  const calls: Array<string> = []
  const impl = async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    const spec = byUrl[url] ?? {}
    return new Response(new Uint8Array([1, 2, 3]), {
      status: spec.status ?? 200,
      headers: { 'content-type': spec.type ?? 'image/png' },
    })
  }
  return { calls, impl }
}

async function mirroredRows(db: TestDb['db']) {
  return db
    .select({
      externalId: vehicles.externalId,
      portraitKey: vehicles.portraitKey,
    })
    .from(vehicles)
    .where(isNotNull(vehicles.portraitKey))
    .orderBy(asc(vehicles.externalId))
}

describe('mirrorVehiclePortraits', () => {
  it('mirrors vehicles with portraits into the assets store and records the key', async () => {
    const store = fakeStore()
    const { calls, impl } = fakeFetch()

    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: impl,
    })

    expect(summary).toMatchObject({ mirrored: 2, upToDate: 0, failed: 0 })
    expect(calls).toHaveLength(2)
    expect(store.puts.map((p) => p.role)).toEqual(['assets', 'assets'])
    expect(store.puts.map((p) => p.contentType)).toEqual([
      'image/png',
      'image/png',
    ])

    const rows = await mirroredRows(t.db)
    expect(rows).toEqual([
      {
        externalId: 'us_m1_abrams',
        portraitKey: portraitObjectKey('us_m1_abrams', ABRAMS_V1, ABRAMS_URL),
      },
      {
        externalId: 'us_m4_sherman',
        portraitKey: portraitObjectKey(
          'us_m4_sherman',
          SHERMAN_V1,
          SHERMAN_URL,
        ),
      },
    ])
  })

  it('is idempotent: a second run fetches and uploads nothing', async () => {
    const store = fakeStore()
    await mirrorVehiclePortraits(t.db, store, { fetchImpl: fakeFetch().impl })

    const second = fakeFetch()
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: second.impl,
    })

    expect(summary).toMatchObject({ mirrored: 0, upToDate: 2, failed: 0 })
    expect(second.calls).toHaveLength(0)
    expect(store.puts).toHaveLength(2)
  })

  // Portrait URLs are pinned to the run's revision, so every nightly sync
  // rewrites them. Keying on content is what stops that re-mirroring the world.
  it('does not re-mirror when only the source URL changed', async () => {
    const store = fakeStore()
    await mirrorVehiclePortraits(t.db, store, { fetchImpl: fakeFetch().impl })

    await t.db
      .update(vehicles)
      .set({ portraitUrl: 'https://api.test/assets/rev2/us_m1_abrams.png' })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const second = fakeFetch()
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: second.impl,
    })

    expect(summary).toMatchObject({ mirrored: 0, upToDate: 2 })
    expect(second.calls).toHaveLength(0)
    expect(store.deletes).toHaveLength(0)
  })

  it('re-mirrors under a new key when the artwork changed, and tidies the old object', async () => {
    const store = fakeStore()
    await mirrorVehiclePortraits(t.db, store, { fetchImpl: fakeFetch().impl })
    const oldKey = portraitObjectKey('us_m1_abrams', ABRAMS_V1, ABRAMS_URL)

    await t.db
      .update(vehicles)
      .set({ portraitContentId: ABRAMS_V2 })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch().impl,
    })

    expect(summary).toMatchObject({ mirrored: 1, upToDate: 1, failed: 0 })
    expect(store.deletes).toEqual([{ role: 'assets', key: oldKey }])
    // a new key, so no cache anywhere can still be serving the old artwork
    const newKey = portraitObjectKey('us_m1_abrams', ABRAMS_V2, ABRAMS_URL)
    expect(newKey).not.toBe(oldKey)
    expect(rowKey(await mirroredRows(t.db), 'us_m1_abrams')).toBe(newKey)
  })

  it('a failed download is a warning, not a run failure, and other portraits still mirror', async () => {
    const store = fakeStore()
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch({ [ABRAMS_URL]: { status: 500 } }).impl,
      maxAttempts: 1,
    })

    expect(summary).toMatchObject({ mirrored: 1, failed: 1 })
    expect(summary.warnings).toEqual([expect.stringContaining('us_m1_abrams')])
    const rows = await mirroredRows(t.db)
    expect(rows.map((r) => r.externalId)).toEqual(['us_m4_sherman'])
  })

  it('respects the backfill limit and reports the deferred remainder', async () => {
    const store = fakeStore()
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch().impl,
      limit: 1,
    })

    expect(summary).toMatchObject({ mirrored: 1, deferred: 1 })
    expect(store.puts).toHaveLength(1)
  })

  it('refuses to mirror non-raster content (SVG is active content)', async () => {
    const store = fakeStore()
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch({
        [ABRAMS_URL]: { type: 'image/svg+xml; charset=utf-8' },
      }).impl,
      maxAttempts: 1,
    })

    expect(summary).toMatchObject({ mirrored: 1, failed: 1 })
    expect(summary.warnings).toEqual([
      expect.stringContaining('unexpected content type "image/svg+xml"'),
    ])
    expect(store.puts.map((p) => p.contentType)).toEqual(['image/png'])
  })

  it('a malformed source URL fails that row only, without crashing the pass', async () => {
    await t.db
      .update(vehicles)
      .set({ portraitUrl: 'assets/relative.png' })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const store = fakeStore()

    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch().impl,
    })

    expect(summary).toMatchObject({ mirrored: 1, failed: 1 })
    expect(summary.warnings).toEqual([
      expect.stringContaining('unusable portrait for us_m1_abrams'),
    ])
    const rows = await mirroredRows(t.db)
    expect(rows.map((r) => r.externalId)).toEqual(['us_m4_sherman'])
  })

  it('a portrait with no content id fails that row only', async () => {
    await t.db
      .update(vehicles)
      .set({ portraitContentId: null })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const store = fakeStore()

    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch().impl,
    })

    expect(summary).toMatchObject({ mirrored: 1, failed: 1 })
    const rows = await mirroredRows(t.db)
    expect(rows.map((r) => r.externalId)).toEqual(['us_m4_sherman'])
  })

  // The registry does not lose imagery it already holds: a null url beside a
  // live key is a resting state, not an orphan to collect.
  it('keeps the mirrored copy when upstream stops publishing the portrait', async () => {
    const store = fakeStore()
    await mirrorVehiclePortraits(t.db, store, { fetchImpl: fakeFetch().impl })
    const keptKey = portraitObjectKey('us_m1_abrams', ABRAMS_V1, ABRAMS_URL)

    await t.db
      .update(vehicles)
      .set({ portraitUrl: null, portraitContentId: null })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: fakeFetch().impl,
    })

    expect(summary).toMatchObject({ mirrored: 0, upToDate: 1, failed: 0 })
    expect(store.deletes).toHaveLength(0)
    expect(rowKey(await mirroredRows(t.db), 'us_m1_abrams')).toBe(keptKey)
  })

  it('aborts the run after persistent consecutive failures', async () => {
    const nation = await t.db.select({ id: nations.id }).from(nations)
    await t.db.insert(vehicles).values(
      Array.from({ length: 30 }, (_, i) => ({
        externalId: `fail_${String(i).padStart(2, '0')}`,
        name: `Fail ${i}`,
        slug: `fail-${i}`,
        nationId: nation[0].id,
        branch: 'ground' as const,
        class: 'medium' as const,
        portraitUrl: `https://api.test/broken/${i}.png`,
        portraitContentId: String(i).padStart(40, '0'),
      })),
    )
    await t.db
      .update(vehicles)
      .set({ portraitUrl: null, portraitContentId: null })
      .where(inArray(vehicles.externalId, ['us_m1_abrams', 'us_m4_sherman']))
    const store = fakeStore()
    const { calls, impl } = fakeFetch(
      Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [
          `https://api.test/broken/${i}.png`,
          { status: 500 },
        ]),
      ),
    )

    const summary = await mirrorVehiclePortraits(t.db, store, {
      fetchImpl: impl,
      concurrency: 1,
      maxAttempts: 1,
    })

    expect(summary.failed).toBe(20)
    expect(calls).toHaveLength(20)
    expect(summary.warnings.at(-1)).toContain('consecutive failures')
    expect(store.puts).toHaveLength(0)
  })
})

function rowKey(
  rows: Array<{ externalId: string; portraitKey: string | null }>,
  externalId: string,
) {
  return rows.find((r) => r.externalId === externalId)?.portraitKey
}
