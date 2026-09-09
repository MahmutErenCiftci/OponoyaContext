import type { FastifyInstance } from "fastify";
import { updateOnboardingSchema, type WorkspaceSettings } from "@devcontext/contracts";
import { sampleSetVersion } from "../samples/catalog.js";
import type { WorkspaceRepository, WorkspaceSettingsRow } from "./repository.js";

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

export function toWorkspaceSettings(row: WorkspaceSettingsRow): WorkspaceSettings {
  return { ...row, currentSampleVersion: sampleSetVersion };
}

export async function registerWorkspaceRoutes(app: FastifyInstance, workspace: WorkspaceRepository) {
  app.get("/v1/workspace/summary", { preHandler: app.authenticate }, async (request) => ({
    summary: await workspace.summary(ownerId(request)),
  }));

  app.get("/v1/workspace/settings", { preHandler: app.authenticate }, async (request) => ({
    settings: toWorkspaceSettings(await workspace.settings(ownerId(request))),
  }));

  /** First-run choices are resumable: any state can be set again, including back to `new`. */
  app.patch("/v1/workspace/onboarding", { preHandler: app.authenticate }, async (request) => {
    const input = updateOnboardingSchema.parse(request.body);
    const settings = toWorkspaceSettings(await workspace.updateOnboarding(ownerId(request), input.state, input.choice));
    await app.telemetry.record({ actorUserId: ownerId(request), requestId: request.id }, {
      action: "workspace.onboarding_updated", entityType: "workspace", entityId: null, metadata: { state: input.state, choice: input.choice ?? null },
    });
    return { settings };
  });
}
