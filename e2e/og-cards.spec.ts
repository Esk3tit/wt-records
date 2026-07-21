import { expect, test } from '@playwright/test'
import type { APIResponse, Page } from '@playwright/test'
import { STATE } from './support/states'

test.use({ storageState: STATE.anon })

// Cards must be served from the canonical origin, never the request host — the
// build bakes the default unless VITE_CANONICAL_ORIGIN overrides it.
const CANONICAL_ORIGIN =
  process.env.VITE_CANONICAL_ORIGIN?.replace(/\/+$/, '') ||
  'https://wtrecords.gg'

/* The primary share-card seam: the HTTP surface a scraper actually sees. Each
   dynamic page must emit the full meta contract with a versioned ABSOLUTE image
   URL (built from the canonical origin, not the request host), and that image
   route must serve a real 1200×630 PNG. Fixtures come from live seed data, so
   these hold against a real corpus. */

async function meta(page: Page, key: string): Promise<string | null> {
  const byProperty = page.locator(`meta[property="${key}"]`)
  if (await byProperty.count())
    return byProperty.first().getAttribute('content')
  return page.locator(`meta[name="${key}"]`).first().getAttribute('content')
}

function pngDimensions(body: Buffer) {
  return {
    signature: body.subarray(0, 8).toString('hex'),
    width: body.readUInt32BE(16),
    height: body.readUInt32BE(20),
  }
}

async function expectCardImage(res: APIResponse) {
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
  const dims = pngDimensions(await res.body())
  expect(dims.signature).toBe('89504e470d0a1a0a')
  expect(dims.width).toBe(1200)
  expect(dims.height).toBe(630)
}

/** Assert the full meta contract, then fetch the card image the page points at.
    The og:image is absolute (canonical origin); we fetch its path against the
    test server to prove the route serves the bytes. */
async function assertPageCard(page: Page) {
  const image = await meta(page, 'og:image')
  expect(image, 'og:image is present').toBeTruthy()
  expect(new URL(image!).origin).toBe(CANONICAL_ORIGIN)

  expect(await meta(page, 'og:title')).toBeTruthy()
  expect(await meta(page, 'og:description')).toBeTruthy()
  expect(await meta(page, 'og:image:width')).toBe('1200')
  expect(await meta(page, 'og:image:height')).toBe('630')
  expect(await meta(page, 'twitter:card')).toBe('summary_large_image')
  expect(await meta(page, 'theme-color')).toBe('#F0B94A')

  const url = new URL(image!)
  await expectCardImage(await page.request.get(`${url.pathname}${url.search}`))
  return image!
}

/** The href of the first link to `pattern` on a listing page — the fixture we
    then visit DIRECTLY, so the test reads the server-rendered head a scraper
    sees (not the client-updated head after an in-app click). */
async function firstLinkTo(page: Page, listing: string, pattern: string) {
  await page.goto(listing)
  const href = await page
    .locator(`a[href*="${pattern}"]`)
    .first()
    .getAttribute('href')
  expect(href, `no ${pattern} link on ${listing}`).toBeTruthy()
  return href!
}

test('a vehicle page emits a versioned card and serves the PNG', async ({
  page,
}) => {
  await page.goto(await firstLinkTo(page, '/grb/vehicles', '/grb/vehicle/'))
  await expect(page).toHaveURL(/\/grb\/vehicle\//)

  const image = await assertPageCard(page)
  expect(image).toContain('/og/grb/vehicle/')
  expect(
    new URL(image).searchParams.get('v'),
    'card is version-busted',
  ).toBeTruthy()
})

test('a nation page emits a card and serves the PNG', async ({ page }) => {
  await page.goto(await firstLinkTo(page, '/grb/nations', '/grb/nation/'))
  await expect(page).toHaveURL(/\/grb\/nation\//)

  const image = await assertPageCard(page)
  expect(image).toContain('/og/grb/nation/')
})

test('a player page emits a cross-mode card and serves the PNG', async ({
  page,
}) => {
  await page.goto(await firstLinkTo(page, '/grb/leaderboard', '/player/'))
  await expect(page).toHaveURL(/\/player\//)

  const image = await assertPageCard(page)
  expect(image).toContain('/og/player/')
})

test('every page unfurls with at least the static site card', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/grb$/)
  const image = await meta(page, 'og:image')
  expect(image).toContain('/og-default.png')
  await expectCardImage(await page.request.get(new URL(image!).pathname))
})

test('an unknown vehicle slug 404s (no junk in the edge cache)', async ({
  page,
}) => {
  const res = await page.request.get('/og/grb/vehicle/__no_such_vehicle__.png')
  expect(res.status()).toBe(404)
})

test('a coming-soon mode 404s its card route', async ({ page }) => {
  // gab is not live; its pages show the coming-soon shell and its card 404s.
  const res = await page.request.get('/og/gab/vehicle/anything.png')
  expect(res.status()).toBe(404)
})
