import { desc, eq, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { auditLog, profiles } from '#/db/schema'
import { ADMIN_PAGE_SIZE } from '#/components/admin/pager'

/* One row per logical moderator action, written inside the same transaction
   as the write it describes. Only /admin writes are audited. */

export interface AuditDiff {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  context?: Record<string, unknown>
}

/* What comes back OUT of the jsonb column — plain JSON, typed so server-fn
   results stay serializable. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface AuditDiffView {
  before?: Record<string, JsonValue>
  after?: Record<string, JsonValue>
  context?: Record<string, JsonValue>
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
  const limit = opts.limit ?? ADMIN_PAGE_SIZE
  const offset = opts.offset ?? 0
  const where = opts.entity ? eq(auditLog.entity, opts.entity) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db
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
      .where(where)
      .orderBy(desc(auditLog.id))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ])
  return {
    rows: rows
      .slice(0, limit)
      .map((r) => ({ ...r, diff: r.diff as AuditDiffView | null })),
    hasMore: rows.length > limit,
    total,
  }
}
