import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  cloneProjectSchema,
  createProjectSchema,
  idempotencyKeySchema,
  projectListQuerySchema,
  setProjectProfilesSchema,
  updateProjectSchema,
} from "@devcontext/contracts";
import { z } from "zod";
import type { ProjectService } from "./service.js";

const projectParamsSchema = z.object({ id: z.uuid() });
const idempotencyHeaderSchema = idempotencyKeySchema.optional();

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

function idempotencyKey(headers: Record<string, string | string[] | undefined>) {
  const raw = headers["idempotency-key"];
  return idempotencyHeaderSchema.parse(Array.isArray(raw) ? raw[0] : raw);
}

export async function registerProjectRoutes(app: FastifyInstance, projects: ProjectService) {
  app.get("/v1/projects", { preHandler: app.authenticate }, async (request) =>
    projects.list(ownerId(request), projectListQuerySchema.parse(request.query)),
  );

  app.post("/v1/projects", { preHandler: app.authenticate }, async (request, reply) => {
    await app.entitlements.assertCanCreate(ownerId(request), "projects");
    const result = await projects.create(
      ownerId(request),
      createProjectSchema.parse(request.body),
      idempotencyKey(request.headers),
    );
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "project.created", entityType: "project", entityId: result.project.id,
        metadata: { stage: result.project.stage, resources: result.project.resources.length, profiles: result.project.profiles.length },
        analytics: "project_created",
      });
    }
    return reply.code(result.created ? 201 : 200).send({ project: result.project });
  });

  app.get("/v1/projects/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    return { project: await projects.get(ownerId(request), id) };
  });

  app.patch("/v1/projects/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);
    const project = await projects.update(ownerId(request), id, input);
    await app.telemetry.record(actor(request), {
      action: "project.updated", entityType: "project", entityId: id, metadata: { fields: Object.keys(input) },
    });
    return { project };
  });

  app.post("/v1/projects/:id/clone", { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = projectParamsSchema.parse(request.params);
    await app.entitlements.assertCanCreate(ownerId(request), "projects");
    const result = await projects.clone(ownerId(request), id, cloneProjectSchema.parse(request.body ?? {}), idempotencyKey(request.headers));
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "project.cloned", entityType: "project", entityId: result.project.id,
        metadata: { sourceProjectId: id, resources: result.project.resources.length, profiles: result.project.profiles.length },
        analytics: "project_created",
      });
    }
    return reply.code(result.created ? 201 : 200).send({ project: result.project, created: result.created });
  });

  app.put("/v1/projects/:id/profiles", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    const input = setProjectProfilesSchema.parse(request.body);
    const project = await projects.update(ownerId(request), id, input);
    await app.telemetry.record(actor(request), {
      action: "project.profiles_replaced", entityType: "project", entityId: id, metadata: { profiles: input.profiles.length },
    });
    return { profiles: project.profiles };
  });

  app.delete("/v1/projects/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    const project = await projects.archive(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "project.archived", entityType: "project", entityId: id });
    return { project };
  });

  app.post("/v1/projects/:id/restore", { preHandler: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    await app.entitlements.assertCanCreate(ownerId(request), "projects");
    const project = await projects.restore(ownerId(request), id);
    await app.telemetry.record(actor(request), { action: "project.restored", entityType: "project", entityId: id });
    return { project };
  });
}
