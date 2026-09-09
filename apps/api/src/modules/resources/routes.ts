import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createResourceSchema,
  resourceListQuerySchema,
  updateResourceSchema,
} from "@devcontext/contracts";
import { z } from "zod";
import type { ResourceService } from "./service.js";

const resourceParamsSchema = z.object({ id: z.uuid() });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

export async function registerResourceRoutes(app: FastifyInstance, resources: ResourceService) {
  app.get("/v1/resources", { preHandler: app.authenticate }, async (request) =>
    resources.list(ownerId(request), resourceListQuerySchema.parse(request.query)),
  );

  app.post("/v1/resources", { preHandler: app.authenticate }, async (request, reply) => {
    const input = createResourceSchema.parse(request.body);
    await app.entitlements.assertCanCreate(ownerId(request), "resources");
    const result = await resources.create(ownerId(request), input);
    await app.telemetry.record(actor(request), {
      action: "resource.created", entityType: "resource", entityId: result.resource.id,
      metadata: { type: result.resource.type, warnings: result.warnings }, analytics: "resource_created",
    });
    if (input.preference) {
      await app.telemetry.record(actor(request), {
        action: "resource.preference_changed", entityType: "resource", entityId: result.resource.id,
        metadata: { slot: input.preference.slot, mode: input.preference.mode }, analytics: "resource_preference_set",
      });
    }
    return reply.code(201).send(result);
  });

  app.get("/v1/resources/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = resourceParamsSchema.parse(request.params);
    return { resource: await resources.get(ownerId(request), id) };
  });

  app.patch("/v1/resources/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = resourceParamsSchema.parse(request.params);
    const input = updateResourceSchema.parse(request.body);
    const result = await resources.update(ownerId(request), id, input);
    if (input.preference !== undefined) {
      await app.telemetry.record(actor(request), {
        action: "resource.preference_changed", entityType: "resource", entityId: id,
        metadata: { slot: input.preference?.slot ?? null, mode: input.preference?.mode ?? null }, analytics: "resource_preference_set",
      });
    }
    return result;
  });

  app.delete("/v1/resources/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = resourceParamsSchema.parse(request.params);
    const result = await resources.archive(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "resource.archived", entityType: "resource", entityId: id });
    return result;
  });

  app.post("/v1/resources/:id/restore", { preHandler: app.authenticate }, async (request) => {
    const { id } = resourceParamsSchema.parse(request.params);
    // Restoring counts as creating an active entity; archive-then-restore cannot bypass the plan.
    await app.entitlements.assertCanCreate(ownerId(request), "resources");
    const result = await resources.restore(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "resource.restored", entityType: "resource", entityId: id });
    return result;
  });
}
