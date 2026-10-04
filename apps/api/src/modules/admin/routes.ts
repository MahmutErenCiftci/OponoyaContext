import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { adminFeedbackListQuerySchema, updateFeedbackStatusSchema } from "@devcontext/contracts";
import type { FeedbackRepository } from "../feedback/repository.js";
import type { AdminRepository } from "./repository.js";

const feedbackParamsSchema = z.object({ id: z.uuid() });

function actorId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

/** True when the configured operator list names this user. */
export function isAdmin(adminUserIds: readonly string[], userId: string) {
  return adminUserIds.includes(userId.toLowerCase());
}

/**
 * Operator routes are the only cross-account reads and writes in the API.
 * Signed-out callers get 401 like every other route; signed-in users outside
 * `ADMIN_USER_IDS` get 403 before anything is queried.
 */
export async function registerAdminRoutes(app: FastifyInstance, admin: AdminRepository, feedback: FeedbackRepository) {
  async function requireAdmin(request: FastifyRequest) {
    const userId = actorId(request);
    if (!isAdmin(app.config.ADMIN_USER_IDS, userId)) {
      request.log.warn({ category: "security", event: "admin_denied", userId, requestId: request.id }, "admin_denied");
      throw Object.assign(new Error("Admin access required"), { statusCode: 403 });
    }
  }

  const guarded = { onRequest: [app.authenticate, requireAdmin] };

  app.get("/v1/admin/overview", guarded, async () => ({
    overview: await admin.overview(),
  }));

  app.get("/v1/admin/feedback", guarded, async (request) => ({
    feedback: await feedback.listAll(adminFeedbackListQuerySchema.parse(request.query)),
  }));

  app.patch("/v1/admin/feedback/:id", guarded, async (request) => {
    const { id } = feedbackParamsSchema.parse(request.params);
    const { status } = updateFeedbackStatusSchema.parse(request.body);
    const updated = await feedback.setStatus(id, status);
    if (!updated) throw Object.assign(new Error("Feedback not found"), { statusCode: 404 });
    await app.telemetry.record({ actorUserId: actorId(request), requestId: request.id }, {
      action: "feedback.status_changed", entityType: "feedback", entityId: id, metadata: { status },
    });
    return { feedback: updated };
  });
}
