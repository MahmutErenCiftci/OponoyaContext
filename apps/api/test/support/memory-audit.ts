import type { AuditEvent } from "@devcontext/contracts";
import type { AuditEventInput, AuditRepository } from "../../src/modules/audit/repository.js";

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
  };
}
