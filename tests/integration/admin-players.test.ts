import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { freshDb } from './pglite'
import type { TestDb } from './pglite'
import { seed } from '#/db/seed'
import { playerAliases, players, records } from '#/db/schema'
import {
  addAlias,
  getAdminPlayer,
  listAdminPlayers,
  mergePlayers,
  removeAlias,
  renamePlayer,
  searchAdminPlayers,
} from '#/admin/players'
import { listAudit } from '#/admin/audit'

const MOD = '00000000-0000-4000-8000-000000000001'
const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'

let t: TestDb

beforeEach(async () => {
  t = await freshDb()
  await seed(t.db)
  for (const id of [MOD, USER_A, USER_B]) {
    await t.client.query('insert into auth.users (id) values ($1)', [id])
  }
})
afterEach(async () => {
  await t.client.close()
})

async function playerBySlug(slug: string) {
  const [p] = await t.db.select().from(players).where(eq(players.slug, slug))
  return p
}

describe('renamePlayer', () => {
  it('updates the display name and drops the old one to a display alias', async () => {
    const ace = await playerBySlug('ace')
    await renamePlayer(t.db, MOD, ace.id, 'AceOfSpades')

    const renamed = await playerBySlug('ace')
    expect(renamed.displayName).toBe('AceOfSpades')
    expect(renamed.slug).toBe('ace') // slug is the stable public URL

    const aliases = await t.db
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, ace.id))
    const dropped = aliases.find(
      (a) => a.name === 'Ace' && a.kind === 'display',
    )
    expect(dropped).toBeDefined()

    const audit = await listAudit(t.db, { entity: 'player' })
    const row = audit.rows.find((r) => r.action === 'player.rename')!
    expect(row.diff).toMatchObject({
      before: { displayName: 'Ace' },
      after: { displayName: 'AceOfSpades' },
    })
  })

  it('rejects an empty name and a no-op rename', async () => {
    const ace = await playerBySlug('ace')
    await expect(renamePlayer(t.db, MOD, ace.id, '  ')).rejects.toThrow()
    await expect(renamePlayer(t.db, MOD, ace.id, 'Ace')).rejects.toThrow()
  })
})

describe('aliases', () => {
  it('adds and removes aliases with audit rows', async () => {
    const ace = await playerBySlug('ace')
    const added = await addAlias(t.db, MOD, ace.id, 'Ace_TV')
    expect(added.name).toBe('Ace_TV')

    await removeAlias(t.db, MOD, added.id)
    const aliases = await t.db
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, ace.id))
    expect(aliases.map((a) => a.name)).not.toContain('Ace_TV')

    const audit = await listAudit(t.db, { entity: 'player' })
    const actions = audit.rows.map((r) => r.action)
    expect(actions).toContain('player.add_alias')
    expect(actions).toContain('player.remove_alias')
  })

  it('refuses a duplicate alias', async () => {
    const ace = await playerBySlug('ace')
    await expect(addAlias(t.db, MOD, ace.id, 'Ace')).rejects.toThrow()
  })
})

describe('mergePlayers', () => {
  it('repoints records, moves aliases, tombstones the duplicate', async () => {
    const ace = await playerBySlug('ace') // survivor
    const floppa = await playerBySlug('floppa') // duplicate
    const floppaRecords = await t.db
      .select({ id: records.id, ignSnapshot: records.ignSnapshot })
      .from(records)
      .where(eq(records.playerId, floppa.id))
    expect(floppaRecords.length).toBeGreaterThan(0)

    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: floppa.id,
    })

    // records repointed, snapshots untouched:
    for (const r of floppaRecords) {
      const [row] = await t.db
        .select()
        .from(records)
        .where(eq(records.id, r.id))
      expect(row.playerId).toBe(ace.id)
      expect(row.ignSnapshot).toBe(r.ignSnapshot)
    }

    // aliases moved + duplicate's display name became a survivor alias:
    const aceAliases = await t.db
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, ace.id))
      .orderBy(asc(playerAliases.id))
    expect(aceAliases.map((a) => a.name)).toContain('Floppa')

    // tombstone:
    const tomb = await playerBySlug('floppa')
    expect(tomb.mergedInto).toBe(ace.id)
    const tombAliases = await t.db
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, floppa.id))
    expect(tombAliases).toHaveLength(0)

    // one audit row with the before-state:
    const audit = await listAudit(t.db, { entity: 'player' })
    const merges = audit.rows.filter((r) => r.action === 'player.merge')
    expect(merges).toHaveLength(1)
    expect(merges[0].diff).toMatchObject({
      context: { survivorId: ace.id, duplicateId: floppa.id },
    })
  })

  it('refuses when both players are claimed by different users', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    await t.db
      .update(players)
      .set({ userId: USER_A })
      .where(eq(players.id, ace.id))
    await t.db
      .update(players)
      .set({ userId: USER_B })
      .where(eq(players.id, floppa.id))
    await expect(
      mergePlayers(t.db, MOD, { survivorId: ace.id, duplicateId: floppa.id }),
    ).rejects.toThrow(/claim/i)
  })

  it('merges same-user claims and carries a lone claim to the survivor', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    await t.db
      .update(players)
      .set({ userId: USER_A })
      .where(eq(players.id, floppa.id))
    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: floppa.id,
    })
    expect((await playerBySlug('ace')).userId).toBe(USER_A)
    expect((await playerBySlug('floppa')).userId).toBeNull()
  })

  it('refuses self-merge and re-merge of a tombstone', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    const maverick = await playerBySlug('maverick')
    await expect(
      mergePlayers(t.db, MOD, { survivorId: ace.id, duplicateId: ace.id }),
    ).rejects.toThrow()
    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: floppa.id,
    })
    await expect(
      mergePlayers(t.db, MOD, {
        survivorId: maverick.id,
        duplicateId: floppa.id,
      }),
    ).rejects.toThrow(/merged/i)
    await expect(
      mergePlayers(t.db, MOD, {
        survivorId: floppa.id,
        duplicateId: maverick.id,
      }),
    ).rejects.toThrow(/merged/i)
  })

  it('keeps tombstones one hop deep across successive merges', async () => {
    const ace = await playerBySlug('ace')
    const maverick = await playerBySlug('maverick')
    const floppa = await playerBySlug('floppa')
    await mergePlayers(t.db, MOD, {
      survivorId: maverick.id,
      duplicateId: floppa.id,
    })
    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: maverick.id,
    })
    expect((await playerBySlug('floppa')).mergedInto).toBe(ace.id)
    expect((await playerBySlug('maverick')).mergedInto).toBe(ace.id)
  })

  it('skips alias moves that would duplicate an existing survivor alias', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    // Give both players the same alias name+kind:
    await addAlias(t.db, MOD, ace.id, 'SharedName')
    await addAlias(t.db, MOD, floppa.id, 'SharedName')
    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: floppa.id,
    })
    const aceAliases = await t.db
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, ace.id))
    expect(
      aceAliases.filter((a) => a.name === 'SharedName' && a.kind === 'ign'),
    ).toHaveLength(1)
  })
})

describe('admin player reads', () => {
  it('searchAdminPlayers matches display names and aliases, skips tombstones', async () => {
    const ace = await playerBySlug('ace')
    await addAlias(t.db, MOD, ace.id, 'TheSpade')
    const byAlias = await searchAdminPlayers(t.db, 'spade')
    expect(byAlias.map((p) => p.slug)).toContain('ace')

    const floppa = await playerBySlug('floppa')
    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: floppa.id,
    })
    const gone = await searchAdminPlayers(t.db, 'floppa')
    expect(gone.map((p) => p.slug)).not.toContain('floppa')
  })

  it('listAdminPlayers reports counts and claims, excluding tombstones', async () => {
    const ace = await playerBySlug('ace')
    const floppa = await playerBySlug('floppa')
    await mergePlayers(t.db, MOD, {
      survivorId: ace.id,
      duplicateId: floppa.id,
    })

    const list = await listAdminPlayers(t.db, {})
    const slugs = list.rows.map((p) => p.slug)
    expect(slugs).toContain('ace')
    expect(slugs).not.toContain('floppa')
    const aceRow = list.rows.find((p) => p.slug === 'ace')!
    expect(aceRow.recordCount).toBeGreaterThanOrEqual(3)
  })

  it('getAdminPlayer returns aliases, records and the last IGN for prefill', async () => {
    const ace = await playerBySlug('ace')
    const detail = await getAdminPlayer(t.db, ace.id)
    expect(detail!.player.slug).toBe('ace')
    expect(detail!.aliases.length).toBeGreaterThan(0)
    expect(detail!.records.length).toBeGreaterThan(0)
    expect(detail!.lastIgn).toBe('Ace')
  })
})
