import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { auditLog, playerAmendments, players, profiles } from '#/db/schema'
import {
  loadAmendmentViewer,
  approveAmendment,
  rejectAmendment,
} from '#/claims/amendments'
import { setOwnAvatar } from '#/claims/owner'

/* What a decision does to published state, and what each viewer is served
   afterwards. A row's `state` column on its own tests the machinery, not the
   shadow. */

const OWNER = '00000000-0000-4000-8000-00000000000a'
const OTHER = '00000000-0000-4000-8000-00000000000b'
const MOD = '00000000-0000-4000-8000-00000000000c'

let t: TestDb

/** In-memory stand-in for the R2 assets bucket: no delete path in this suite
    may reach a store resolved from `.env`, which points at production. */
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

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle] of [
    [OWNER, 'AceIRL'],
    [OTHER, 'Rival'],
    [MOD, 'Mod'],
  ]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
    await t.db.insert(profiles).values({ id, handle })
  }
})
afterEach(async () => {
  await t.client.close()
})

async function claimedPlayer(slug: string, userId: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  await t.db.update(players).set({ userId }).where(eq(players.id, p.id))
  return p
}

async function propose(playerId: number, userId: string, value: string) {
  const [row] = await t.db
    .insert(playerAmendments)
    .values({ playerId, field: 'avatar', value, submittedBy: userId })
    .returning()
  return row
}

async function amendment(id: number) {
  const [row] = await t.db
    .select()
    .from(playerAmendments)
    .where(eq(playerAmendments.id, id))
  return row
}

async function avatarKeyOf(playerId: number) {
  const [row] = await t.db
    .select({ avatarKey: players.avatarKey })
    .from(players)
    .where(eq(players.id, playerId))
  return row.avatarKey
}

describe('approveAmendment', () => {
  it('publishes the proposed value and deletes the avatar it replaces', async () => {
    const ace = await claimedPlayer('ace', OWNER)
    const store = fakeStore()
    const published = `avatars/${ace.id}/published.webp`
    await store.put('assets', published, new Uint8Array([1]))
    await t.db
      .update(players)
      .set({ avatarKey: published })
      .where(eq(players.id, ace.id))
    const proposed = `avatars/${ace.id}/proposed.webp`
    await store.put('assets', proposed, new Uint8Array([2]))
    const row = await propose(ace.id, OWNER, proposed)

    expect(await approveAmendment(t.db, store, MOD, row.id)).toEqual({
      resolved: true,
    })

    expect(await avatarKeyOf(ace.id)).toBe(proposed)
    expect(await amendment(row.id)).toMatchObject({
      state: 'approved',
      reviewedBy: MOD,
      reason: null,
    })
    // Nothing is uploaded or re-encoded — the bytes have been in place since
    // the owner picked the file. Approve is where the Avatar is replaced,
    // though, so the object it replaces goes, as at every other such moment.
    expect(store.objects.has(proposed)).toBe(true)
    expect(store.objects.has(published)).toBe(false)
    // Everyone is served it now, the owner included.
    expect(await loadAmendmentViewer(t.db, OWNER)).toBeNull()
  })

  it('audits the promotion without duplicating the amendment row', async () => {
    const ace = await claimedPlayer('ace', OWNER)
    const row = await propose(ace.id, OWNER, `avatars/${ace.id}/a.webp`)
    await approveAmendment(t.db, fakeStore(), MOD, row.id)

    const [entry] = await t.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'player.approve_amendment'))
    expect(entry).toMatchObject({ actorId: MOD, entityId: String(ace.id) })
  })
})

describe('rejectAmendment', () => {
  it('leaves the published avatar untouched and deletes the refused object', async () => {
    const ace = await claimedPlayer('ace', OWNER)
    const store = fakeStore()
    const published = `avatars/${ace.id}/published.webp`
    await store.put('assets', published, new Uint8Array([1]))
    await t.db
      .update(players)
      .set({ avatarKey: published })
      .where(eq(players.id, ace.id))
    const proposed = `avatars/${ace.id}/proposed.webp`
    await store.put('assets', proposed, new Uint8Array([2]))
    const row = await propose(ace.id, OWNER, proposed)

    await rejectAmendment(t.db, store, MOD, row.id, '  not you  ')

    // Refusing a proposed change is not removing the current one.
    expect(await avatarKeyOf(ace.id)).toBe(published)
    expect(store.objects.has(published)).toBe(true)
    // A rejected image cannot be looked at twice: the reason is the record.
    expect(store.objects.has(proposed)).toBe(false)
    expect(await amendment(row.id)).toMatchObject({
      state: 'rejected',
      reviewedBy: MOD,
      reason: 'not you',
    })
    expect(await loadAmendmentViewer(t.db, OWNER)).toBeNull()
  })

  it('keeps the object when the owner already has that very picture published', async () => {
    // Content-hashed keys: re-uploading the picture you already have lands on
    // the key that is live, and rejecting must not delete what is published.
    const ace = await claimedPlayer('ace', OWNER)
    const store = fakeStore()
    const key = `avatars/${ace.id}/same.webp`
    await store.put('assets', key, new Uint8Array([1]))
    await t.db
      .update(players)
      .set({ avatarKey: key })
      .where(eq(players.id, ace.id))
    const row = await propose(ace.id, OWNER, key)

    await rejectAmendment(t.db, store, MOD, row.id)

    expect(await avatarKeyOf(ace.id)).toBe(key)
    expect(store.objects.has(key)).toBe(true)
  })
})

describe('resolving a row that is no longer pending', () => {
  it('is a benign no-op, not a write', async () => {
    const ace = await claimedPlayer('ace', OWNER)
    const store = fakeStore()
    const proposed = `avatars/${ace.id}/proposed.webp`
    await store.put('assets', proposed, new Uint8Array([2]))
    const row = await propose(ace.id, OWNER, proposed)

    await rejectAmendment(t.db, store, MOD, row.id, 'first')
    // The second Moderator, on the row the first one just resolved.
    expect(await approveAmendment(t.db, store, OTHER, row.id)).toEqual({
      resolved: false,
    })

    expect(await amendment(row.id)).toMatchObject({
      state: 'rejected',
      reviewedBy: MOD,
      reason: 'first',
    })
    expect(await avatarKeyOf(ace.id)).toBeNull()
  })
})

describe('a proposal that outlived its Claim', () => {
  it('is withdrawn by the system rather than approved onto the row', async () => {
    // Deleting an auth User nulls players.user_id by FK without running
    // unclaim(), so this row can exist with nobody behind it.
    const ace = await claimedPlayer('ace', OWNER)
    const store = fakeStore()
    const proposed = `avatars/${ace.id}/proposed.webp`
    await store.put('assets', proposed, new Uint8Array([2]))
    const row = await propose(ace.id, OWNER, proposed)
    await t.db
      .update(players)
      .set({ userId: null })
      .where(eq(players.id, ace.id))

    expect(await approveAmendment(t.db, store, MOD, row.id)).toEqual({
      resolved: false,
    })

    expect(await avatarKeyOf(ace.id)).toBeNull()
    expect(await amendment(row.id)).toMatchObject({
      state: 'withdrawn',
      reviewedBy: null,
      reviewedAt: null,
    })
    expect(store.objects.has(proposed)).toBe(false)
  })
})

describe('loadAmendmentViewer', () => {
  it('overlays nothing onto a Player the viewer no longer holds', async () => {
    // The Claim moved on; the proposal did not follow it. Resolving by User
    // alone would paint their old proposal onto the Player they hold now.
    const ace = await claimedPlayer('ace', OWNER)
    const store = fakeStore()
    await setOwnAvatar(t.db, store, OWNER, ace.id, await pixel())
    await t.db
      .update(players)
      .set({ userId: null })
      .where(eq(players.id, ace.id))
    const floppa = await claimedPlayer('floppa', OWNER)

    expect(await loadAmendmentViewer(t.db, OWNER)).toBeNull()
    expect(await avatarKeyOf(floppa.id)).toBeNull()
  })

  it('resolves nothing for a viewer with nothing in flight', async () => {
    await claimedPlayer('ace', OWNER)
    expect(await loadAmendmentViewer(t.db, OWNER)).toBeNull()
    expect(await loadAmendmentViewer(t.db, OTHER)).toBeNull()
  })
})

/** A tiny real image the upload path can decode. */
async function pixel(): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default
  const buf = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 1, g: 2, b: 3 },
    },
  })
    .png()
    .toBuffer()
  return new Uint8Array(buf)
}
