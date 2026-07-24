import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { players, profiles } from '#/db/schema'
import { removeOwnAvatar, setOwnAvatar } from '#/claims/claims'

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
async function png(color: string): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width: 200, height: 120, channels: 3, background: color },
  })
    .png()
    .toBuffer()
  return new Uint8Array(buf)
}

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

async function claim(slug: string, userId: string) {
  const p = await playerBySlug(slug)
  await t.db.update(players).set({ userId }).where(eq(players.id, p.id))
  return p
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
  it('stores a 512×512 WebP under a content-hashed key and repoints the player', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()

    const { avatarKey } = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png('#c33'),
    )

    expect(avatarKey).toMatch(/^avatars\/\d+\/[0-9a-f]{12}\.webp$/)
    expect((await playerBySlug('ace')).avatarKey).toBe(avatarKey)
    const stored = store.objects.get(avatarKey)!
    const meta = await sharp(Buffer.from(stored)).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 })
  })

  it('replaces the avatar and deletes the now-unreferenced prior object', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()

    const first = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png('#c33'),
    )
    const second = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png('#37c'),
    )

    expect(second.avatarKey).not.toBe(first.avatarKey)
    expect((await playerBySlug('ace')).avatarKey).toBe(second.avatarKey)
    expect(store.objects.has(second.avatarKey)).toBe(true)
    expect(store.objects.has(first.avatarKey)).toBe(false)
  })

  it('keeps the prior object when another player still references its key', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const first = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png('#c33'),
    )

    // A concurrent re-reference of the same content-hash key on another player.
    const floppa = await playerBySlug('floppa')
    await t.db
      .update(players)
      .set({ userId: USER_B, avatarKey: first.avatarKey })
      .where(eq(players.id, floppa.id))

    await setOwnAvatar(t.db, store, USER_A, ace.id, await png('#37c'))
    expect(store.objects.has(first.avatarKey)).toBe(true)
  })

  it('refuses an unclaimed, someone-else’s, or merged player', async () => {
    const store = fakeStore()

    const unclaimed = await playerBySlug('ace')
    await expect(
      setOwnAvatar(t.db, store, USER_A, unclaimed.id, await png('#c33')),
    ).rejects.toThrow(/not claimed/i)

    await claim('ace', USER_B)
    await expect(
      setOwnAvatar(t.db, store, USER_A, unclaimed.id, await png('#c33')),
    ).rejects.toThrow(/do not hold/i)

    // A non-owner is rejected before any bytes reach the store.
    expect(store.objects.size).toBe(0)

    const floppa = await claim('floppa', USER_A)
    await t.db
      .update(players)
      .set({ mergedInto: unclaimed.id })
      .where(eq(players.id, floppa.id))
    await expect(
      setOwnAvatar(t.db, store, USER_A, floppa.id, await png('#c33')),
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
})

describe('removeOwnAvatar', () => {
  it('removes the avatar and cleans up the object', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const { avatarKey } = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png('#c33'),
    )

    await removeOwnAvatar(t.db, store, USER_A, ace.id)
    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.has(avatarKey)).toBe(false)
  })

  it('keeps the object when another player references the key', async () => {
    const ace = await claim('ace', USER_A)
    const store = fakeStore()
    const { avatarKey } = await setOwnAvatar(
      t.db,
      store,
      USER_A,
      ace.id,
      await png('#c33'),
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
