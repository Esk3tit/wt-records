import { and, eq } from 'drizzle-orm'
import type { Db } from '#/db'
import { playerAliases, players } from '#/db/schema'
import { slugify } from '#/lib/slug'
import { writeAudit } from '#/admin/audit'

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
  await tx.insert(playerAliases).values({
    playerId,
    name: ign,
    kind: 'ign',
    source: 'submission',
  })
  return true
}
