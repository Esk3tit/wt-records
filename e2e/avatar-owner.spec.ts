import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import type { Sql } from 'postgres'
import { withPlayer } from './support/players'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'

/* This stack has no object store configured, and an upload with nowhere to put
   the bytes is refused server-side — so the E2E proves the owner-only *gating*
   (owner sees the control, non-owners never do). The upload/replace/remove
   round-trip against a store is covered by the owner-avatar integration tests. */

// Any content-hashed key: the E2E stack serves no object, so the avatar renders
// as the Medallion, but hasAvatar (DB truth) is true — enough to make the owner
// controls flip to Replace/Remove, which a non-owner must still never see.
const FAKE_AVATAR_KEY = 'avatars/1/deadbeef0000.webp'

/** Claimed by the E2E viewer, which is what surfaces the owner's controls. */
const ownedPlayer = (slug: string) => ({
  slug,
  displayName: 'E2E Avatar Owner',
  ownerEmail: TEST_USERS.viewer.email,
})

test.describe('owner avatar controls', () => {
  test.use({ storageState: STATE.viewer })

  test('the owner sees the upload control on their own page', async ({
    page,
  }) => {
    const slug = 'e2e-avatar-owner'
    await withPlayer(ownedPlayer(slug), async () => {
      await page.goto(`/player/${slug}`)

      // The owner is offered the control; with no avatar yet, no Remove.
      await expect(
        page.getByRole('button', { name: 'Upload photo', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Remove', exact: true }),
      ).toHaveCount(0)
    })
  })

  // A Claim is permanent from the owner's side: only a moderator severs it,
  // so the page offers them no way out of their own.
  test('the owner is offered no way to release their own claim', async ({
    page,
  }) => {
    const slug = 'e2e-claim-permanent'
    await withPlayer(ownedPlayer(slug), async () => {
      await page.goto(`/player/${slug}`)

      await expect(page.getByText('This is your page')).toBeVisible()
      for (const name of ['Release claim', 'Release']) {
        await expect(
          page.getByRole('button', { name, exact: true }),
        ).toHaveCount(0)
      }
    })
  })
})

async function expectNoOwnerControls(page: Page) {
  // The header renders (the player exists) but none of the owner controls do.
  // Absence (count 0), not just hidden, so a rendered-but-hidden control fails;
  // exact names so "Remove" can't match a substring like "Remove claim".
  await expect(page.getByText('E2E Avatar Owner')).toBeVisible()
  for (const name of ['Upload photo', 'Replace photo', 'Remove']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
}

/** A non-owner sees no controls whether or not the player carries an avatar —
    the avatar-backed state is what would surface Replace/Remove for an owner. */
async function expectNonOwnerSeesNothing(page: Page, sql: Sql, slug: string) {
  await page.goto(`/player/${slug}`)
  await expectNoOwnerControls(page)
  // Prove the avatar-backed state was actually set, else the second check below
  // would pass vacuously if the slug filter ever regressed to zero rows.
  const updated = await sql`
    update players set avatar_key = ${FAKE_AVATAR_KEY}
    where slug = ${slug} returning avatar_key
  `
  expect(updated).toHaveLength(1)
  expect(updated[0].avatar_key).toBe(FAKE_AVATAR_KEY)
  await page.reload()
  await expectNoOwnerControls(page)
}

/* The release's one assertion: the holder is served their own unreviewed
   picture, everybody else the reviewed one, and the share card serves the
   reviewed one to both — including on the holder's own page, which is where
   applying the predicate literally would have leaked it off-site. */
test.describe('an Avatar awaiting review', () => {
  test.use({ storageState: STATE.viewer })

  const APPROVED = 'avatars/1/aaaaaaaaaaaa.webp'
  const PENDING = 'avatars/1/bbbbbbbbbbbb.webp'

  /** The picture the page actually points at — an attribute value, not a
      mention: the reviewed key is on the page either way (the share card's
      version is computed from it), and that is not the same as rendering it. */
  const rendered = (key: string) =>
    new RegExp(`(?:src|href)="[^"]*${key.replaceAll('.', '\\.')}"`)

  async function ogImage(context: BrowserContext, slug: string) {
    const page = await context.newPage()
    await page.goto(`/player/${slug}`)
    const image = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute('content')
    await page.close()
    return image
  }

  /** Hands the current holder of a grb title to our owned Player for the body,
      then puts the title back — the ledger and the vehicle sheet only render an
      Avatar beside a holder, and the seed's holders are not ours to claim. */
  async function asTitleHolder(
    sql: Sql,
    playerId: number,
    body: (vehicleSlug: string) => Promise<void>,
  ) {
    const [held] = await sql<{ id: number; player_id: number; slug: string }[]>`
      select r.id, r.player_id, v.slug
      from records r join vehicles v on v.id = r.vehicle_id
      where r.mode = 'grb' and r.is_current and r.status = 'verified'
      order by r.id limit 1
    `
    await sql`update records set player_id = ${playerId} where id = ${held.id}`
    try {
      await body(held.slug)
    } finally {
      await sql`
        update records set player_id = ${held.player_id} where id = ${held.id}
      `
    }
  }

  /* The profile page is not the only surface, and it is the only one whose
     route was already viewer-aware. Dropping the viewer argument in the ledger
     or the sheet loader is a one-line regression that every other case here
     still passes. */
  test('follows the holder onto the ledger and the vehicle sheet', async ({
    page,
    browser,
  }) => {
    const slug = 'e2e-avatar-shadow-ledger'
    await withPlayer(
      { ...ownedPlayer(slug), avatarKey: APPROVED },
      async ({ sql, id }) => {
        await sql`
          insert into player_amendments (player_id, field, value, submitted_by)
          values (${id}, 'avatar', ${PENDING},
                  (select user_id from players where id = ${id}))
        `
        await asTitleHolder(sql, id, async (vehicleSlug) => {
          const anon = await browser.newContext({ storageState: STATE.anon })
          try {
            for (const path of [
              '/grb/vehicles',
              `/grb/vehicle/${vehicleSlug}`,
            ]) {
              const own = await (await page.request.get(path)).text()
              expect(own, path).toMatch(rendered(PENDING))
              expect(own, path).not.toMatch(rendered(APPROVED))

              const theirs = await (await anon.request.get(path)).text()
              expect(theirs, path).toMatch(rendered(APPROVED))
              expect(theirs, path).not.toMatch(rendered(PENDING))
            }
          } finally {
            await anon.close()
          }
        })
      },
    )
  })

  /* The headers must not time the review for the holder: one that appeared
     when they uploaded and vanished when a Moderator decided would tell them
     everything the shadow exists to withhold. */
  test('answers a holder in the same headers whether or not one is in flight', async ({
    page,
  }) => {
    const slug = 'e2e-avatar-shadow-headers'
    await withPlayer(
      { ...ownedPlayer(slug), avatarKey: APPROVED },
      async ({ sql, id }) => {
        const cacheHeaders = async () => {
          const res = await page.request.get('/grb/vehicles')
          const h = res.headers()
          return { cache: h['cache-control'] ?? null, vary: h['vary'] ?? null }
        }

        const quiet = await cacheHeaders()
        await sql`
          insert into player_amendments (player_id, field, value, submitted_by)
          values (${id}, 'avatar', ${PENDING},
                  (select user_id from players where id = ${id}))
        `
        expect(await cacheHeaders()).toEqual(quiet)

        // And after the decision lands, which is the other half of the tell.
        // Written as a decision actually is — a decided row carries its time.
        await sql`
          update player_amendments
          set state = 'rejected', reviewed_at = now()
          where player_id = ${id}
        `
        expect(await cacheHeaders()).toEqual(quiet)
        // Parity alone would hold just as well if the headers vanished
        // altogether, and `Vary: Cookie` is what keeps a shared cache from
        // handing this holder's response to the next visitor.
        expect(quiet.cache).toContain('no-store')
        expect(quiet.vary).toContain('Cookie')
      },
    )
  })

  test('is the holder’s alone, and never rides out on the share card', async ({
    page,
    browser,
  }) => {
    const slug = 'e2e-avatar-shadow'
    await withPlayer(
      { ...ownedPlayer(slug), avatarKey: APPROVED },
      async ({ sql, id }) => {
        await sql`
          insert into player_amendments (player_id, field, value, submitted_by)
          values (${id}, 'avatar', ${PENDING},
                  (select user_id from players where id = ${id}))
        `
        const anon = await browser.newContext({ storageState: STATE.anon })
        try {
          // The rendered page, not the DOM after hydration: the served HTML is
          // what a viewer is actually handed.
          const own = await (await page.request.get(`/player/${slug}`)).text()
          expect(own).toMatch(rendered(PENDING))
          expect(own).not.toMatch(rendered(APPROVED))

          const theirs = await (
            await anon.request.get(`/player/${slug}`)
          ).text()
          expect(theirs).toMatch(rendered(APPROVED))
          expect(theirs).not.toMatch(rendered(PENDING))

          // Same card, versioned off the same (reviewed) key, for both.
          const ownCard = await ogImage(page.context(), slug)
          expect(ownCard).toBe(await ogImage(anon, slug))

          // The card route itself, under the holder's own session: it renders,
          // and it renders the same card an anonymous scraper is served. (This
          // stack has no bucket, so both Avatars resolve to the Medallion —
          // comparing the drawn pictures is child 7's.)
          const cardUrl = new URL(ownCard!)
          const cardPath = `${cardUrl.pathname}${cardUrl.search}`
          const card = await page.request.get(cardPath)
          expect(card.status()).toBe(200)
          expect(card.headers()['content-type']).toContain('image/png')
          expect((await card.body()).length).toBe(
            (await (await anon.request.get(cardPath)).body()).length,
          )

          // And the version does track the Avatar — otherwise the equality
          // above would hold no matter what the shadow did.
          await sql`
            update players set avatar_key = ${PENDING} where id = ${id}
          `
          expect(await ogImage(anon, slug)).not.toBe(ownCard)
        } finally {
          await anon.close()
        }
      },
    )
  })
})

test.describe('a signed-out visitor sees no avatar controls', () => {
  test.use({ storageState: STATE.anon })

  test('no controls for anonymous, with or without an avatar', async ({
    page,
  }) => {
    const slug = 'e2e-avatar-anon'
    await withPlayer(ownedPlayer(slug), ({ sql }) =>
      expectNonOwnerSeesNothing(page, sql, slug),
    )
  })
})

test.describe('a signed-in non-owner sees no avatar controls', () => {
  test.use({ storageState: STATE.moderator })

  test('no controls on someone else’s page, with or without an avatar', async ({
    page,
  }) => {
    const slug = 'e2e-avatar-nonowner'
    await withPlayer(ownedPlayer(slug), ({ sql }) =>
      expectNonOwnerSeesNothing(page, sql, slug),
    )
  })
})

/* One User holds one Player, so every other page withholds the form rather
   than offering one the server will refuse. */
test.describe('a holder looking at somebody else’s page', () => {
  test.use({ storageState: STATE.viewer })

  test('is offered no claim form, and no explanation either', async ({
    page,
  }) => {
    const held = 'e2e-holder-elsewhere'
    const other = 'e2e-holder-other-page'
    await withPlayer(ownedPlayer(held), async () => {
      await withPlayer(
        { slug: other, displayName: 'E2E Unclaimed Page' },
        async () => {
          await page.goto(`/player/${other}`)

          // The page renders, so this is silence rather than a failed load.
          await expect(page.getByText('E2E Unclaimed Page')).toBeVisible()
          await expect(
            page.getByRole('button', { name: 'Claim this page' }),
          ).toHaveCount(0)
          await expect(
            page.getByText(/your claim (is on|request on)/i),
          ).toHaveCount(0)
        },
      )
    })
  })
})
