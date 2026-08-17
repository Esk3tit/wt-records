import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import type { Sql } from 'postgres'
import { toPlayerCardModel } from '#/og/props/player'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

/* The share card is the profile off-site. Two things are proved here: the
   country reaches it, and the Avatar shadow does NOT — the card route and the
   page's og:image are the named carve-out, and both always resolve the
   approved value. The second is invisible to any test that sends no session. */

/* Both resolve to real images: the test server stands in for the bucket, so a
   key naming a file under `public/` genuinely loads. They must be two
   different pictures, or the card cannot tell us which one it drew. */
const APPROVED_AVATAR = 'logo512.png'
const PENDING_AVATAR = 'logo192.png'

/** The tombstone's own name, which the survivor's card captions itself with. */
const FORMER_NAME = 'E2E Former Name'

const ownedPlayer = (slug: string) => ({
  slug,
  displayName: 'E2E Card Country',
  ownerEmail: TEST_USERS.viewer.email,
  avatarKey: APPROVED_AVATAR,
  countryCode: 'JP',
})

/** The picture the owner has proposed and nobody has reviewed. */
async function proposeAvatar(sql: Sql, playerId: number): Promise<void> {
  const [{ id }] = await sql<{ id: string }[]>`
    select id from auth.users where email = ${TEST_USERS.viewer.email}
  `
  await sql`
    insert into player_amendments (player_id, field, value, submitted_by)
    values (${playerId}, 'avatar', ${PENDING_AVATAR}, ${id})
  `
}

async function cardImageUrl(page: Page, slug: string): Promise<string> {
  await page.goto(`/player/${slug}`)
  const image = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute('content')
  expect(image, 'og:image is present').toBeTruthy()
  return image!
}

/** The card routes redirect relative, so the origin is only there to parse. */
function relative(location: string): URL {
  return new URL(location, 'http://card.invalid')
}

async function fetchCard(request: APIRequestContext, url: string) {
  const { pathname, search } = new URL(url)
  const res = await request.get(`${pathname}${search}`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/png')
  return res
}

test.describe('the card carries the country', () => {
  test.use({ storageState: STATE.anon })

  test('renders a claimed Player with a country as a real card', async ({
    page,
  }) => {
    const slug = 'e2e-card-country'
    await withPlayer(ownedPlayer(slug), async () => {
      const image = await cardImageUrl(page, slug)
      expect(image).toContain('/og/player/')
      expect(new URL(image).searchParams.get('v')).toBeTruthy()

      const body = await (await fetchCard(page.request, image)).body()
      expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(body.readUInt32BE(16)).toBe(1200)
      expect(body.readUInt32BE(20)).toBe(630)
    })
  })

  test("a Player's country changes the card's URL", async ({ page }) => {
    // The country is drawn on the card, so it has to bust the `?v=` — a viewer
    // whose unfurl was cached before must not keep seeing the old one.
    const slug = 'e2e-card-country-bust'
    await withPlayer(
      { ...ownedPlayer(slug), countryCode: undefined },
      async ({ sql }) => {
        const before = await cardImageUrl(page, slug)
        await sql`update players set country_code = 'JP' where slug = ${slug}`
        const after = await cardImageUrl(page, slug)

        expect(new URL(after).searchParams.get('v')).not.toBe(
          new URL(before).searchParams.get('v'),
        )
      },
    )
  })

  test('still renders, uncacheable, when the Avatar will not resolve', async ({
    page,
  }) => {
    /* The existing degradation path, now with a pill on it: the Medallion
       stands in and the card is served no-store, so the stand-in cannot freeze
       into caches under an avatar URL that never changed. */
    const slug = 'e2e-card-country-noavatar'
    await withPlayer(
      { ...ownedPlayer(slug), avatarKey: 'avatars/1/nothing-here.webp' },
      async () => {
        const res = await page.request.get(`/og/player/${slug}.png`)
        expect(res.status()).toBe(200)
        expect(res.headers()['content-type']).toContain('image/png')
        expect(res.headers()['cache-control']).toBe('no-store')
        expect((await res.body()).readUInt32BE(16)).toBe(1200)
      },
    )
  })

  test('a card reached through a Merge agrees with the direct one', async ({
    page,
  }) => {
    /* The tombstone redirect computes the survivor's version itself, so it has
       to account for the country too — otherwise the `?v=` it sends a scraper
       to is not the one the survivor self-computes, and the same URL means two
       different things depending on how it was reached. */
    const slug = 'e2e-card-country-survivor'
    const oldSlug = 'e2e-card-country-tombstone'
    await withPlayer(ownedPlayer(slug), async ({ sql, id }) => {
      await sql`delete from players where slug = ${oldSlug}`
      await sql`
        insert into players (slug, display_name, merged_into)
        values (${oldSlug}, ${FORMER_NAME}, ${id})
      `
      try {
        const res = await page.request.get(`/og/player/${oldSlug}.png`, {
          maxRedirects: 0,
        })
        expect(res.status()).toBe(301)

        const location = relative(res.headers()['location'])
        expect(location.pathname).toContain(slug)
        expect(location.searchParams.get('from')).toBe(oldSlug)

        /* The assertion that bites. Comparing the redirect's bytes with the
           target's proves nothing — the route ignores `v`, so any hash at all
           would render the same card. The version has to equal the one the
           target independently computes for that content, which the fixture
           knows in full because it seeded every input. */
        const expected = toPlayerCardModel(
          {
            player: { displayName: ownedPlayer(slug).displayName },
            records: [],
          },
          {
            previouslyKnownAs: FORMER_NAME,
            avatarKey: APPROVED_AVATAR,
            countryCode: ownedPlayer(slug).countryCode,
          },
        ).version
        expect(location.searchParams.get('v')).toBe(expected)

        const redirected = await page.request.get(
          `${location.pathname}${location.search}`,
        )
        expect(redirected.status()).toBe(200)
        const bytes = await redirected.body()

        // And it really is the tombstone's card — the one carrying the former
        // name — not the survivor's own.
        const survivorsOwn = await page.request.get(`/og/player/${slug}.png`)
        expect(Buffer.compare(bytes, await survivorsOwn.body())).not.toBe(0)

        // Clearing the country moves it, so the country is genuinely hashed in
        // rather than merely agreeing with a constant.
        await sql`update players set country_code = null where slug = ${slug}`
        const after = await page.request.get(`/og/player/${oldSlug}.png`, {
          maxRedirects: 0,
        })
        expect(
          relative(after.headers()['location']).searchParams.get('v'),
        ).not.toBe(expected)
      } finally {
        await sql`delete from players where slug = ${oldSlug}`
      }
    })
  })
})

/* The carve-out, asserted with the owner's own session. The card route is
   `public, s-maxage=86400` and its URL versions off the avatar key, so an
   owner rendering their own card under the shadow's predicate would render and
   publicly edge-cache their unreviewed picture under a fresh `?v=` — the exact
   escape the shadow exists to prevent. */
test.describe('the owner is served the reviewed card, like everyone else', () => {
  test.use({ storageState: STATE.viewer })

  test('their session changes neither the card nor its URL', async ({
    page,
    browser,
  }) => {
    const slug = 'e2e-card-shadow'
    await withPlayer(ownedPlayer(slug), async ({ sql, id }) => {
      await proposeAvatar(sql, id)

      // The proposal really is live, or this case proves nothing.
      const [{ waiting }] = await sql<{ waiting: number }[]>`
        select count(*) as waiting from player_amendments
        where player_id = ${id} and state = 'pending'
      `
      expect(Number(waiting)).toBe(1)

      const asOwner = await cardImageUrl(page, slug)

      const anon = await browser.newContext({ storageState: STATE.anon })
      try {
        const anonPage = await anon.newPage()
        const asVisitor = await cardImageUrl(anonPage, slug)

        // The page never even emits a link pointing at a picture nobody else
        // can see: the owner's og:image is the visitor's, byte for byte.
        expect(asOwner).toBe(asVisitor)

        const [ownerCard, visitorCard] = await Promise.all([
          fetchCard(page.request, asOwner),
          fetchCard(anonPage.request, asVisitor),
        ])
        // Both avatars are images that genuinely load, so identical bytes mean
        // the owner was drawn the approved picture, not merely the same
        // fallback twice.
        expect(
          Buffer.compare(await ownerCard.body(), await visitorCard.body()),
        ).toBe(0)

        // And it stays publicly cacheable for the owner too — a card that went
        // private for them would leak the shadow through its headers.
        expect(ownerCard.headers()['cache-control']).toBe(
          visitorCard.headers()['cache-control'],
        )
        expect(ownerCard.headers()['cache-control']).toContain('s-maxage')
      } finally {
        await anon.close()
      }
    })
  })

  test('the card route ignores a session even when asked directly', async ({
    page,
    browser,
  }) => {
    // Not via the page's og:image: straight at `/og/player/$slug.png`, which is
    // the URL a scraper follows and the one an owner could paste anywhere.
    const slug = 'e2e-card-shadow-direct'
    await withPlayer(ownedPlayer(slug), async ({ sql, id }) => {
      await proposeAvatar(sql, id)
      const path = `/og/player/${slug}.png`

      const anon = await browser.newContext({ storageState: STATE.anon })
      try {
        const [asOwner, asVisitor] = await Promise.all([
          page.request.get(path),
          (await anon.newPage()).request.get(path),
        ])
        expect(asOwner.status()).toBe(200)
        expect(asVisitor.status()).toBe(200)
        const served = await asOwner.body()
        expect(Buffer.compare(served, await asVisitor.body())).toBe(0)

        /* The control: the same card once the pending picture IS the approved
           one. If that renders identically, the equality above proves nothing
           — the two keys have to reach visibly different cards for this whole
           case to have any force. */
        await sql`
          update players set avatar_key = ${PENDING_AVATAR} where slug = ${slug}
        `
        const ifItHadEscaped = await (await page.request.get(path)).body()
        expect(Buffer.compare(served, ifItHadEscaped)).not.toBe(0)
      } finally {
        await anon.close()
      }
    })
  })
})
