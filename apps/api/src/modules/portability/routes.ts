import type { FastifyInstance, FastifyRequest } from "fastify";
import { idempotencyKeySchema, importRequestSchema, portableLimits } from "@devcontext/contracts";
import type { PortabilityService } from "./service.js";

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

function idempotencyKey(headers: Record<string, string | string[] | undefined>) {
  const raw = headers["idempotency-key"];
  return idempotencyKeySchema.optional().parse(Array.isArray(raw) ? raw[0] : raw);
}

function countTotal(counts: Record<string, { create: number; skip: number; replace: number; copy: number }>, key: "create" | "skip" | "replace" | "copy") {
  return Object.values(counts).reduce((sum, item) => sum + item[key], 0);
}

export async function registerPortabilityRoutes(app: FastifyInstance, portability: PortabilityService) {
  /** Structured data only: no account, session, provider or history rows. */
  app.get("/v1/workspace/export", { preHandler: app.authenticate }, async (request, reply) => {
    const document = await portability.exportWorkspace(ownerId(request));
    await app.telemetry.record(actor(request), {
      action: "workspace.export_downloaded", entityType: "workspace", entityId: null,
      metadata: { resources: document.resources.length, profiles: document.profiles.length, recipes: document.recipes.length, projects: document.projects.length },
    });
    const stamp = (document.exportedAt ?? new Date().toISOString()).slice(0, 10);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="devcontext-export-${stamp}.json"`);
    return reply.send(JSON.stringify(document));
  });

  /** Dry run by default; the same document with `dryRun: false` and an `Idempotency-Key` applies it once. */
  app.post("/v1/workspace/import", { preHandler: app.authenticate, bodyLimit: portableLimits.requestBytes }, async (request, reply) => {
    const input = importRequestSchema.parse(request.body);
    if (!input.dryRun) {
      // Plan limits apply to what the import would create; the preview is the same plan the apply step uses.
      const preview = await portability.importWorkspace(ownerId(request), { ...input, dryRun: true });
      for (const key of ["resources", "profiles", "recipes", "projects"] as const) {
        const needed = preview.summary.counts[key].create + preview.summary.counts[key].copy;
        await app.entitlements.assertCanCreate(ownerId(request), key, needed);
      }
    }
    const result = await portability.importWorkspace(ownerId(request), input, idempotencyKey(request.headers));
    if (result.applied && result.created) {
      await app.telemetry.record(actor(request), {
        action: "workspace.import_completed", entityType: "workspace", entityId: null,
        metadata: {
          strategy: result.summary.strategy,
          created: countTotal(result.summary.counts, "create"),
          skipped: countTotal(result.summary.counts, "skip"),
          replaced: countTotal(result.summary.counts, "replace"),
          copied: countTotal(result.summary.counts, "copy"),
        },
      });
    }
    return reply.code(result.applied && result.created ? 201 : 200).send(result);
  });
}
