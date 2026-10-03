import type { FastifyInstance, FastifyRequest } from "fastify";
import { importRequestSchema, portableLimits } from "@devcontext/contracts";
import { actor, httpError, idempotencyKey, ownerId } from "../../lib/http.js";
import type { PortabilityService } from "./service.js";

function countTotal(counts: Record<string, { create: number; skip: number; replace: number; copy: number }>, key: "create" | "skip" | "replace" | "copy") {
  return Object.values(counts).reduce((sum, item) => sum + item[key], 0);
}

export async function registerPortabilityRoutes(app: FastifyInstance, portability: PortabilityService) {
  /**
   * One import at a time per user and at most `maxConcurrentImports` per
   * instance: a 32 MB document can parse into hundreds of megabytes. The slot
   * is claimed in onRequest, before Fastify reads the body, so a refused
   * request never costs a parse; it is released when the response is sent or
   * the client aborts.
   */
  const maxConcurrentImports = 2;
  const importing = new Set<string>();
  const claims = new Map<string, string>();

  async function claimImportSlot(request: FastifyRequest) {
    const owner = ownerId(request);
    if (importing.has(owner)) {
      throw httpError(409, "Import already running", {
        details: [{ path: ["document"], code: "import_in_progress" }],
        publicMessage: "Another import is still running. Wait for it to finish, then try again.",
      });
    }
    if (importing.size >= maxConcurrentImports) {
      throw httpError(503, "Import capacity reached", {
        details: [{ path: ["document"], code: "import_busy" }],
        publicMessage: "The server is busy with other imports. Try again in a few minutes.",
      });
    }
    importing.add(owner);
    claims.set(request.id, owner);
  }

  async function releaseImportSlot(request: FastifyRequest) {
    const owner = claims.get(request.id);
    if (!owner) return;
    claims.delete(request.id);
    importing.delete(owner);
  }

  /** Structured data only: no account, session, provider or history rows. */
  app.get("/v1/workspace/export", { onRequest: app.authenticate }, async (request, reply) => {
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
  app.post("/v1/workspace/import", {
    onRequest: [app.authenticate, claimImportSlot],
    onResponse: releaseImportSlot,
    onRequestAbort: releaseImportSlot,
    bodyLimit: portableLimits.requestBytes,
  }, async (request, reply) => {
    const owner = ownerId(request);
    const input = importRequestSchema.parse(request.body);
    // Plan limits apply to exactly what the plan would create; the document is planned once.
    const beforeApply = async (summary: { counts: Record<"resources" | "profiles" | "recipes" | "projects", { create: number; copy: number }> }) => {
      for (const key of ["resources", "profiles", "recipes", "projects"] as const) {
        await app.entitlements.assertCanCreate(owner, key, summary.counts[key].create + summary.counts[key].copy);
      }
    };
    const result = await portability.importWorkspace(owner, input, idempotencyKey(request.headers), beforeApply);
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
