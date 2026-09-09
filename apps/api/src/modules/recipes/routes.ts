import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createRecipeSchema,
  decisionSlotSchema,
  idempotencyKeySchema,
  recipeListQuerySchema,
  saveProjectAsRecipeSchema,
  setRecipeProfilesSchema,
  updateRecipeSchema,
  upsertProjectDecisionSchema,
} from "@devcontext/contracts";
import { z } from "zod";
import type { RecipeService } from "./service.js";

const recipeParamsSchema = z.object({ id: z.uuid() });
const slotParamsSchema = z.object({ id: z.uuid(), slot: decisionSlotSchema });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

export async function registerRecipeRoutes(app: FastifyInstance, recipes: RecipeService) {
  app.get("/v1/recipes", { preHandler: app.authenticate }, async (request) =>
    recipes.list(ownerId(request), recipeListQuerySchema.parse(request.query)),
  );

  app.post("/v1/recipes", { preHandler: app.authenticate }, async (request, reply) => {
    await app.entitlements.assertCanCreate(ownerId(request), "recipes");
    const recipe = await recipes.create(ownerId(request), createRecipeSchema.parse(request.body));
    await app.telemetry.record(actor(request), { action: "recipe.created", entityType: "recipe", entityId: recipe.id, metadata: { profiles: recipe.profiles.length } });
    return reply.code(201).send({ recipe });
  });

  app.get("/v1/recipes/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = recipeParamsSchema.parse(request.params);
    return { recipe: await recipes.get(ownerId(request), id) };
  });

  app.patch("/v1/recipes/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = recipeParamsSchema.parse(request.params);
    const input = updateRecipeSchema.parse(request.body);
    const recipe = await recipes.update(ownerId(request), id, input);
    await app.telemetry.record(actor(request), { action: "recipe.updated", entityType: "recipe", entityId: id, metadata: { fields: Object.keys(input) } });
    return { recipe };
  });

  app.put("/v1/recipes/:id/profiles", { preHandler: app.authenticate }, async (request) => {
    const { id } = recipeParamsSchema.parse(request.params);
    const input = setRecipeProfilesSchema.parse(request.body);
    const recipe = await recipes.setProfiles(ownerId(request), id, input.profiles);
    await app.telemetry.record(actor(request), { action: "recipe.profiles_replaced", entityType: "recipe", entityId: id, metadata: { profiles: input.profiles.length } });
    return { profiles: recipe.profiles };
  });

  app.delete("/v1/recipes/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = recipeParamsSchema.parse(request.params);
    const recipe = await recipes.archive(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "recipe.archived", entityType: "recipe", entityId: id });
    return { recipe };
  });

  app.post("/v1/recipes/:id/restore", { preHandler: app.authenticate }, async (request) => {
    const { id } = recipeParamsSchema.parse(request.params);
    await app.entitlements.assertCanCreate(ownerId(request), "recipes");
    const recipe = await recipes.restore(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "recipe.restored", entityType: "recipe", entityId: id });
    return { recipe };
  });

  app.put("/v1/recipes/:id/decisions/:slot", { preHandler: app.authenticate }, async (request) => {
    const { id, slot } = slotParamsSchema.parse(request.params);
    const input = upsertProjectDecisionSchema.parse(request.body);
    const decision = await recipes.upsertDecision(ownerId(request), id, slot, input);
    await app.telemetry.record(actor(request), {
      action: "recipe.decision_changed", entityType: "recipe", entityId: id,
      metadata: { slot, mode: input.mode, resourceId: input.resourceId }, analytics: "decision_changed",
    });
    return { decision };
  });

  app.delete("/v1/recipes/:id/decisions/:slot", { preHandler: app.authenticate }, async (request) => {
    const { id, slot } = slotParamsSchema.parse(request.params);
    await recipes.removeDecision(ownerId(request), id, slot);
    await app.telemetry.record(actor(request), { action: "recipe.decision_removed", entityType: "recipe", entityId: id, metadata: { slot }, analytics: "decision_changed" });
    return { decision: null };
  });

  app.post("/v1/projects/:id/save-as-recipe", { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = recipeParamsSchema.parse(request.params);
    const raw = request.headers["idempotency-key"];
    const key = idempotencyKeySchema.optional().parse(Array.isArray(raw) ? raw[0] : raw);
    await app.entitlements.assertCanCreate(ownerId(request), "recipes");
    const result = await recipes.saveFromProject(ownerId(request), id, saveProjectAsRecipeSchema.parse(request.body), key);
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "recipe.created", entityType: "recipe", entityId: result.recipe.id,
        metadata: { fromProjectId: id, decisions: result.recipe.decisions.length, profiles: result.recipe.profiles.length },
      });
    }
    return reply.code(result.created ? 201 : 200).send(result);
  });
}
