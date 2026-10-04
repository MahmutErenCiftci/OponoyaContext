import type { FastifyInstance } from "fastify";
import { createFeedbackSchema } from "@devcontext/contracts";
import type { FeedbackRepository } from "./repository.js";

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

const ownListLimit = 20;

/** Signed-in users send reports and read back their own; operators triage them under /v1/admin/feedback. */
export async function registerFeedbackRoutes(app: FastifyInstance, feedback: FeedbackRepository) {
  app.post("/v1/feedback", { onRequest: app.authenticate }, async (request, reply) => {
    const input = createFeedbackSchema.parse(request.body);
    const result = await feedback.create(ownerId(request), input);
    if (result.created) {
      // The message is user text: the audit row and log line carry the kind only.
      await app.telemetry.record({ actorUserId: ownerId(request), requestId: request.id }, {
        action: "feedback.created", entityType: "feedback", entityId: result.feedback.id, metadata: { kind: input.kind },
      });
    }
    return reply.code(result.created ? 201 : 200).send({ feedback: result.feedback });
  });

  app.get("/v1/feedback", { onRequest: app.authenticate }, async (request) => ({
    feedback: await feedback.listOwn(ownerId(request), ownListLimit),
  }));
}
