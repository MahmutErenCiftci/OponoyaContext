import type { FastifyInstance, FastifyRequest } from "fastify";
import { batchProjectDecisionsSchema, decisionSlotSchema, upsertProjectDecisionSchema } from "@devcontext/contracts";
import { z } from "zod";
import type { DecisionService } from "./service.js";

const projectParamsSchema = z.object({ id: z.uuid() });
const slotParamsSchema = z.object({ id: z.uuid(), slot: decisionSlotSchema });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

export async function registerDecisionRoutes(app: FastifyInstance, decisions: DecisionService) {
  app.get("/v1/global-decisions", { preHandler: app.authenticate }, async (request) => ({
    decisions: await decisions.listGlobal(ownerId(request)),
  }));

  app.get("/v1/projects/:id/decisions", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    return { decisions: await decisions.list(ownerId(request), id) };
  });

  app.put("/v1/projects/:id/decisions", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    const input = batchProjectDecisionsSchema.parse(request.body);
    const result = await decisions.batch(ownerId(request), id, input);
    await app.telemetry.record(actor(request), {
      action: "project.decisions_batched", entityType: "project", entityId: id,
      metadata: { upserts: input.decisions.length, removed: input.removeSlots.length }, analytics: "decision_changed",
    });
    return { decisions: result };
  });

  app.put("/v1/projects/:id/decisions/:slot", { preHandler: app.authenticate }, async (request) => {
    const { id, slot } = slotParamsSchema.parse(request.params);
    const input = upsertProjectDecisionSchema.parse(request.body);
    const decision = await decisions.upsert(ownerId(request), id, slot, input);
    await app.telemetry.record(actor(request), {
      action: "project.decision_changed", entityType: "project", entityId: id,
      metadata: { slot, mode: input.mode, resourceId: input.resourceId }, analytics: "decision_changed",
    });
    return { decision };
  });

  app.delete("/v1/projects/:id/decisions/:slot", { preHandler: app.authenticate }, async (request) => {
    const { id, slot } = slotParamsSchema.parse(request.params);
    const decision = await decisions.remove(ownerId(request), id, slot);
    await app.telemetry.record(actor(request), {
      action: "project.decision_removed", entityType: "project", entityId: id, metadata: { slot }, analytics: "decision_changed",
    });
    return { decision };
  });
}
