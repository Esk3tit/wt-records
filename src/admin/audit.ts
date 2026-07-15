import { desc, eq } from 'drizzle-orm'
import type { Db } from '#/db'
import { auditLog, profiles } from '#/db/schema'

/* One row per logical moderator action, written inside the same transaction
   as the write it describes (ADR 0008). Only /admin writes are audited. */

export interface AuditDiff {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type AuditEntity = 'record' | 'player' | 'vehicle' | 'rules' | 'patch'

export async function writeAudit(
  tx: Db,
  entry: {
    actorId: string
    action: string
    entity: AuditEntity
    entityId: string | number | null
    diff?: AuditDiff
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId == null ? null : String(entry.entityId),
    diff: entry.diff ?? null,
  })
}

export async function listAudit(
  db: Db,
  opts: { entity?: AuditEntity; limit?: number; offset?: number },
) {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const rows = await db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorHandle: profiles.handle,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      diff: auditLog.diff,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
    .where(opts.entity ? eq(auditLog.entity, opts.entity) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(limit + 1)
    .offset(offset)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}
