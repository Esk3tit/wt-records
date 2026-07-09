import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import { mirrorVehicleImages } from '#/catalog/mirror-images'
import { vehicleImageKey } from '#/catalog/image-key'
import { assertValidObjectKey } from '#/storage/urls'
import { nations, vehicles } from '#/db/schema'

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
      imageUrl: 'https://api.test/assets/us_m1_abrams.png',
    },
    {
      externalId: 'us_m4_sherman',
      name: 'M4 Sherman',
      slug: 'm4-sherman',
      nationId: nation.id,
      branch: 'ground',
      class: 'medium',
      imageUrl: 'https://api.test/assets/us_m4_sherman.png',
    },
    {
      externalId: 'us_no_image',
      name: 'No Image',
      slug: 'no-image',
      nationId: nation.id,
      branch: 'ground',
      class: 'medium',
      imageUrl: null,
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
      imageKey: vehicles.imageKey,
    })
    .from(vehicles)
    .where(isNotNull(vehicles.imageKey))
    .orderBy(asc(vehicles.externalId))
}

describe('mirrorVehicleImages', () => {
  it('mirrors vehicles with images into the assets store and records the key', async () => {
    const store = fakeStore()
    const { calls, impl } = fakeFetch()

    const summary = await mirrorVehicleImages(t.db, store, { fetchImpl: impl })

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
        imageKey: vehicleImageKey(
          'us_m1_abrams',
          'https://api.test/assets/us_m1_abrams.png',
        ),
      },
      {
        externalId: 'us_m4_sherman',
        imageKey: vehicleImageKey(
          'us_m4_sherman',
          'https://api.test/assets/us_m4_sherman.png',
        ),
      },
    ])
  })

  it('is idempotent: a second run fetches and uploads nothing', async () => {
    const store = fakeStore()
    await mirrorVehicleImages(t.db, store, { fetchImpl: fakeFetch().impl })

    const second = fakeFetch()
    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: second.impl,
    })

    expect(summary).toMatchObject({ mirrored: 0, upToDate: 2, failed: 0 })
    expect(second.calls).toHaveLength(0)
    expect(store.puts).toHaveLength(2)
  })

  it('re-mirrors when the source URL changes and tidies the old object', async () => {
    const store = fakeStore()
    await mirrorVehicleImages(t.db, store, { fetchImpl: fakeFetch().impl })
    const oldKey = vehicleImageKey(
      'us_m1_abrams',
      'https://api.test/assets/us_m1_abrams.png',
    )

    await t.db
      .update(vehicles)
      .set({ imageUrl: 'https://api.test/assets/v2/us_m1_abrams.webp' })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: fakeFetch({
        'https://api.test/assets/v2/us_m1_abrams.webp': { type: 'image/webp' },
      }).impl,
    })

    expect(summary).toMatchObject({ mirrored: 1, upToDate: 1, failed: 0 })
    expect(store.deletes).toEqual([{ role: 'assets', key: oldKey }])
    const rows = await mirroredRows(t.db)
    expect(rows.find((r) => r.externalId === 'us_m1_abrams')?.imageKey).toBe(
      vehicleImageKey(
        'us_m1_abrams',
        'https://api.test/assets/v2/us_m1_abrams.webp',
      ),
    )
  })

  it('a failed download is a warning, not a run failure, and other images still mirror', async () => {
    const store = fakeStore()
    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: fakeFetch({
        'https://api.test/assets/us_m1_abrams.png': { status: 500 },
      }).impl,
      maxAttempts: 1,
    })

    expect(summary).toMatchObject({ mirrored: 1, failed: 1 })
    expect(summary.warnings).toEqual([expect.stringContaining('us_m1_abrams')])
    const rows = await mirroredRows(t.db)
    expect(rows.map((r) => r.externalId)).toEqual(['us_m4_sherman'])
  })

  it('respects the backfill limit and reports the deferred remainder', async () => {
    const store = fakeStore()
    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: fakeFetch().impl,
      limit: 1,
    })

    expect(summary).toMatchObject({ mirrored: 1, deferred: 1 })
    expect(store.puts).toHaveLength(1)
  })

  it('refuses to mirror non-raster content (SVG is active content)', async () => {
    const store = fakeStore()
    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: fakeFetch({
        'https://api.test/assets/us_m1_abrams.png': {
          type: 'image/svg+xml; charset=utf-8',
        },
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
      .set({ imageUrl: 'assets/relative.png' })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const store = fakeStore()

    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: fakeFetch().impl,
    })

    expect(summary).toMatchObject({ mirrored: 1, failed: 1 })
    expect(summary.warnings).toEqual([
      expect.stringContaining('unusable image URL for us_m1_abrams'),
    ])
    const rows = await mirroredRows(t.db)
    expect(rows.map((r) => r.externalId)).toEqual(['us_m4_sherman'])
  })

  it('clears the mirror when the upstream image goes away', async () => {
    const store = fakeStore()
    await mirrorVehicleImages(t.db, store, { fetchImpl: fakeFetch().impl })
    const oldKey = vehicleImageKey(
      'us_m1_abrams',
      'https://api.test/assets/us_m1_abrams.png',
    )

    await t.db
      .update(vehicles)
      .set({ imageUrl: null })
      .where(eq(vehicles.externalId, 'us_m1_abrams'))
    const summary = await mirrorVehicleImages(t.db, store, {
      fetchImpl: fakeFetch().impl,
    })

    expect(summary).toMatchObject({ mirrored: 0, upToDate: 1, cleaned: 1 })
    expect(store.deletes).toEqual([{ role: 'assets', key: oldKey }])
    const rows = await mirroredRows(t.db)
    expect(rows.map((r) => r.externalId)).toEqual(['us_m4_sherman'])
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
        imageUrl: `https://api.test/broken/${i}.png`,
      })),
    )
    await t.db
      .update(vehicles)
      .set({ imageUrl: null })
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

    const summary = await mirrorVehicleImages(t.db, store, {
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
