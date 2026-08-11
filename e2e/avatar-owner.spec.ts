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

/* One User holds one Player, so every other page has to say so rather than
   offer a form the server will refuse. */
test.describe('a holder looking at somebody else’s page', () => {
  test.use({ storageState: STATE.viewer })

  test('is told where their claim is, instead of a claim form', async ({
    page,
  }) => {
    const held = 'e2e-holder-elsewhere'
    const other = 'e2e-holder-other-page'
    await withPlayer(ownedPlayer(held), async () => {
      await withPlayer(
        { slug: other, displayName: 'E2E Unclaimed Page' },
        async () => {
          await page.goto(`/player/${other}`)

          await expect(
            page.getByRole('link', { name: 'E2E Avatar Owner' }),
          ).toBeVisible()
          await expect(page.getByText('has to revoke it')).toBeVisible()
          await expect(
            page.getByRole('button', { name: 'Claim this page' }),
          ).toHaveCount(0)
        },
      )
    })
  })
})
