import { expect, test } from '@playwright/test'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

/* The watchdog is a curl + jq script, so the contract that matters is the HTTP
   one — and it must hold whatever sync history the database happens to have. */
test('catalog sync status answers the watchdog probe', async ({ request }) => {
  const res = await request.get('/status/catalog-sync')

  expect(res.status()).toBe(200)
  expect(res.headers()['cache-control']).toContain('no-store')

  const body = (await res.json()) as {
    db: string
    lastSuccessAt: string | null
    ageSeconds: number | null
    lastRun: { finishedAt: string; ok: boolean; detail: string | null } | null
  }
  expect(Object.keys(body).sort()).toEqual([
    'ageSeconds',
    'db',
    'lastRun',
    'lastSuccessAt',
  ])
  expect(body.db).toBe('ok')

  if (body.lastSuccessAt === null) {
    expect(body.ageSeconds).toBeNull()
  } else {
    expect(Date.parse(body.lastSuccessAt)).not.toBeNaN()
    expect(body.ageSeconds).toBeGreaterThanOrEqual(0)
  }
  if (body.lastRun !== null) {
    expect(Date.parse(body.lastRun.finishedAt)).not.toBeNaN()
    expect(typeof body.lastRun.ok).toBe('boolean')
  }
})
