import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import sharp from 'sharp'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { playerAmendments, players, profiles } from '#/db/schema'
import { removeOwnAvatar, setOwnAvatar } from '#/claims/owner'
import {
  AMENDMENT_HOURLY_LIMIT,
  loadAmendmentViewer,
} from '#/claims/amendments'
import { REVIEW_QUEUE_PATH, registerAmendmentNotifier } from '#/claims/notify'
import type { AmendmentNotice } from '#/claims/notify'

const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'

let t: TestDb

/** In-memory stand-in for the R2 assets bucket. */
function fakeStore() {
  const objects = new Map<string, Uint8Array>()
  return {
    objects,
    async put(_role: 'assets', key: string, body: Uint8Array) {
      objects.set(key, body)
    },
    async delete(_role: 'assets', key: string) {
      objects.delete(key)
    },
  }
}

/** A tiny real PNG in a given colour — a distinct colour re-encodes to distinct
    bytes, so uploads land on distinct content-hashed keys. */
async function png(color: {
  r: number
  g: number
  b: number
}): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width: 200, height: 120, channels: 3, background: color },
  })
    .png()
    .toBuffer()
  return new Uint8Array(buf)
}

const RED = { r: 204, g: 51, b: 51 }
const BLUE = { r: 51, g: 119, b: 204 }

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

async function claim(slug: string, userId: string) {
  const p = await playerBySlug(slug)
  await t.db.update(players).set({ userId }).where(eq(players.id, p.id))
  return p
}

async function amendments(playerId: number) {
  return t.db
    .select()
    .from(playerAmendments)
    .where(eq(playerAmendments.playerId, playerId))
    .orderBy(playerAmendments.id)
}

/** What the owner is served, straight through the shadow's own resolver. */
async function pendingFor(userId: string) {
  return (await loadAmendmentViewer(t.db, userId))?.pendingAvatarKey ?? null
}

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle] of [
    [USER_A, 'AceIRL'],
    [USER_B, 'Rival'],
  ]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
    await t.db.insert(profiles).values({ id, handle })
  }
})
afterEach(async () => {
  await t.client.close()
})

describe('setOwnAvatar', () => {
  it('stores a 512×512 WebP under a content-hashed key and proposes it', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()

    const { avatarKey } = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png(RED),
    )

    expect(avatarKey).toMatch(/^avatars\/\d+\/[0-9a-f]{12}\.webp$/)
    // Published state is untouched — the owner sees it, nobody else does.
    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(await pendingFor(USER_A)).toBe(avatarKey)
    expect(await amendments(ace.id)).toMatchObject([
      { field: 'avatar', value: avatarKey, state: 'pending', reviewedBy: null },
    ])
    const stored = store.objects.get(avatarKey)!
    const meta = await sharp(Buffer.from(stored)).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 })
  })

  it('supersedes a proposal in flight instead of queueing a second one', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()

    const first = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png(RED),
    )
    const second = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png(BLUE),
    )

    expect(second.avatarKey).not.toBe(first.avatarKey)
    // A Moderator only ever sees the value the owner currently wants.
    expect(await amendments(ace.id)).toMatchObject([
      { value: first.avatarKey, state: 'superseded', reviewedBy: null },
      { value: second.avatarKey, state: 'pending' },
    ])
    expect(await pendingFor(USER_A)).toBe(second.avatarKey)
    expect(store.objects.has(second.avatarKey)).toBe(true)
    expect(store.objects.has(first.avatarKey)).toBe(false)
  })

  it('never refuses a change while one is in flight', async () => {
    // A refusal is feedback, and feedback is the one thing that would reveal
    // the queue — so the third and fourth attempts must land like the first.
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    for (const colour of [RED, BLUE, RED, BLUE]) {
      await expect(
        setOwnAvatar(t.db, store, USER_A, ace.id, await png(colour)),
      ).resolves.toMatchObject({ avatarKey: expect.any(String) })
    }
    const rows = await amendments(ace.id)
    expect(rows.filter((r) => r.state === 'pending')).toHaveLength(1)
  })

  it('trips a generic throttle at the eleventh change in an hour', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    // Superseded rows count: the guard counts submissions, not survivors.
    await t.db.insert(playerAmendments).values(
      Array.from({ length: AMENDMENT_HOURLY_LIMIT }, (_, i) => ({
        playerId: ace.id,
        field: 'avatar' as const,
        value: `avatars/${ace.id}/spent${i}.webp`,
        state: 'superseded' as const,
        submittedBy: USER_A,
      })),
    )

    await expect(
      setOwnAvatar(t.db, store, USER_A, ace.id, await png(RED)),
    ).rejects.toThrow(/too many changes/i)
    // Nothing about review, and nothing about the submitter.
    await expect(
      setOwnAvatar(t.db, store, USER_A, ace.id, await png(RED)),
    ).rejects.not.toThrow(/review|pending|moderat/i)
    expect(store.objects.size).toBe(0)
  })

  it('counts the window from now, not from the whole history', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    await t.db.insert(playerAmendments).values(
      Array.from({ length: AMENDMENT_HOURLY_LIMIT }, (_, i) => ({
        playerId: ace.id,
        field: 'avatar' as const,
        value: `avatars/${ace.id}/old${i}.webp`,
        state: 'superseded' as const,
        submittedBy: USER_A,
        submittedAt: sql`now() - interval '2 hours'`,
      })),
    )

    await expect(
      setOwnAvatar(t.db, store, USER_A, ace.id, await png(RED)),
    ).resolves.toMatchObject({ avatarKey: expect.any(String) })
  })

  it('keeps the prior object when another player still references its key', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const first = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png(RED),
    )

    // A concurrent re-reference of the same content-hash key on another player.
    const floppa = await playerBySlug('floppa')
    await t.db
      .update(players)
      .set({ userId: USER_B, avatarKey: first.avatarKey })
      .where(eq(players.id, floppa.id))

    await setOwnAvatar(t.db, store, USER_A, ace.id, await png(BLUE))
    expect(store.objects.has(first.avatarKey)).toBe(true)
  })

  it('refuses an unclaimed, someone-else’s, or merged player', async () => {
    const store = fakeStore()

    const unclaimed = await playerBySlug('ace')
    await expect(
      setOwnAvatar(t.db, store, USER_A, unclaimed.id, await png(RED)),
    ).rejects.toThrow(/not claimed/i)

    await claim('ace', USER_B)
    await expect(
      setOwnAvatar(t.db, store, USER_A, unclaimed.id, await png(RED)),
    ).rejects.toThrow(/do not hold/i)

    // A non-owner is rejected before any bytes reach the store.
    expect(store.objects.size).toBe(0)

    const floppa = await claim('floppa', USER_A)
    await t.db
      .update(players)
      .set({ mergedInto: unclaimed.id })
      .where(eq(players.id, floppa.id))
    await expect(
      setOwnAvatar(t.db, store, USER_A, floppa.id, await png(RED)),
    ).rejects.toThrow(/merged/i)
  })

  it('rejects bytes that do not decode, leaving player and store untouched', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()

    await expect(
      setOwnAvatar(t.db, store, USER_A, ace.id, new Uint8Array([1, 2, 3, 4])),
    ).rejects.toThrow(/not a supported image/i)

    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.size).toBe(0)
  })

  it('enforces the 5 MB cap', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    await expect(
      setOwnAvatar(
        t.db,
        store,
        USER_A,
        ace.id,
        new Uint8Array(6 * 1024 * 1024),
      ),
    ).rejects.toThrow(/5 MB/i)
    expect(store.objects.size).toBe(0)
  })

  it('refuses when no object store is configured, never persisting a key', async () => {
    const ace = await claim('ace', USER_A)
    await expect(
      setOwnAvatar(t.db, null, USER_A, ace.id, await png(RED)),
    ).rejects.toThrow(/not available/i)
    expect((await playerBySlug('ace')).avatarKey).toBeNull()
  })
})

describe('removeOwnAvatar', () => {
  it('publishes instantly, with no rows required for it to work', async () => {
    // The grandfathered case too: an avatar that predates the shadow carries no
    // Amendment, and taking it down must still not wait on anybody.
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const published = `avatars/${ace.id}/published.webp`
    await store.put('assets', published, new Uint8Array([1]))
    await t.db
      .update(players)
      .set({ avatarKey: published })
      .where(eq(players.id, ace.id))

    await removeOwnAvatar(t.db, store, USER_A, ace.id)

    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.has(published)).toBe(false)
    expect(await amendments(ace.id)).toEqual([])
  })

  it('takes a proposal in flight down with it', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const published = `avatars/${ace.id}/published.webp`
    await store.put('assets', published, new Uint8Array([1]))
    await t.db
      .update(players)
      .set({ avatarKey: published })
      .where(eq(players.id, ace.id))
    const { avatarKey } = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png(RED),
    )

    await removeOwnAvatar(t.db, store, USER_A, ace.id)

    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    // Nothing left proposed, or the owner would keep seeing what they removed.
    expect(await pendingFor(USER_A)).toBeNull()
    expect(await amendments(ace.id)).toMatchObject([
      { value: avatarKey, state: 'superseded', reviewedBy: null },
    ])
    expect(store.objects.has(avatarKey)).toBe(false)
    expect(store.objects.has(published)).toBe(false)
  })

  it('keeps the object when another player references the key', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const { avatarKey } = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png(RED),
    )
    const floppa = await playerBySlug('floppa')
    await t.db
      .update(players)
      .set({ userId: USER_B, avatarKey })
      .where(eq(players.id, floppa.id))

    await removeOwnAvatar(t.db, store, USER_A, ace.id)
    expect(store.objects.has(avatarKey)).toBe(true)
  })

  it('is a no-op when the player already shows the Medallion', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    await expect(
      removeOwnAvatar(t.db, store, USER_A, ace.id),
    ).resolves.toBeUndefined()
    expect((await playerBySlug('ace')).avatarKey).toBeNull()
  })

  it('refuses a non-owner', async () => {
    const ace = await claim('ace', USER_B)
    const store = fakeStore()
    await expect(removeOwnAvatar(t.db, store, USER_A, ace.id)).rejects.toThrow(
      /do not hold/i,
    )
  })
})

describe('the notification seam', () => {
  it('tells a channel the name and where to decide, and never the picture', async () => {
    const ace = await claim('ace', USER_A)
    const notices: AmendmentNotice[] = []
    const unplug = registerAmendmentNotifier((notice) => {
      notices.push(notice)
    })
    try {
      const { avatarKey } = await setOwnAvatar(
        t.db,
        fakeStore(),
        USER_A,
        ace.id,
        await png(RED),
      )
      expect(notices).toEqual([
        {
          playerId: ace.id,
          playerDisplayName: ace.displayName,
          reviewPath: REVIEW_QUEUE_PATH,
        },
      ])
      expect(JSON.stringify(notices)).not.toContain(avatarKey)
    } finally {
      unplug()
    }
  })

  it('cannot fail the upload it is announcing', async () => {
    const ace = await claim('ace', USER_A)
    const unplug = registerAmendmentNotifier(() => {
      throw new Error('the mod channel is down')
    })
    const rejecting = registerAmendmentNotifier(async () => {
      throw new Error('and its retry is too')
    })
    try {
      const store = fakeStore()
      const { avatarKey } = await setOwnAvatar(
        t.db,
        store,
        USER_A,
        ace.id,
        await png(RED),
      )
      // The proposal is filed and its object is in place: a ping nobody
      // received changed nothing about either.
      expect(store.objects.has(avatarKey)).toBe(true)
      expect((await amendments(ace.id)).map((a) => a.value)).toEqual([
        avatarKey,
      ])
    } finally {
      unplug()
      rejecting()
    }
  })
})
