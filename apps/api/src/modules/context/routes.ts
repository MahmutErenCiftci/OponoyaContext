import type { FastifyInstance } from "fastify";
import { contextDiffQuerySchema, createExportSchema, projectContextStatusQuerySchema } from "@devcontext/contracts";
import { z } from "zod";
import { actor, idempotencyKey, ownerId } from "../../lib/http.js";
import type { ContextService } from "./service.js";

/** Version numbers are int4 in PostgreSQL; larger values are a client error, not a server fault. */
const versionNumberSchema = z.coerce.number().int().positive().max(2_147_483_647);
const projectParamsSchema = z.object({ id: z.uuid() });
const versionParamsSchema = z.object({ id: z.uuid(), version: versionNumberSchema });
const bundleQuerySchema = z.object({ version: versionNumberSchema.optional() });

export async function registerContextRoutes(app: FastifyInstance, context: ContextService) {
  /** Freshness of up to 50 Projects for lists and dashboards: one request, no canonical JSON, no previews. */
  app.get("/v1/projects/context-status", { onRequest: app.authenticate }, async (request) => {
    const { ids } = projectContextStatusQuerySchema.parse(request.query);
    return { statuses: await context.statuses(ownerId(request), ids) };
  });

  app.post("/v1/projects/:id/compile", { onRequest: app.authenticate }, async (request, reply) => {
    const { id } = projectParamsSchema.parse(request.params);
    const result = await context.compile(ownerId(request), id);
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "project.compiled", entityType: "project", entityId: id,
        metadata: {
          version: result.version.version,
          compilerVersion: result.version.compilerVersion,
          decisions: result.version.decisionCount,
          warnings: result.version.warningCount,
        },
        analytics: "context_compiled",
      });
    }
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.get("/v1/projects/:id/context", { onRequest: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    return context.current(ownerId(request), id);
  });

  app.get("/v1/projects/:id/context/versions", { onRequest: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    // Older versions are kept for every plan; Free only sees the most recent ones.
    const limit = await app.entitlements.historyLimit(ownerId(request));
    return { versions: (await context.listVersions(ownerId(request), id, limit)).slice(0, limit) };
  });

  app.get("/v1/projects/:id/context/diff", { onRequest: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    await app.entitlements.assertFeature(ownerId(request), "diff");
    return context.diff(ownerId(request), id, contextDiffQuerySchema.parse(request.query));
  });

  app.get("/v1/projects/:id/context/versions/:version", { onRequest: app.authenticate }, async (request) => {
    const { id, version } = versionParamsSchema.parse(request.params);
    return { version: await context.getVersion(ownerId(request), id, version) };
  });

  app.post("/v1/projects/:id/exports", { onRequest: app.authenticate }, async (request, reply) => {
    const { id } = projectParamsSchema.parse(request.params);
    const input = createExportSchema.parse(request.body);
    await app.entitlements.assertExportTarget(ownerId(request), input.target);
    const result = await context.export(ownerId(request), id, input, idempotencyKey(request.headers));
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "project.exported", entityType: "project", entityId: id,
        metadata: { target: result.export.target, version: result.export.contextVersion }, analytics: "context_exported",
      });
    }
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.get("/v1/projects/:id/context/bundle", { onRequest: app.authenticate }, async (request, reply) => {
    const { id } = projectParamsSchema.parse(request.params);
    const query = bundleQuerySchema.parse(request.query);
    await app.entitlements.assertFeature(ownerId(request), "bundle");
    const result = await context.bundle(ownerId(request), id, query.version, idempotencyKey(request.headers));
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "project.exported", entityType: "project", entityId: id,
        metadata: { target: "bundle", version: result.contextVersion }, analytics: "context_exported",
      });
    }
    reply.header("content-type", "application/zip");
    reply.header("content-disposition", `attachment; filename="${result.fileName}"`);
    reply.header("content-length", String(result.content.length));
    return reply.send(result.content);
  });

  app.get("/v1/projects/:id/exports", { onRequest: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    return { exports: await context.listExports(ownerId(request), id) };
  });
}
