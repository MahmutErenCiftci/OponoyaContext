import type { FastifyInstance } from "fastify";
import { auditEventListQuerySchema } from "@devcontext/contracts";
import type { AuditRepository } from "./repository.js";

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

/** The caller's own trail; another user's actions are never visible. */
export async function registerAuditRoutes(app: FastifyInstance, audit: AuditRepository) {
  app.get("/v1/audit", { onRequest: app.authenticate }, async (request) => ({
    events: await audit.list(ownerId(request), auditEventListQuerySchema.parse(request.query)),
  }));

  app.get("/v1/audit/presence", { onRequest: app.authenticate }, async (request) => ({
    presence: await audit.presence(ownerId(request)),
  }));
}
