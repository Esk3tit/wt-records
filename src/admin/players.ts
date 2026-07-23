import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import type { Db } from '#/db'
import {
  playerAliases,
  playerClaims,
  players,
  records,
  vehicles,
} from '#/db/schema'
import { slugify } from '#/lib/slug'
import { likeContains } from '#/lib/like'
import { writeAudit } from '#/admin/audit'
import { ADMIN_PAGE_SIZE } from '#/lib/paging'

export async function uniquePlayerSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name) || 'player'
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const existing = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.slug, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
  }
}

export async function createPlayer(
  tx: Db,
  actorId: string,
  displayName: string,
): Promise<{ id: number; slug: string; displayName: string }> {
  const name = displayName.trim()
  if (!name) throw new Error('Player display name is required')
  const slug = await uniquePlayerSlug(tx, name)
  const [row] = await tx
    .insert(players)
    .values({ slug, displayName: name })
    .returning({
      id: players.id,
      slug: players.slug,
      displayName: players.displayName,
    })
  await writeAudit(tx, {
    actorId,
    action: 'player.create',
    entity: 'player',
    entityId: row.id,
    diff: { after: { displayName: name, slug } },
  })
  return row
}

/** Auto-adds an unknown IGN as a submission alias; a known name only gets its
    lastSeen bumped. Returns whether a new alias row was created. */
export async function recordIgnAlias(
  tx: Db,
  playerId: number,
  ign: string,
): Promise<boolean> {
  const existing = await tx
    .select({ id: playerAliases.id })
    .from(playerAliases)
    .where(
      and(eq(playerAliases.playerId, playerId), eq(playerAliases.name, ign)),
    )
    .limit(1)
  if (existing.length > 0) {
    await tx
      .update(playerAliases)
      .set({ lastSeen: new Date() })
      .where(eq(playerAliases.id, existing[0].id))
    return false
  }
  // Upsert on alias_uq: a racing insert of the same alias becomes a
  // lastSeen bump instead of aborting the whole record transaction.
  await tx
    .insert(playerAliases)
    .values({
      playerId,
      name: ign,
      kind: 'ign',
      source: 'submission',
    })
    .onConflictDoUpdate({
      target: [playerAliases.playerId, playerAliases.name, playerAliases.kind],
      set: { lastSeen: new Date() },
    })
  return true
}

async function aliasExists(
  db: Db,
  playerId: number,
  name: string,
  kind: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: playerAliases.id })
    .from(playerAliases)
    .where(
      and(
        eq(playerAliases.playerId, playerId),
        eq(playerAliases.name, name),
        eq(playerAliases.kind, kind),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export async function renamePlayer(
  db: Db,
  actorId: string,
  playerId: number,
  newName: string,
) {
  const name = newName.trim()
  if (!name) throw new Error('Player display name is required')
  return db.transaction(async (tx) => {
    // Locked read: a concurrent merge holds this row FOR UPDATE, so the
    // tombstone check runs against the merge's committed state, not before it.
    const player = (
      await tx
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    if (!player) throw new Error(`Unknown player ${playerId}`)
    if (player.mergedInto != null) {
      throw new Error('This player was merged — edit the surviving player')
    }
    if (player.displayName === name) {
      throw new Error('The player is already named that')
    }
    await tx
      .update(players)
      .set({ displayName: name })
      .where(eq(players.id, playerId))

    // The old display name auto-drops to an alias ("previously known as").
    let aliasAdded = false
    if (!(await aliasExists(tx, playerId, player.displayName, 'display'))) {
      await tx.insert(playerAliases).values({
        playerId,
        name: player.displayName,
        kind: 'display',
        source: 'moderation',
      })
      aliasAdded = true
    }
    await writeAudit(tx, {
      actorId,
      action: 'player.rename',
      entity: 'player',
      entityId: playerId,
      diff: {
        before: { displayName: player.displayName },
        after: { displayName: name },
        context: { ...(aliasAdded && { aliasAdded: player.displayName }) },
      },
    })
    return { displayName: name }
  })
}

export async function addAlias(
  db: Db,
  actorId: string,
  playerId: number,
  name: string,
  kind: 'ign' | 'display' = 'ign',
) {
  const alias = name.trim()
  if (!alias) throw new Error('An alias name is required')
  return db.transaction(async (tx) => {
    const player = (
      await tx
        .select({ id: players.id, mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
    ).at(0)
    if (!player) throw new Error(`Unknown player ${playerId}`)
    if (player.mergedInto != null) {
      throw new Error('This player was merged — edit the surviving player')
    }
    if (await aliasExists(tx, playerId, alias, kind)) {
      throw new Error('That alias already exists for this player')
    }
    const [row] = await tx
      .insert(playerAliases)
      .values({ playerId, name: alias, kind, source: 'moderation' })
      .returning()
    await writeAudit(tx, {
      actorId,
      action: 'player.add_alias',
      entity: 'player',
      entityId: playerId,
      diff: { after: { name: alias, kind } },
    })
    return row
  })
}

export async function removeAlias(db: Db, actorId: string, aliasId: number) {
  return db.transaction(async (tx) => {
    const alias = (
      await tx.select().from(playerAliases).where(eq(playerAliases.id, aliasId))
    ).at(0)
    if (!alias) throw new Error(`Unknown alias ${aliasId}`)
    const owner = (
      await tx
        .select({ mergedInto: players.mergedInto })
        .from(players)
        .where(eq(players.id, alias.playerId))
        .for('update')
    ).at(0)
    if (!owner) throw new Error(`Unknown player ${alias.playerId}`)
    if (owner.mergedInto != null) {
      throw new Error('This player was merged — edit the surviving player')
    }
    await tx.delete(playerAliases).where(eq(playerAliases.id, aliasId))
    await writeAudit(tx, {
      actorId,
      action: 'player.remove_alias',
      entity: 'player',
      entityId: alias.playerId,
      diff: {
        before: { name: alias.name, kind: alias.kind, source: alias.source },
      },
    })
  })
}

/* ── Merge (survivor ← duplicate), one transaction ───────────── */

export async function mergePlayers(
  db: Db,
  actorId: string,
  input: { survivorId: number; duplicateId: number },
) {
  if (input.survivorId === input.duplicateId) {
    throw new Error('A player cannot be merged into itself')
  }
  return db.transaction(async (tx) => {
    // One id-ordered FOR UPDATE query: opposite-direction merges acquire the
    // same locks in the same order, so they queue instead of deadlocking.
    const locked = await tx
      .select()
      .from(players)
      .where(inArray(players.id, [input.survivorId, input.duplicateId]))
      .orderBy(asc(players.id))
      .for('update')
    const survivor = locked.find((p) => p.id === input.survivorId)
    const duplicate = locked.find((p) => p.id === input.duplicateId)
    if (!survivor || !duplicate) throw new Error('Unknown player')
    if (survivor.mergedInto != null || duplicate.mergedInto != null) {
      throw new Error('Already-merged players cannot take part in a merge')
    }
    // Two claims by different Users are two people — refuse.
    if (
      survivor.userId != null &&
      duplicate.userId != null &&
      survivor.userId !== duplicate.userId
    ) {
      throw new Error(
        'Both players are claimed by different users — merging would collapse two people',
      )
    }

    const dupAliases = await tx
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, duplicate.id))
    const repointed = await tx
      .update(records)
      .set({ playerId: survivor.id })
      .where(eq(records.playerId, duplicate.id))
      .returning({ id: records.id })

    // Move aliases in two batched writes; (name, kind) pairs the survivor
    // already has are dropped instead (alias_uq would reject the move).
    const survivorAliases = await tx
      .select({ name: playerAliases.name, kind: playerAliases.kind })
      .from(playerAliases)
      .where(eq(playerAliases.playerId, survivor.id))
    const taken = new Set(survivorAliases.map((a) => `${a.kind}\0${a.name}`))
    const dropIds: number[] = []
    const moveIds: number[] = []
    for (const alias of dupAliases) {
      ;(taken.has(`${alias.kind}\0${alias.name}`) ? dropIds : moveIds).push(
        alias.id,
      )
    }
    if (dropIds.length > 0) {
      await tx.delete(playerAliases).where(inArray(playerAliases.id, dropIds))
    }
    if (moveIds.length > 0) {
      await tx
        .update(playerAliases)
        .set({ playerId: survivor.id })
        .where(inArray(playerAliases.id, moveIds))
    }
    // The duplicate's display name becomes a survivor alias.
    if (
      !(await aliasExists(tx, survivor.id, duplicate.displayName, 'display'))
    ) {
      await tx.insert(playerAliases).values({
        playerId: survivor.id,
        name: duplicate.displayName,
        kind: 'display',
        source: 'moderation',
      })
    }

    // The survivor keeps or gains the lone/same-user claim (different-user was
    // refused above). The avatar of whichever side actually held the claim
    // rides along — preferring the survivor's own — so identity survives.
    const carriedUserId = survivor.userId ?? duplicate.userId
    const survivorAvatar = survivor.userId != null ? survivor.avatarKey : null
    const duplicateAvatar =
      duplicate.userId != null ? duplicate.avatarKey : null
    const finalAvatar =
      carriedUserId != null ? (survivorAvatar ?? duplicateAvatar) : null
    if (carriedUserId != null) {
      await tx
        .update(players)
        .set({ userId: carriedUserId, avatarKey: finalAvatar })
        .where(eq(players.id, survivor.id))
    }
    // The duplicate's avatar object is orphaned when it isn't the one carried
    // onto the survivor — hand it back so the caller can clean R2.
    const orphanedAvatarKey =
      duplicate.avatarKey && duplicate.avatarKey !== finalAvatar
        ? duplicate.avatarKey
        : null
    // Drop pending claims that can no longer resolve: the duplicate's (it
    // becomes a tombstone) and, when the survivor ends up claimed, its own —
    // approve would reject them — so the moderation queue stays clean.
    const clearClaimsFor =
      carriedUserId != null ? [duplicate.id, survivor.id] : [duplicate.id]
    await tx
      .delete(playerClaims)
      .where(inArray(playerClaims.playerId, clearClaimsFor))
    await tx
      .update(players)
      .set({ mergedInto: survivor.id, userId: null, avatarKey: null })
      .where(eq(players.id, duplicate.id))
    // Keep tombstones one hop deep: anything merged into the duplicate
    // earlier now points straight at the survivor.
    await tx
      .update(players)
      .set({ mergedInto: survivor.id })
      .where(eq(players.mergedInto, duplicate.id))

    await writeAudit(tx, {
      actorId,
      action: 'player.merge',
      entity: 'player',
      entityId: survivor.id,
      diff: {
        before: {
          duplicate: {
            id: duplicate.id,
            slug: duplicate.slug,
            displayName: duplicate.displayName,
            userId: duplicate.userId,
          },
          aliases: dupAliases.map((a) => ({ name: a.name, kind: a.kind })),
          recordIds: repointed.map((r) => r.id),
        },
        context: {
          survivorId: survivor.id,
          duplicateId: duplicate.id,
        },
      },
    })
    return { repointedRecords: repointed.length, orphanedAvatarKey }
  })
}

/* ── Admin reads ─────────────────────────────────────────────── */

export async function searchAdminPlayers(db: Db, q: string, limit = 10) {
  const term = q.trim()
  if (!term) return []
  const like = likeContains(term)
  return db
    .select({
      id: players.id,
      slug: players.slug,
      displayName: players.displayName,
    })
    .from(players)
    .leftJoin(playerAliases, eq(playerAliases.playerId, players.id))
    .where(
      and(
        isNull(players.mergedInto),
        or(ilike(players.displayName, like), ilike(playerAliases.name, like)),
      ),
    )
    .groupBy(players.id)
    .orderBy(asc(players.displayName))
    .limit(limit)
}

export async function listAdminPlayers(
  db: Db,
  opts: { q?: string; limit?: number; offset?: number },
) {
  const limit = opts.limit ?? ADMIN_PAGE_SIZE
  const offset = opts.offset ?? 0
  const conds = [isNull(players.mergedInto)]
  if (opts.q?.trim()) {
    const like = likeContains(opts.q.trim())
    conds.push(ilike(players.displayName, like))
  }
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: players.id,
        slug: players.slug,
        displayName: players.displayName,
        userId: players.userId,
        recordCount: sql<number>`count(distinct ${records.id})::int`,
        aliasCount: sql<number>`count(distinct ${playerAliases.id})::int`,
      })
      .from(players)
      .leftJoin(records, eq(records.playerId, players.id))
      .leftJoin(playerAliases, eq(playerAliases.playerId, players.id))
      .where(and(...conds))
      .groupBy(players.id)
      .orderBy(asc(players.displayName))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(players)
      .where(and(...conds)),
  ])
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit, total }
}

export async function getAdminPlayer(db: Db, playerId: number) {
  const player = (
    await db.select().from(players).where(eq(players.id, playerId))
  ).at(0)
  if (!player) return null

  const [aliases, recs] = await Promise.all([
    db
      .select()
      .from(playerAliases)
      .where(eq(playerAliases.playerId, playerId))
      .orderBy(asc(playerAliases.firstSeen), asc(playerAliases.id)),
    db
      .select({
        id: records.id,
        mode: records.mode,
        kills: records.kills,
        status: records.status,
        isCurrent: records.isCurrent,
        ignSnapshot: records.ignSnapshot,
        verifiedAt: records.verifiedAt,
        submittedAt: records.submittedAt,
        vehicleName: vehicles.name,
        vehicleSlug: vehicles.slug,
      })
      .from(records)
      .innerJoin(vehicles, eq(vehicles.id, records.vehicleId))
      .where(eq(records.playerId, playerId))
      .orderBy(
        sql`coalesce(${records.verifiedAt}, ${records.submittedAt}) desc nulls last`,
        desc(records.id),
      ),
  ])

  return {
    player,
    aliases,
    records: recs,
    lastIgn: recs[0]?.ignSnapshot ?? player.displayName,
  }
}
