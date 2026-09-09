import type { FastifyInstance, FastifyRequest } from "fastify";
import { sampleProfiles, sampleResources } from "./catalog.js";
import type { SampleService } from "./service.js";

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

/** Samples are opt-in: nothing is installed unless the user asks, and removal is one explicit call. */
export async function registerSampleRoutes(app: FastifyInstance, samples: SampleService) {
  app.post("/v1/workspace/samples", { preHandler: app.authenticate }, async (request, reply) => {
    // The sample set counts against plan limits like anything the user creates.
    await app.entitlements.assertCanCreate(ownerId(request), "resources", sampleResources.length);
    await app.entitlements.assertCanCreate(ownerId(request), "profiles", sampleProfiles.length);
    await app.entitlements.assertCanCreate(ownerId(request), "recipes", 1);
    await app.entitlements.assertCanCreate(ownerId(request), "projects", 1);
    const result = await samples.install(ownerId(request));
    if (result.created) {
      await app.telemetry.record(actor(request), {
        action: "workspace.samples_installed", entityType: "workspace", entityId: null,
        metadata: { version: result.settings.currentSampleVersion, ...result.counts },
      });
    }
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.delete("/v1/workspace/samples", { preHandler: app.authenticate }, async (request) => {
    const result = await samples.remove(ownerId(request));
    await app.telemetry.record(actor(request), {
      action: "workspace.samples_removed", entityType: "workspace", entityId: null, metadata: { ...result.removed },
    });
    return result;
  });
}
