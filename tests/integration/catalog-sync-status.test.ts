import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TestDb } from './pglite'
import { freshDb } from './pglite'
import {
  readCatalogSyncStatus,
  recordCatalogSyncRun,
} from '#/catalog/sync-status'
import { catalogSyncRuns } from '#/db/schema'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
})
afterEach(async () => {
  await t.client.close()
})

const at = (iso: string) => new Date(iso)

describe('readCatalogSyncStatus', () => {
  it('reports a catalog that has never synced', async () => {
    const status = await readCatalogSyncStatus(t.db, at('2026-07-25T08:00:00Z'))

    expect(status).toEqual({
      lastSuccessAt: null,
      ageSeconds: null,
      lastRun: null,
    })
  })

  it('ages the last success, not the last attempt', async () => {
    await recordCatalogSyncRun(t.db, {
      ok: true,
      detail: 'Patch 2.57: 3 inserted',
      finishedAt: at('2026-07-24T06:00:00Z'),
    })
    await recordCatalogSyncRun(t.db, {
      ok: false,
      detail: 'GET https://wt.example/vehicles → 500',
      finishedAt: at('2026-07-25T06:00:00Z'),
    })

    const status = await readCatalogSyncStatus(t.db, at('2026-07-25T08:00:00Z'))

    expect(status.lastSuccessAt).toEqual(at('2026-07-24T06:00:00Z'))
    expect(status.ageSeconds).toBe(26 * 3600)
    expect(status.lastRun).toEqual({
      finishedAt: at('2026-07-25T06:00:00Z'),
      ok: false,
      detail: 'GET https://wt.example/vehicles → 500',
    })
  })

  it('surfaces the latest run when the newest attempt succeeded', async () => {
    await recordCatalogSyncRun(t.db, {
      ok: false,
      detail: 'boom',
      finishedAt: at('2026-07-25T06:00:00Z'),
    })
    await recordCatalogSyncRun(t.db, {
      ok: true,
      detail: 'Patch 2.57: 0 inserted',
      finishedAt: at('2026-07-26T06:00:00Z'),
    })

    const status = await readCatalogSyncStatus(t.db, at('2026-07-26T06:30:00Z'))

    expect(status.lastSuccessAt).toEqual(at('2026-07-26T06:00:00Z'))
    expect(status.ageSeconds).toBe(1800)
    expect(status.lastRun?.ok).toBe(true)
  })
})

describe('recordCatalogSyncRun', () => {
  it('defaults finishedAt to now and keeps every attempt', async () => {
    const before = Date.now()
    await recordCatalogSyncRun(t.db, { ok: true, detail: 'first' })
    await recordCatalogSyncRun(t.db, { ok: false, detail: 'second' })

    const rows = await t.db.select().from(catalogSyncRuns)
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.finishedAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
    }
  })

  it('truncates a runaway failure body so the row stays triage-sized', async () => {
    await recordCatalogSyncRun(t.db, { ok: false, detail: 'x'.repeat(5000) })

    const status = await readCatalogSyncStatus(t.db)
    expect(status.lastRun?.detail).toHaveLength(500)
  })

  it('accepts a run with no detail at all', async () => {
    await recordCatalogSyncRun(t.db, { ok: true })

    const status = await readCatalogSyncStatus(t.db)
    expect(status.lastRun).toMatchObject({ ok: true, detail: null })
  })
})
