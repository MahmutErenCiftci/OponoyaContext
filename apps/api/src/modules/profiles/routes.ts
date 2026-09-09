import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createProfileSchema,
  decisionSlotSchema,
  idempotencyKeySchema,
  profileListQuerySchema,
  saveProjectAsProfileSchema,
  updateProfileSchema,
  upsertProjectDecisionSchema,
} from "@devcontext/contracts";
import { z } from "zod";
import type { ProfileService } from "./service.js";

const profileParamsSchema = z.object({ id: z.uuid() });
const slotParamsSchema = z.object({ id: z.uuid(), slot: decisionSlotSchema });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

export async function registerProfileRoutes(app: FastifyInstance, profiles: ProfileService) {
  app.get("/v1/profiles", { preHandler: app.authenticate }, async (request) =>
    profiles.list(ownerId(request), profileListQuerySchema.parse(request.query)),
  );

  app.post("/v1/profiles", { preHandler: app.authenticate }, async (request, reply) => {
    await app.entitlements.assertCanCreate(ownerId(request), "profiles");
    const profile = await profiles.create(ownerId(request), createProfileSchema.parse(request.body));
    await app.telemetry.record(actor(request), {
      action: "profile.created", entityType: "profile", entityId: profile.id, metadata: { type: profile.type }, analytics: "profile_created",
    });
    return reply.code(201).send({ profile });
  });

  app.get("/v1/profiles/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = profileParamsSchema.parse(request.params);
    return { profile: await profiles.get(ownerId(request), id) };
  });

  app.patch("/v1/profiles/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = profileParamsSchema.parse(request.params);
    const input = updateProfileSchema.parse(request.body);
    const profile = await profiles.update(ownerId(request), id, input);
    await app.telemetry.record(actor(request), {
      action: "profile.updated", entityType: "profile", entityId: id, metadata: { fields: Object.keys(input) },
    });
    return { profile };
  });

  app.delete("/v1/profiles/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = profileParamsSchema.parse(request.params);
    const profile = await profiles.archive(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "profile.archived", entityType: "profile", entityId: id });
    return { profile };
  });

  app.post("/v1/profiles/:id/restore", { preHandler: app.authenticate }, async (request) => {
    const { id } = profileParamsSchema.parse(request.params);
    await app.entitlements.assertCanCreate(ownerId(request), "profiles");
    const profile = await profiles.restore(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "profile.restored", entityType: "profile", entityId: id });
    return { profile };
  });

  app.post("/v1/projects/:id/save-as-profile", { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = profileParamsSchema.parse(request.params);
    const raw = request.headers["idempotency-key"];
    const key = idempotencyKeySchema.optional().parse(Array.isArray(raw) ? raw[0] : raw);
    await app.entitlements.assertCanCreate(ownerId(request), "profiles");
    const result = await profiles.saveFromProject(ownerId(request), id, saveProjectAsProfileSchema.parse(request.body), key);
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "profile.created", entityType: "profile", entityId: result.profile.id,
        metadata: { type: result.profile.type, fromProjectId: id, decisions: result.profile.decisions.length }, analytics: "profile_created",
      });
    }
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.put("/v1/profiles/:id/decisions/:slot", { preHandler: app.authenticate }, async (request) => {
    const { id, slot } = slotParamsSchema.parse(request.params);
    const input = upsertProjectDecisionSchema.parse(request.body);
    const decision = await profiles.upsertDecision(ownerId(request), id, slot, input);
    await app.telemetry.record(actor(request), {
      action: "profile.decision_changed", entityType: "profile", entityId: id,
      metadata: { slot, mode: input.mode, resourceId: input.resourceId }, analytics: "decision_changed",
    });
    return { decision };
  });

  app.delete("/v1/profiles/:id/decisions/:slot", { preHandler: app.authenticate }, async (request) => {
    const { id, slot } = slotParamsSchema.parse(request.params);
    await profiles.removeDecision(ownerId(request), id, slot);
    await app.telemetry.record(actor(request), {
      action: "profile.decision_removed", entityType: "profile", entityId: id, metadata: { slot }, analytics: "decision_changed",
    });
    return { decision: null };
  });
}
