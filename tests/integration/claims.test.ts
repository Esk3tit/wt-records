import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { playerClaims, players, profiles } from '#/db/schema'
import {
  approveClaim,
  denyClaim,
  listPendingClaims,
  releaseClaim,
  requestClaim,
  revokeClaim,
  viewerHasPendingClaim,
} from '#/claims/claims'

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

const pngFetch: typeof fetch = async () =>
  new Response(new Uint8Array([1, 2, 3, 4]), {
    headers: { 'content-type': 'image/png' },
  })

const notFoundFetch: typeof fetch = async () =>
  new Response('gone', { status: 404 })

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle, discord] of [
    [USER_A, 'AceIRL', '111'],
    [USER_B, 'Rival', '222'],
  ]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
    await t.db.insert(profiles).values({ id, handle, discordId: discord })
  }
})
afterEach(async () => {
  await t.client.close()
})

describe('requestClaim', () => {
  it('files a pending request that the queue surfaces with requester identity', async () => {
    const ace = await playerBySlug('ace')
    await requestClaim(t.db, USER_A, ace.id, { note: 'it is me' })

    expect(await viewerHasPendingClaim(t.db, USER_A, ace.id)).toBe(true)
    expect(await viewerHasPendingClaim(t.db, USER_B, ace.id)).toBe(false)

    const queue = await listPendingClaims(t.db)
    const row = queue.find((c) => c.playerId === ace.id)!
    expect(row).toMatchObject({
      playerSlug: 'ace',
      note: 'it is me',
      requesterHandle: 'AceIRL',
      requesterDiscordId: '111',
      wantsAvatarSeed: false,
    })
    expect(row.aliases).toContain('Ace')
  })

  it('records the seed intent from the presence of a picture URL', async () => {
    const ace = await playerBySlug('ace')
    await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    const [row] = await listPendingClaims(t.db)
    expect(row.wantsAvatarSeed).toBe(true)
  })

  it('refuses a duplicate pending request, a claimed player, and a tombstone', async () => {
    const ace = await playerBySlug('ace')
    await requestClaim(t.db, USER_A, ace.id, {})
    await expect(requestClaim(t.db, USER_A, ace.id, {})).rejects.toThrow(
      /pending/i,
    )

    await t.db
      .update(players)
      .set({ userId: USER_B })
      .where(eq(players.id, ace.id))
    await expect(requestClaim(t.db, USER_A, ace.id, {})).rejects.toThrow(
      /already claimed/i,
    )

    const floppa = await playerBySlug('floppa')
    await t.db
      .update(players)
      .set({ mergedInto: ace.id })
      .where(eq(players.id, floppa.id))
    await expect(requestClaim(t.db, USER_A, floppa.id, {})).rejects.toThrow(
      /merged/i,
    )
  })
})

describe('approveClaim', () => {
  it('links the user and clears every pending request on the player', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await requestClaim(t.db, USER_B, ace.id, {}) // a rival also wants it

    const result = await approveClaim(t.db, null, id)
    expect(result).toMatchObject({ playerId: ace.id, avatarSeeded: false })
    expect((await playerBySlug('ace')).userId).toBe(USER_A)

    const remaining = await t.db
      .select()
      .from(playerClaims)
      .where(eq(playerClaims.playerId, ace.id))
    expect(remaining).toHaveLength(0)
  })

  it('seeds the avatar from the provider picture when asked', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    const result = await approveClaim(t.db, store, id, { fetchImpl: pngFetch })
    expect(result.avatarSeeded).toBe(true)

    const claimed = await playerBySlug('ace')
    expect(claimed.avatarKey).toMatch(/^avatars\/\d+\/[0-9a-f]{12}\.png$/)
    expect(store.objects.has(claimed.avatarKey!)).toBe(true)
  })

  it('falls back to the Medallion when the picture fetch fails', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/missing.png',
    })
    const result = await approveClaim(t.db, store, id, {
      fetchImpl: notFoundFetch,
    })
    expect(result.avatarSeeded).toBe(false)
    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.size).toBe(0)
  })

  it('refuses when the player was claimed out from under the request', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await t.db
      .update(players)
      .set({ userId: USER_B })
      .where(eq(players.id, ace.id))
    await expect(approveClaim(t.db, null, id)).rejects.toThrow(
      /already claimed/i,
    )
  })

  it('resets a stale avatar to the Medallion when a new owner claims without a seed', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const staleKey = `avatars/${ace.id}/deadbeef0000.png`
    store.objects.set(staleKey, new Uint8Array([9]))
    await t.db
      .update(players)
      .set({ avatarKey: staleKey })
      .where(eq(players.id, ace.id))

    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, store, id)

    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.has(staleKey)).toBe(false)
  })

  it('rejects an off-host seed URL at the fetch boundary (SSRF backstop)', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://evil.example.com/x.png',
    })
    const result = await approveClaim(t.db, store, id, { fetchImpl: pngFetch })
    expect(result.avatarSeeded).toBe(false)
    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.size).toBe(0)
  })

  it('refuses an avatar whose declared size exceeds the cap', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const hugeFetch: typeof fetch = async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: {
          'content-type': 'image/png',
          'content-length': String(6 * 1024 * 1024),
        },
      })
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/big.png',
    })
    const result = await approveClaim(t.db, store, id, { fetchImpl: hugeFetch })
    expect(result.avatarSeeded).toBe(false)
    expect(store.objects.size).toBe(0)
  })
})

describe('denyClaim', () => {
  it('removes the request and leaves the player untouched', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await denyClaim(t.db, id)
    expect(await viewerHasPendingClaim(t.db, USER_A, ace.id)).toBe(false)
    expect((await playerBySlug('ace')).userId).toBeNull()
    await expect(denyClaim(t.db, id)).rejects.toThrow(/unknown/i)
  })
})

describe('release and revoke', () => {
  it('release: the owner unlinks and the avatar resets to the Medallion', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    await approveClaim(t.db, store, id, { fetchImpl: pngFetch })
    const key = (await playerBySlug('ace')).avatarKey!

    await expect(releaseClaim(t.db, store, USER_B, ace.id)).rejects.toThrow(
      /do not hold/i,
    )

    await releaseClaim(t.db, store, USER_A, ace.id)
    const released = await playerBySlug('ace')
    expect(released.userId).toBeNull()
    expect(released.avatarKey).toBeNull()
    expect(store.objects.has(key)).toBe(false)
  })

  it('release keeps the avatar object if another player still references its key', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    await approveClaim(t.db, store, id, { fetchImpl: pngFetch })
    const key = (await playerBySlug('ace')).avatarKey!
    // A concurrent re-claim reused the same content-hash key on another player.
    await t.db
      .update(players)
      .set({ userId: USER_B, avatarKey: key })
      .where(eq(players.id, floppa.id))

    await releaseClaim(t.db, store, USER_A, ace.id)
    expect(store.objects.has(key)).toBe(true)
  })

  it('revoke: a moderator severs any claim; an unclaimed player is refused', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, null, id)

    await revokeClaim(t.db, null, ace.id)
    expect((await playerBySlug('ace')).userId).toBeNull()
    await expect(revokeClaim(t.db, null, ace.id)).rejects.toThrow(
      /not claimed/i,
    )
  })
})
