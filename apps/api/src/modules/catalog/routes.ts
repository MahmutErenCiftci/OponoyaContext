import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { catalogTechnologyListQuerySchema } from "@devcontext/contracts";
import type { CatalogService } from "./service.js";

const paramsSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

/** Reference data is read-only; the Library mutations below record content-free audit events. */
export async function registerCatalogRoutes(app: FastifyInstance, catalog: CatalogService) {
  app.get("/v1/catalog", { preHandler: app.authenticate }, async () => ({ catalog: catalog.overview() }));

  app.get("/v1/catalog/technologies", { preHandler: app.authenticate }, async (request) =>
    catalog.listTechnologies(catalogTechnologyListQuerySchema.parse(request.query)));

  app.get("/v1/catalog/technologies/:slug", { preHandler: app.authenticate }, async (request) => ({
    technology: catalog.getTechnology(paramsSchema.parse(request.params).slug),
  }));

  app.get("/v1/catalog/stacks", { preHandler: app.authenticate }, async () => ({ stacks: catalog.listStacks() }));

  app.get("/v1/catalog/stacks/:slug", { preHandler: app.authenticate }, async (request) => ({
    stack: catalog.getStack(paramsSchema.parse(request.params).slug),
  }));

  app.get("/v1/catalog/library", { preHandler: app.authenticate }, async (request) => ({
    links: await catalog.libraryLinks(ownerId(request)),
  }));

  app.post("/v1/catalog/technologies/:slug/library", { preHandler: app.authenticate }, async (request, reply) => {
    const { slug } = paramsSchema.parse(request.params);
    const links = await catalog.libraryLinks(ownerId(request));
    if (!links[slug]) await app.entitlements.assertCanCreate(ownerId(request), "resources");
    const result = await catalog.addTechnology(ownerId(request), slug);
    await app.telemetry.record({ actorUserId: ownerId(request), requestId: request.id }, {
      action: "catalog.technology_added", entityType: "resource", entityId: result.resource.id, metadata: { catalogSlug: slug, created: result.created },
    });
    return reply.code(result.created ? 201 : 200).send(result);
  });

  /** Only technologies not yet in the Library count toward the plan limit. */
  async function assertStackFits(ownerUserId: string, slug: string, withProfile: boolean) {
    const stack = catalog.getStack(slug);
    const links = await catalog.libraryLinks(ownerUserId);
    const missing = stack.layers.flatMap((layer) => layer.technologies).filter((item) => item.known && !links[item.slug]);
    await app.entitlements.assertCanCreate(ownerUserId, "resources", new Set(missing.map((item) => item.slug)).size);
    if (withProfile) await app.entitlements.assertCanCreate(ownerUserId, "profiles");
  }

  app.post("/v1/catalog/stacks/:slug/library", { preHandler: app.authenticate }, async (request, reply) => {
    const { slug } = paramsSchema.parse(request.params);
    await assertStackFits(ownerId(request), slug, false);
    const result = await catalog.addStack(ownerId(request), slug);
    await app.telemetry.record({ actorUserId: ownerId(request), requestId: request.id }, {
      action: "catalog.stack_added", entityType: "workspace", entityId: null,
      metadata: { catalogSlug: slug, created: result.created.length, existing: result.existing.length, skipped: result.skipped.length },
    });
    return reply.code(result.created.length > 0 ? 201 : 200).send(result);
  });

  app.post("/v1/catalog/stacks/:slug/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const { slug } = paramsSchema.parse(request.params);
    await assertStackFits(ownerId(request), slug, true);
    const result = await catalog.createStackProfile(ownerId(request), slug);
    await app.telemetry.record({ actorUserId: ownerId(request), requestId: request.id }, {
      action: "catalog.stack_profile_created", entityType: "profile", entityId: result.profile.id,
      metadata: { catalogSlug: slug, created: result.created, decisions: result.decisions.length, resourcesCreated: result.library.created.length },
    });
    return reply.code(result.created ? 201 : 200).send(result);
  });
}
