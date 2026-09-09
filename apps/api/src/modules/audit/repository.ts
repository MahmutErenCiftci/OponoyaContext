import { auditEntityTypeSchema, type AuditEntityType, type AuditEvent } from "@devcontext/contracts";
import { and, auditEvents, desc, eq, type Database } from "@devcontext/db";

/** Primitive-only metadata keeps names, notes, URLs and prompt text out of the trail by construction. */
export type AuditMetadataValue = string | number | boolean | null;
export type AuditMetadata = Record<string, AuditMetadataValue | AuditMetadataValue[]>;

export type AuditEventInput = {
  actorUserId: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  metadata: AuditMetadata;
  requestId: string | null;
};

export type AuditListQuery = {
  entityType?: AuditEntityType | undefined;
  entityId?: string | undefined;
  limit: number;
};

/** Append-only: there is deliberately no update or delete. */
export interface AuditRepository {
  record(input: AuditEventInput): Promise<void>;
  list(actorUserId: string, query: AuditListQuery): Promise<AuditEvent[]>;
}

export function createAuditRepository(database: Pick<Database, "db">): AuditRepository {
  return {
    async record(input) {
      await database.db.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        requestId: input.requestId,
      });
    },

    async list(actorUserId, query) {
      const conditions = [eq(auditEvents.actorUserId, actorUserId)];
      if (query.entityType) conditions.push(eq(auditEvents.entityType, query.entityType));
      if (query.entityId) conditions.push(eq(auditEvents.entityId, query.entityId));
      const rows = await database.db
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(query.limit);
      return rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: auditEntityTypeSchema.parse(row.entityType),
        entityId: row.entityId,
        metadata: row.metadata,
        requestId: row.requestId,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}
