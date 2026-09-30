import type { FastifyInstance } from "fastify";
import {
  acceptAiSuggestionSchema,
  aiSuggestionListQuerySchema,
  requestAiSuggestionSchema,
  updateAiConsentSchema,
} from "@devcontext/contracts";
import { z } from "zod";
import { actor, ownerId } from "../../lib/http.js";
import type { AiService } from "./service.js";

const projectParamsSchema = z.object({ id: z.uuid() });
const suggestionParamsSchema = z.object({ id: z.uuid() });

function failureCodeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("aiFailureCode" in error)) return null;
  return typeof error.aiFailureCode === "string" ? error.aiFailureCode : null;
}

/**
 * AI assistance (V1.5 groundwork). Every route is session-scoped; nothing
 * here changes a Project except an explicit accept, which writes an ordinary
 * Project decision through the decision service. Telemetry carries ids, enum
 * values and token counts only, never prompts or answers.
 */
export async function registerAiRoutes(app: FastifyInstance, ai: AiService) {
  app.get("/v1/ai", { onRequest: app.authenticate }, async (request) => ({
    ai: await ai.status(ownerId(request)),
  }));

  app.put("/v1/ai/consent", { onRequest: app.authenticate }, async (request) => {
    const input = updateAiConsentSchema.parse(request.body);
    const status = await ai.setConsent(ownerId(request), input.consent);
    await app.telemetry.record(actor(request), {
      action: input.consent ? "account.ai_consent_granted" : "account.ai_consent_revoked",
      entityType: "account", entityId: ownerId(request), metadata: { provider: status.provider }, analytics: "ai_consent_changed",
    });
    return { ai: status };
  });

  app.post("/v1/projects/:id/ai/suggestions", { onRequest: app.authenticate }, async (request, reply) => {
    const { id } = projectParamsSchema.parse(request.params);
    const input = requestAiSuggestionSchema.parse(request.body);
    // Stop paying for an answer nobody will read when the client goes away.
    const controller = new AbortController();
    const onClose = () => { if (!reply.raw.writableFinished) controller.abort(); };
    reply.raw.once("close", onClose);
    try {
      const result = await ai.requestDecisionProposal(ownerId(request), id, input.slot, controller.signal);
      await app.telemetry.record(actor(request), {
        action: "ai.suggestion_created", entityType: "ai_suggestion", entityId: result.suggestion.id,
        metadata: {
          projectId: id, slot: input.slot, provider: result.suggestion.provider, model: result.suggestion.model,
          reused: result.reused, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
          hasChoice: result.suggestion.proposal.resourceId !== null,
        },
        analytics: "ai_suggestion_requested",
      });
      return reply.code(result.reused ? 200 : 201).send({ suggestion: result.suggestion });
    } catch (error) {
      const code = failureCodeOf(error);
      if (code) {
        await app.telemetry.record(actor(request), {
          action: "ai.suggestion_failed", entityType: "project", entityId: id, metadata: { slot: input.slot, code },
        });
        request.log.warn({ category: "ai", event: "ai_provider_failed", code, requestId: request.id }, "ai_provider_failed");
      }
      throw error;
    } finally {
      reply.raw.off("close", onClose);
    }
  });

  app.get("/v1/projects/:id/ai/suggestions", { onRequest: app.authenticate }, async (request) => {
    const { id } = projectParamsSchema.parse(request.params);
    return { suggestions: await ai.list(ownerId(request), id, aiSuggestionListQuerySchema.parse(request.query)) };
  });

  app.post("/v1/ai/suggestions/:id/accept", { onRequest: app.authenticate }, async (request) => {
    const { id } = suggestionParamsSchema.parse(request.params);
    const input = acceptAiSuggestionSchema.parse(request.body ?? {});
    const result = await ai.accept(ownerId(request), id, input);
    await app.telemetry.record(actor(request), {
      action: "ai.suggestion_accepted", entityType: "ai_suggestion", entityId: id,
      metadata: { projectId: result.suggestion.projectId, slot: result.suggestion.slot, mode: input.mode, resourceId: result.suggestion.proposal.resourceId },
      analytics: "ai_suggestion_accepted",
    });
    await app.telemetry.record(actor(request), {
      action: "project.decision_changed", entityType: "project", entityId: result.suggestion.projectId,
      metadata: { slot: result.suggestion.slot, mode: input.mode, resourceId: result.suggestion.proposal.resourceId, source: "ai_suggestion" },
      analytics: "decision_changed",
    });
    return result;
  });

  app.post("/v1/ai/suggestions/:id/reject", { onRequest: app.authenticate }, async (request) => {
    const { id } = suggestionParamsSchema.parse(request.params);
    const suggestion = await ai.reject(ownerId(request), id);
    await app.telemetry.record(actor(request), {
      action: "ai.suggestion_rejected", entityType: "ai_suggestion", entityId: id,
      metadata: { projectId: suggestion.projectId, slot: suggestion.slot }, analytics: "ai_suggestion_rejected",
    });
    return { suggestion };
  });
}
