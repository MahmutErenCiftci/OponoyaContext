import type { FastifyInstance, FastifyRequest } from "fastify";
import { compatibilityRuleListQuerySchema, createCompatibilityRuleSchema } from "@devcontext/contracts";
import { z } from "zod";
import type { CompatibilityService } from "./service.js";

const ruleParamsSchema = z.object({ id: z.uuid() });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

export async function registerCompatibilityRoutes(app: FastifyInstance, rules: CompatibilityService) {
  app.get("/v1/compatibility-rules", { preHandler: app.authenticate }, async (request) => {
    const query = compatibilityRuleListQuerySchema.parse(request.query);
    return { rules: await rules.list(ownerId(request), query.resourceId, query.limit) };
  });

  app.post("/v1/compatibility-rules", { preHandler: app.authenticate }, async (request, reply) => {
    const result = await rules.create(ownerId(request), createCompatibilityRuleSchema.parse(request.body));
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "compatibility_rule.created", entityType: "compatibility_rule", entityId: result.rule.id,
        metadata: { kind: result.rule.kind, leftResourceId: result.rule.left.id, rightResourceId: result.rule.right.id },
      });
    }
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.delete("/v1/compatibility-rules/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = ruleParamsSchema.parse(request.params);
    await rules.remove(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "compatibility_rule.removed", entityType: "compatibility_rule", entityId: id });
    return { removed: true };
  });
}
