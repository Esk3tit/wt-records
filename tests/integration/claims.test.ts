import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import {
  auditLog,
  playerAmendments,
  playerClaims,
  players,
  profiles,
} from '#/db/schema'
import {
  approveClaim,
  clearClaimDenial,
  denyClaim,
  listDeniedClaims,
  listPendingClaims,
  requestClaim,
  revokeClaim,
  viewerClaimState,
} from '#/claims/claims'

const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'
const MOD = '00000000-0000-4000-8000-00000000000c'

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

async function auditRows() {
  return t.db.select().from(auditLog).orderBy(asc(auditLog.id))
}

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const [id, handle, discord] of [
    [USER_A, 'AceIRL', '111'],
    [USER_B, 'Rival', '222'],
    [MOD, 'Warden', '333'],
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

    expect(await viewerClaimState(t.db, USER_A, ace.id)).toBe('pending')
    expect(await viewerClaimState(t.db, USER_B, ace.id)).toBe('none')

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

  it('refuses a second request while one is already awaiting review', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    await requestClaim(t.db, USER_A, ace.id, {})

    await expect(requestClaim(t.db, USER_A, floppa.id, {})).rejects.toThrow(
      /awaiting review/i,
    )
    // The rule is per User, not per Player: a rival is untouched by it.
    await expect(
      requestClaim(t.db, USER_B, floppa.id, {}),
    ).resolves.toBeDefined()
  })

  it('refuses a request from a User who already holds a claim, plainly', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, null, MOD, id)

    await expect(requestClaim(t.db, USER_A, floppa.id, {})).rejects.toThrow(
      /already hold the claim on Ace/i,
    )
  })

  it('refuses a re-file of a denied request for the same player, forever', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await denyClaim(t.db, MOD, id)

    await expect(requestClaim(t.db, USER_A, ace.id, {})).rejects.toThrow(
      /denied/i,
    )
    expect(await viewerClaimState(t.db, USER_A, ace.id)).toBe('denied')
    // Denied on one player is not denied on the site: another remains open.
    const floppa = await playerBySlug('floppa')
    await expect(
      requestClaim(t.db, USER_A, floppa.id, {}),
    ).resolves.toBeDefined()
  })
})

describe('approveClaim', () => {
  it('links the user and clears every pending request on the player', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await requestClaim(t.db, USER_B, ace.id, {}) // a rival also wants it

    const result = await approveClaim(t.db, null, MOD, id)
    expect(result).toMatchObject({ playerId: ace.id, avatarSeeded: false })
    expect((await playerBySlug('ace')).userId).toBe(USER_A)

    const remaining = await t.db
      .select()
      .from(playerClaims)
      .where(eq(playerClaims.playerId, ace.id))
    expect(remaining).toHaveLength(0)
  })

  it('spares the denials on that player — approving is not an amnesty', async () => {
    const ace = await playerBySlug('ace')
    const rejected = await requestClaim(t.db, USER_B, ace.id, {})
    await denyClaim(t.db, MOD, rejected.id)
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})

    await approveClaim(t.db, null, MOD, id)
    expect(await viewerClaimState(t.db, USER_B, ace.id)).toBe('denied')
  })

  it('seeds the avatar from the provider picture when asked', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    const result = await approveClaim(t.db, store, MOD, id, {
      fetchImpl: pngFetch,
    })
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
    const result = await approveClaim(t.db, store, MOD, id, {
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
    await expect(approveClaim(t.db, null, MOD, id)).rejects.toThrow(
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
    await approveClaim(t.db, store, MOD, id)

    expect((await playerBySlug('ace')).avatarKey).toBeNull()
    expect(store.objects.has(staleKey)).toBe(false)
  })

  it('rejects an off-host seed URL at the fetch boundary (SSRF backstop)', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://evil.example.com/x.png',
    })
    const result = await approveClaim(t.db, store, MOD, id, {
      fetchImpl: pngFetch,
    })
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
    const result = await approveClaim(t.db, store, MOD, id, {
      fetchImpl: hugeFetch,
    })
    expect(result.avatarSeeded).toBe(false)
    expect(store.objects.size).toBe(0)
  })
})

describe('denyClaim', () => {
  it('marks the request denied, keeps it, and leaves the player untouched', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await denyClaim(t.db, MOD, id)

    expect(await viewerClaimState(t.db, USER_A, ace.id)).toBe('denied')
    expect((await playerBySlug('ace')).userId).toBeNull()
    const [row] = await t.db
      .select()
      .from(playerClaims)
      .where(eq(playerClaims.id, id))
    expect(row).toMatchObject({ state: 'denied', decidedBy: MOD })
    expect(row.decidedAt).toBeInstanceOf(Date)

    await expect(denyClaim(t.db, MOD, id)).rejects.toThrow(/already resolved/i)
  })

  it('keeps denied rows out of the queue a moderator works from', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await requestClaim(t.db, USER_B, floppa.id, {})
    await denyClaim(t.db, MOD, id)

    expect((await listPendingClaims(t.db)).map((c) => c.playerId)).toEqual([
      floppa.id,
    ])
    expect((await listDeniedClaims(t.db)).rows).toMatchObject([
      {
        playerId: ace.id,
        requesterHandle: 'AceIRL',
        decidedByHandle: 'Warden',
      },
    ])
  })

  it('refuses to deny a claim that no longer exists', async () => {
    await expect(denyClaim(t.db, MOD, 9999)).rejects.toThrow(/unknown/i)
  })

  it('records an optional reason for whoever weighs the clear', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const withReason = await requestClaim(t.db, USER_A, ace.id, {})
    await denyClaim(t.db, MOD, withReason.id, '  no proof they are Ace  ')
    const without = await requestClaim(t.db, USER_B, floppa.id, {})
    await denyClaim(t.db, MOD, without.id)

    const { rows } = await listDeniedClaims(t.db)
    expect(rows.map((r) => r.decidedReason).sort()).toEqual([
      'no proof they are Ace',
      null,
    ])
    const audit = await auditRows()
    expect(audit.at(0)?.diff).toMatchObject({
      context: { reason: 'no proof they are Ace' },
    })
  })
})

describe('clearClaimDenial', () => {
  it('re-opens the pair a denial closed, and only ever a denial', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await expect(clearClaimDenial(t.db, MOD, id)).rejects.toThrow(/denied/i)

    await denyClaim(t.db, MOD, id)
    await clearClaimDenial(t.db, MOD, id)

    expect((await listDeniedClaims(t.db)).rows).toHaveLength(0)
    expect(await viewerClaimState(t.db, USER_A, ace.id)).toBe('none')
    await expect(requestClaim(t.db, USER_A, ace.id, {})).resolves.toBeDefined()
  })
})

describe('revokeClaim', () => {
  it('severs the claim, resets the avatar, and refuses an unclaimed player', async () => {
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    await approveClaim(t.db, store, MOD, id, { fetchImpl: pngFetch })
    const key = (await playerBySlug('ace')).avatarKey!

    await revokeClaim(t.db, store, MOD, ace.id, 'asked to leave')
    const severed = await playerBySlug('ace')
    expect(severed.userId).toBeNull()
    expect(severed.avatarKey).toBeNull()
    expect(severed.countryCode).toBeNull()
    expect(store.objects.has(key)).toBe(false)

    await expect(
      revokeClaim(t.db, store, MOD, ace.id, 'again'),
    ).rejects.toThrow(/not claimed/i)
  })

  it('keeps the avatar object if another player still references its key', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {
      seedAvatarUrl: 'https://cdn.discordapp.com/avatars/1/x.png',
    })
    await approveClaim(t.db, store, MOD, id, { fetchImpl: pngFetch })
    const key = (await playerBySlug('ace')).avatarKey!
    // A concurrent re-claim reused the same content-hash key on another player.
    await t.db
      .update(players)
      .set({ userId: USER_B, avatarKey: key })
      .where(eq(players.id, floppa.id))

    await revokeClaim(t.db, store, MOD, ace.id, 'impersonation')
    expect(store.objects.has(key)).toBe(true)
  })

  it('withdraws a proposal in flight, rather than rejecting it', async () => {
    // `rejected` would inflate the very count a Moderator reads, and nothing
    // about this proposal was refused — the Claim behind it simply ended.
    const ace = await playerBySlug('ace')
    const store = fakeStore()
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, store, MOD, id)
    const proposed = `avatars/${ace.id}/proposed.webp`
    await store.put('assets', proposed, new Uint8Array([2]))
    await t.db.insert(playerAmendments).values({
      playerId: ace.id,
      field: 'avatar',
      value: proposed,
      submittedBy: USER_A,
    })

    await revokeClaim(t.db, store, MOD, ace.id, 'impersonation')

    const [amendment] = await t.db
      .select()
      .from(playerAmendments)
      .where(eq(playerAmendments.playerId, ace.id))
    expect(amendment).toMatchObject({
      state: 'withdrawn',
      reviewedBy: null,
      reviewedAt: null,
    })
    expect(store.objects.has(proposed)).toBe(false)
  })

  it('demands a reason, since the reason is what tells the three cases apart', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, null, MOD, id)

    await expect(revokeClaim(t.db, null, MOD, ace.id, '  ')).rejects.toThrow(
      /reason/i,
    )
    expect((await playerBySlug('ace')).userId).toBe(USER_A)
  })

  it('frees the player, and leaves the user free to claim another', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, null, MOD, id)
    await revokeClaim(t.db, null, MOD, ace.id, 'wrong person')

    await expect(
      requestClaim(t.db, USER_A, floppa.id, {}),
    ).resolves.toBeDefined()
    // The freed player is claimable by someone else, immediately.
    await expect(requestClaim(t.db, USER_B, ace.id, {})).resolves.toBeDefined()
  })
})

describe('the audit trail', () => {
  it('writes exactly one player row per decision, against the player id', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')

    const denied = await requestClaim(t.db, USER_B, ace.id, {})
    await denyClaim(t.db, MOD, denied.id)
    const approved = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, null, MOD, approved.id)
    await revokeClaim(t.db, null, MOD, ace.id, 'sold the account')
    const cleared = await requestClaim(t.db, USER_B, floppa.id, {})
    await denyClaim(t.db, MOD, cleared.id)
    await clearClaimDenial(t.db, MOD, cleared.id)

    const rows = await auditRows()
    expect(rows.map((r) => r.action)).toEqual([
      'player.deny_claim',
      'player.approve_claim',
      'player.revoke_claim',
      'player.deny_claim',
      'player.clear_denial',
    ])
    for (const row of rows) {
      expect(row.entity).toBe('player')
      expect(row.actorId).toBe(MOD)
    }
    expect(rows.map((r) => r.entityId)).toEqual([
      String(ace.id),
      String(ace.id),
      String(ace.id),
      String(floppa.id),
      String(floppa.id),
    ])
  })

  it('records the moderator’s reason on a revoke', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await approveClaim(t.db, null, MOD, id)
    await revokeClaim(t.db, null, MOD, ace.id, '  impersonating a holder  ')

    const [revoke] = (await auditRows()).filter(
      (r) => r.action === 'player.revoke_claim',
    )
    expect(revoke.diff).toMatchObject({
      before: { userId: USER_A },
      context: { reason: 'impersonating a holder' },
    })
  })

  it('leaves no audit row behind when the decision itself fails', async () => {
    const ace = await playerBySlug('ace')
    const { id } = await requestClaim(t.db, USER_A, ace.id, {})
    await t.db
      .update(players)
      .set({ userId: USER_B })
      .where(eq(players.id, ace.id))

    await expect(approveClaim(t.db, null, MOD, id)).rejects.toThrow()
    expect(await auditRows()).toHaveLength(0)
  })
})

describe('release', () => {
  it('is gone from the codebase, not merely unrouted', async () => {
    const claims = await import('#/claims/claims')
    expect(claims).not.toHaveProperty('releaseClaim')

    // The module check can only see what it can import; the sweep is what
    // proves no route, component or server fn still names either of them.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
          walk(path)
        } else if (/\.tsx?$/.test(path)) {
          if (/\brelease(My)?Claim\b/.test(readFileSync(path, 'utf8'))) {
            offenders.push(path)
          }
        }
      }
    }
    for (const dir of ['src', 'e2e']) walk(dir)
    expect(offenders).toEqual([])
  })
})
