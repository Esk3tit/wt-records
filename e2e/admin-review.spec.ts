import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { Sql } from 'postgres'
import { STATE } from './support/states'
import { TEST_USERS } from './support/users'
import { withPlayer } from './support/players'

/* The one screen where things await a Moderator. What is asserted here is what
   a Moderator can reach and what a decision does — never the component tree. */

test.use({ storageState: STATE.moderator })

/* In file order, one worker: there are two test users and one pending request
   per user, so two cases filing a claim in parallel would delete each other's.
   Not `serial` — a failure here says nothing about the case after it. */
test.describe.configure({ mode: 'default' })

const REVIEW = '/admin/claims'
const VIEWER = TEST_USERS.viewer.email
const MODERATOR = TEST_USERS.moderator.email

async function userId(sql: Sql, email: string): Promise<string> {
  const found = (
    await sql<
      { id: string }[]
    >`select id from auth.users where email = ${email}`
  ).at(0)?.id
  if (!found) throw new Error(`${email} must be provisioned first`)
  return found
}

async function propose(
  sql: Sql,
  playerId: number,
  email: string,
  value: string,
  waitedFor = '0 seconds',
): Promise<void> {
  await sql`
    insert into player_amendments (player_id, field, value, submitted_by, submitted_at)
    values (${playerId}, 'avatar', ${value}, ${await userId(sql, email)},
            now() - ${waitedFor}::interval)
  `
}

async function refused(
  sql: Sql,
  playerId: number,
  email: string,
  reason: string | null,
): Promise<void> {
  await sql`
    insert into player_amendments
      (player_id, field, value, submitted_by, state, reason, reviewed_at)
    values (${playerId}, 'avatar', ${`avatars/${playerId}/${reason ?? 'quiet'}.webp`},
            ${await userId(sql, email)}, 'rejected', ${reason}, now())
  `
}

async function fileClaim(
  sql: Sql,
  playerId: number,
  email: string,
  seedAvatarUrl: string | null,
): Promise<void> {
  const claimant = await userId(sql, email)
  await sql`delete from player_claims where user_id = ${claimant}`
  await sql`
    insert into player_claims (player_id, user_id, seed_avatar_url)
    values (${playerId}, ${claimant}, ${seedAvatarUrl})
  `
}

async function dropClaims(sql: Sql, email: string): Promise<void> {
  await sql`delete from player_claims where user_id = ${await userId(sql, email)}`
}

async function pendingTotal(sql: Sql): Promise<number> {
  const [{ waiting }] = await sql<{ waiting: number }[]>`
    select (select count(*) from player_claims where state = 'pending')
         + (select count(*) from player_amendments where state = 'pending')
      as waiting
  `
  return Number(waiting)
}

async function publishedAvatar(
  sql: Sql,
  playerId: number,
): Promise<string | null> {
  const [row] = await sql<{ avatarKey: string | null }[]>`
    select avatar_key as "avatarKey" from players where id = ${playerId}
  `
  return row.avatarKey
}

const panel = (page: Page, title: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: title }) })

const reviewTab = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: /Review/ })

/** The badge is one number — claims and amendments summed — and it is not
    there at all when nothing is waiting. Read straight after the load, so the
    two sides are the same moment. */
async function expectBadge(tab: Locator, waiting: number): Promise<void> {
  if (waiting === 0) {
    await expect(tab).toHaveText('Review')
    return
  }
  await expect(tab).toContainText(String(waiting))
  await expect(tab).toContainText(`${waiting} awaiting review`)
}

test('the tab is Review, and its badge is both queues in one number', async ({
  page,
}) => {
  await withPlayer(
    {
      slug: 'e2e-review-badge',
      displayName: 'Badge Holder',
      ownerEmail: VIEWER,
    },
    async ({ sql, id }) => {
      await page.goto('/admin')
      const tab = reviewTab(page)
      await expect(tab).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: 'Admin sections' })
          .getByRole('link', { name: 'Claims' }),
      ).toHaveCount(0)
      await expectBadge(tab, await pendingTotal(sql))

      // One of each: a badge that counted only one queue would now be short.
      await propose(sql, id, VIEWER, `avatars/${id}/badge.webp`)
      await withPlayer(
        { slug: 'e2e-review-badge-claim', displayName: 'Badge Asker' },
        async (other) => {
          try {
            await fileClaim(other.sql, other.id, MODERATOR, null)
            await page.reload()
            const waiting = await pendingTotal(sql)
            expect(waiting).toBeGreaterThanOrEqual(2)
            await expectBadge(tab, waiting)
          } finally {
            await dropClaims(other.sql, MODERATOR)
          }
        },
      )
    },
  )
})

test('two panels that never merge, each oldest first', async ({ page }) => {
  await withPlayer(
    {
      slug: 'e2e-review-older',
      displayName: 'Older Holder',
      ownerEmail: VIEWER,
    },
    async (older) => {
      await withPlayer(
        {
          slug: 'e2e-review-newer',
          displayName: 'Newer Holder',
          ownerEmail: MODERATOR,
        },
        async (newer) => {
          await propose(
            newer.sql,
            newer.id,
            MODERATOR,
            `avatars/${newer.id}/new.webp`,
            '1 hour',
          )
          await propose(
            older.sql,
            older.id,
            VIEWER,
            `avatars/${older.id}/old.webp`,
            '3 days',
          )
          await fileClaim(older.sql, older.id, VIEWER, null)
          try {
            await page.goto(REVIEW)

            const amendments = panel(page, 'Pending amendments')
            const claims = panel(page, 'Pending claims')
            // An identity judgement and a content judgement are never the same
            // row: the claim is in one panel and nowhere in the other.
            await expect(claims).toContainText('Older Holder')
            await expect(claims.getByRole('listitem')).toHaveCount(1)
            await expect(
              amendments
                .getByRole('listitem')
                .filter({ hasText: 'Older Holder' }),
            ).toBeVisible()

            // Relative, not absolute: another spec's proposal may be waiting in
            // this list too, and the claim about ordering is about these two.
            const order = await amendments
              .getByRole('listitem')
              .evaluateAll((rows) => rows.map((row) => row.textContent))
            const at = (name: string) =>
              order.findIndex((t) => t.includes(name))
            expect(at('Older Holder')).toBeGreaterThanOrEqual(0)
            expect(at('Older Holder')).toBeLessThan(at('Newer Holder'))
          } finally {
            await dropClaims(older.sql, VIEWER)
          }
        },
      )
    },
  )
})

test('the seed picture is rendered inline, and a dead link is plainly missing', async ({
  page,
}) => {
  await withPlayer(
    { slug: 'e2e-review-seed-live', displayName: 'Seed Live' },
    async (live) => {
      await withPlayer(
        { slug: 'e2e-review-seed-dead', displayName: 'Seed Dead' },
        async (dead) => {
          await fileClaim(live.sql, live.id, VIEWER, '/logo192.png')
          await fileClaim(dead.sql, dead.id, MODERATOR, '/no-such-picture.png')
          try {
            await page.goto(REVIEW)
            const claims = panel(page, 'Pending claims')

            const seeded = claims
              .getByRole('listitem')
              .filter({ hasText: 'Seed Live' })
              .locator('img')
            await expect(seeded).toBeVisible()
            // Big enough to judge: a thumbnail is how a bad picture gets through.
            expect((await seeded.boundingBox())!.width).toBeGreaterThanOrEqual(
              200,
            )
            // Actually decoded, not merely an element with a src.
            expect(
              await seeded.evaluate(
                (img) => (img as HTMLImageElement).naturalWidth,
              ),
            ).toBeGreaterThan(0)

            // A user who changed their Discord picture between filing and review
            // leaves a dead link — which must read as missing, not as a frame.
            const gone = claims
              .getByRole('listitem')
              .filter({ hasText: 'Seed Dead' })
            await expect(
              gone.getByRole('img', { name: 'Image missing' }),
            ).toBeVisible()
            await expect(gone.locator('img')).toHaveCount(0)
          } finally {
            await dropClaims(live.sql, VIEWER)
            await dropClaims(dead.sql, MODERATOR)
          }
        },
      )
    },
  )
})

test('the seed is a second decision: declined, the claim still approves onto the Medallion', async ({
  page,
}) => {
  await withPlayer(
    { slug: 'e2e-review-decline', displayName: 'Decline Seed' },
    async ({ sql, id }) => {
      await fileClaim(sql, id, VIEWER, '/logo192.png')
      try {
        await page.goto(REVIEW)
        const row = panel(page, 'Pending claims')
          .getByRole('listitem')
          .filter({ hasText: 'Decline Seed' })
        await row.getByRole('checkbox', { name: 'Seed this picture' }).uncheck()
        await row.getByRole('button', { name: 'Approve' }).click()

        await expect(row).toHaveCount(0)
        const [claimed] = await sql<{ userId: string | null }[]>`
          select user_id as "userId" from players where id = ${id}
        `
        expect(claimed.userId).toBe(await userId(sql, VIEWER))
        expect(await publishedAvatar(sql, id)).toBeNull()
      } finally {
        await dropClaims(sql, VIEWER)
      }
    },
  )
})

test('approving publishes the proposal; refusing leaves what is live alone', async ({
  page,
}) => {
  await withPlayer(
    {
      slug: 'e2e-review-approve',
      displayName: 'Approve Holder',
      ownerEmail: VIEWER,
      avatarKey: 'avatars/0/live.webp',
    },
    async (approving) => {
      await withPlayer(
        {
          slug: 'e2e-review-reject',
          displayName: 'Reject Holder',
          ownerEmail: MODERATOR,
          avatarKey: 'avatars/0/untouched.webp',
        },
        async (rejecting) => {
          const proposed = `avatars/${approving.id}/proposed.webp`
          await propose(approving.sql, approving.id, VIEWER, proposed)
          await propose(
            rejecting.sql,
            rejecting.id,
            MODERATOR,
            `avatars/${rejecting.id}/refused.webp`,
          )
          await page.goto(REVIEW)
          const amendments = panel(page, 'Pending amendments')

          await amendments
            .getByRole('listitem')
            .filter({ hasText: 'Approve Holder' })
            .getByRole('button', { name: 'Approve' })
            .click()
          await expect(
            amendments
              .getByRole('listitem')
              .filter({ hasText: 'Approve Holder' }),
          ).toHaveCount(0)
          expect(await publishedAvatar(approving.sql, approving.id)).toBe(
            proposed,
          )

          await amendments
            .getByRole('listitem')
            .filter({ hasText: 'Reject Holder' })
            .getByRole('button', { name: 'Reject' })
            .click()
          const dialog = page.getByRole('dialog')
          await dialog.getByRole('textbox').fill('not a picture of a person')
          await dialog.getByRole('button', { name: 'Reject' }).click()
          await expect(
            amendments
              .getByRole('listitem')
              .filter({ hasText: 'Reject Holder' }),
          ).toHaveCount(0)

          // Refusing a change is not removing what is published.
          expect(await publishedAvatar(rejecting.sql, rejecting.id)).toBe(
            'avatars/0/untouched.webp',
          )
          const [refusal] = await rejecting.sql<{ reason: string }[]>`
            select reason from player_amendments
            where player_id = ${rejecting.id} and state = 'rejected'
          `
          expect(refusal.reason).toBe('not a picture of a person')

          // Under one filter with every other thing done to that player.
          await page.goto('/admin/audit')
          await page.getByLabel('Filter by entity').selectOption('player')
          await expect(
            page
              .getByRole('listitem')
              .filter({ hasText: 'player.approve_amendment' })
              .first(),
          ).toBeVisible()
          await expect(
            page
              .getByRole('listitem')
              .filter({ hasText: 'player.reject_amendment' })
              .first(),
          ).toBeVisible()
        },
      )
    },
  )
})

test('a row another moderator already decided fails benignly and refreshes', async ({
  page,
}) => {
  await withPlayer(
    {
      slug: 'e2e-review-raced',
      displayName: 'Raced Holder',
      ownerEmail: VIEWER,
      avatarKey: 'avatars/0/live.webp',
    },
    async ({ sql, id }) => {
      await propose(sql, id, VIEWER, `avatars/${id}/raced.webp`)
      await page.goto(REVIEW)
      const row = panel(page, 'Pending amendments')
        .getByRole('listitem')
        .filter({ hasText: 'Raced Holder' })
      await expect(row).toBeVisible()

      // The other Moderator decides while this page is open.
      await sql`
        update player_amendments set state = 'rejected', reviewed_at = now()
        where player_id = ${id} and state = 'pending'
      `
      const auditedBefore = await sql<{ n: number }[]>`
        select count(*)::int as n from audit_log
        where entity = 'player' and entity_id = ${String(id)}
      `
      await row.getByRole('button', { name: 'Approve' }).click()

      await expect(
        page.getByText('Another moderator resolved that one first'),
      ).toBeVisible()
      await expect(row).toHaveCount(0)
      // The decision that won stands: nothing was published, and the losing
      // resolve wrote no second audit row.
      expect(await publishedAvatar(sql, id)).toBe('avatars/0/live.webp')
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from audit_log
        where entity = 'player' and entity_id = ${String(id)}
      `
      expect(n).toBe(auditedBefore[0].n)
    },
  )
})

test('prior refusals are shown with their reasons, and hidden when there are none', async ({
  page,
}) => {
  await withPlayer(
    {
      slug: 'e2e-review-history',
      displayName: 'History Holder',
      ownerEmail: VIEWER,
    },
    async (history) => {
      await withPlayer(
        {
          slug: 'e2e-review-clean',
          displayName: 'Clean Holder',
          ownerEmail: MODERATOR,
        },
        async (clean) => {
          await refused(history.sql, history.id, VIEWER, 'blurry')
          await refused(history.sql, history.id, VIEWER, 'hateful')
          await propose(
            history.sql,
            history.id,
            VIEWER,
            `avatars/${history.id}/third.webp`,
          )
          await propose(
            clean.sql,
            clean.id,
            MODERATOR,
            `avatars/${clean.id}/first.webp`,
          )

          await page.goto(REVIEW)
          const amendments = panel(page, 'Pending amendments')
          const withHistory = amendments
            .getByRole('listitem')
            .filter({ hasText: 'History Holder' })
          await expect(withHistory).toContainText('Refused 2 times before')
          await expect(withHistory).toContainText('blurry')
          await expect(withHistory).toContainText('hateful')

          const quiet = amendments
            .getByRole('listitem')
            .filter({ hasText: 'Clean Holder' })
          await expect(quiet).not.toContainText('Refused')
        },
      )
    },
  )
})

test('an age past a day nags in the warn token, and never in amber', async ({
  page,
}) => {
  await withPlayer(
    { slug: 'e2e-review-age', displayName: 'Aged Holder', ownerEmail: VIEWER },
    async ({ sql, id }) => {
      await propose(sql, id, VIEWER, `avatars/${id}/aged.webp`, '2 days')
      await page.goto(REVIEW)
      const stamp = panel(page, 'Pending amendments')
        .getByRole('listitem')
        .filter({ hasText: 'Aged Holder' })
        .locator('time')
      await expect(stamp).toContainText('waiting over a day')

      const ink = await stamp.evaluate((el) => getComputedStyle(el).color)
      const [warn, accent] = await page.evaluate(() => {
        const probe = (value: string) => {
          const span = document.createElement('span')
          span.style.color = value
          document.body.append(span)
          const resolved = getComputedStyle(span).color
          span.remove()
          return resolved
        }
        return [probe('var(--status-warn)'), probe('var(--color-accent)')]
      })
      // Design law: /admin's amber marks the single commit action per view,
      // which is Approve. Status ink is the semantic token, never the accent.
      expect(ink).toBe(warn)
      expect(ink).not.toBe(accent)
    },
  )
})

test('offers no way to empty the queue without looking at it', async ({
  page,
}) => {
  await withPlayer(
    { slug: 'e2e-review-nobulk', displayName: 'No Bulk', ownerEmail: VIEWER },
    async ({ sql, id }) => {
      await propose(sql, id, VIEWER, `avatars/${id}/one.webp`)
      await page.goto(REVIEW)
      const amendments = panel(page, 'Pending amendments')

      await expect(amendments.getByRole('checkbox')).toHaveCount(0)
      for (const bulk of [/approve all/i, /reject all/i, /select all/i]) {
        await expect(
          amendments.getByRole('button', { name: bulk }),
        ).toHaveCount(0)
      }
    },
  )
})

test('registers no subscription and no refresh timer', async ({ page }) => {
  await page.addInitScript(() => {
    const seen = { timers: [] as number[], sockets: [] as string[] }
    ;(window as unknown as { __watch: typeof seen }).__watch = seen
    const interval = window.setInterval.bind(window)
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...rest: unknown[]
    ) => {
      seen.timers.push(timeout ?? 0)
      return interval(handler, timeout, ...rest)
    }) as typeof window.setInterval
    const Socket = window.WebSocket
    window.WebSocket = class extends Socket {
      constructor(url: string | URL, protocols?: string | string[]) {
        seen.sockets.push(String(url))
        super(url, protocols)
      }
    }
  })
  await withPlayer(
    {
      slug: 'e2e-review-quiet',
      displayName: 'Quiet Holder',
      ownerEmail: VIEWER,
    },
    async ({ sql, id }) => {
      await propose(sql, id, VIEWER, `avatars/${id}/quiet.webp`)
      const calls: string[] = []
      page.on('request', (request) => {
        if (['fetch', 'xhr'].includes(request.resourceType())) {
          calls.push(request.url())
        }
      })
      await page.goto(REVIEW)
      await expect(
        panel(page, 'Pending amendments').getByRole('listitem'),
      ).not.toHaveCount(0)

      // The want was correctness, not liveness: a compare-and-set closes the
      // window two Moderators race in, and no refresh interval could. The
      // instrumentation above is what proves it — the wait only catches a
      // refetch fired straight after the load.
      const settled = calls.length
      await page.waitForTimeout(1000)
      expect(calls.slice(settled)).toEqual([])
      const watched = await page.evaluate(
        () =>
          (
            window as unknown as {
              __watch: { timers: number[]; sockets: string[] }
            }
          ).__watch,
      )
      expect(watched.sockets).toEqual([])
      expect(watched.timers).toEqual([])
    },
  )
})

test('the Review tab reaches a 320px screen without taking the page sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto(REVIEW)
  await expect(reviewTab(page)).toBeVisible()
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
