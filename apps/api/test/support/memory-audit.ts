import type { AuditEvent } from "@devcontext/contracts";
import { signInAction, type AuditEventInput, type AuditRepository } from "../../src/modules/audit/repository.js";

export type MemoryAudit = AuditRepository & { events: AuditEventInput[] };

/** In-memory audit trail for route tests; keeps `buildApp` away from a database. */
export function memoryAudit(): MemoryAudit {
  const events: AuditEventInput[] = [];
  return {
    events,
    async record(input) {
      events.push(input);
    },
    async list(actorUserId, query) {
      return events
        .filter((event) => event.actorUserId === actorUserId)
        .filter((event) => !query.entityType || event.entityType === query.entityType)
        .filter((event) => !query.entityId || event.entityId === query.entityId)
        .slice(-query.limit)
        .reverse()
        .map((event, index): AuditEvent => ({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          metadata: event.metadata,
          requestId: event.requestId,
          createdAt: new Date(0).toISOString(),
        }));
    },
    async presence(actorUserId) {
      const own = events.filter((event) => event.actorUserId === actorUserId);
      const signIns = own.filter((event) => event.action === signInAction || event.action === "account.created");
      const latest = own.filter((event) => event.action !== signInAction).at(-1);
      return {
        previousSignInAt: signIns.length > 1 ? new Date(0).toISOString() : null,
        lastActivity: latest
          ? { id: "00000000-0000-4000-8000-000000000001", action: latest.action, entityType: latest.entityType, entityId: latest.entityId, metadata: latest.metadata, requestId: latest.requestId, createdAt: new Date(0).toISOString() }
          : null,
      };
    },
  };
}
