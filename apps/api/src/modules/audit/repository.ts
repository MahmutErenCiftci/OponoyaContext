import { auditEntityTypeSchema, type AuditEntityType, type AuditEvent, type AuditPresence } from "@devcontext/contracts";
import { and, auditEvents, desc, eq, inArray, ne, readAll, type Database } from "@devcontext/db";

/** Recorded by the auth proxy on every successful password sign-in. */
export const signInAction = "account.signed_in";
/** Sign-up signs the new user in without a separate sign-in call, so it counts as the first sign-in. */
const signInActions = [signInAction, "account.created"];

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
  /** The sign-in before the current one and the newest non-sign-in event, for the overview greeting. */
  presence(actorUserId: string): Promise<AuditPresence>;
}

function toAuditEvent(row: typeof auditEvents.$inferSelect): AuditEvent {
  return {
    id: row.id,
    action: row.action,
    entityType: auditEntityTypeSchema.parse(row.entityType),
    entityId: row.entityId,
    metadata: row.metadata,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
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
      return rows.map(toAuditEvent);
    },

    async presence(actorUserId) {
      const [signIns, latest] = await readAll(database.db, [
        // The newest sign-in is the one that opened the current session; the one before it is "last time".
        () => database.db
          .select({ createdAt: auditEvents.createdAt })
          .from(auditEvents)
          .where(and(eq(auditEvents.actorUserId, actorUserId), inArray(auditEvents.action, signInActions)))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(1)
          .offset(1),
        () => database.db
          .select()
          .from(auditEvents)
          .where(and(eq(auditEvents.actorUserId, actorUserId), ne(auditEvents.action, signInAction)))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(1),
      ]);
      return {
        previousSignInAt: signIns[0]?.createdAt.toISOString() ?? null,
        lastActivity: latest[0] ? toAuditEvent(latest[0]) : null,
      };
    },
  };
}
