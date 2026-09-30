import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  acceptAiSuggestionResponseSchema,
  aiStatusResponseSchema,
  aiSuggestionListResponseSchema,
  aiSuggestionResponseSchema,
  apiErrorSchema,
  type AiStatus,
  type AiSuggestion,
  type ProjectDecisionView,
} from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { RateLimitPolicy } from "../src/lib/rate-limit.js";
import { AiProviderError } from "../src/modules/ai/provider.js";
import { aiConsentRequiredError, providerFailureError, type AiService } from "../src/modules/ai/service.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { memoryAudit, type MemoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000030";
const suggestionId = "00000000-0000-4000-8000-000000000050";
const hono = "00000000-0000-4000-8000-000000000014";
const at = new Date("2026-09-10T10:00:00Z").toISOString();
const headersA = { cookie: "session=owner-a" };
const headersB = { cookie: "session=owner-b" };

const status: AiStatus = { available: true, provider: "fake", model: "fake-deterministic", consented: true, consentedAt: at, quota: { limit: 100, used: 1, remaining: 99, resetsAt: "2026-10-01T00:00:00.000Z" } };
const suggestion: AiSuggestion = {
  id: suggestionId,
  projectId,
  kind: "decision_proposal",
  slot: "backend.framework",
  status: "pending",
  proposal: { resourceId: hono, rationale: "Secret-free rationale text.", alternatives: [], risks: [], confidence: "medium" },
  resource: { id: hono, name: "Hono", slug: "hono", type: "framework", sourceUrl: null, archivedAt: null },
  alternatives: [],
  warnings: [],
  provider: "fake",
  model: "fake-deterministic",
  createdAt: at,
  decidedAt: null,
};
const decision: ProjectDecisionView = {
  slot: "backend.framework",
  source: "project",
  effective: { id: "00000000-0000-4000-8000-000000000040", scope: "project", origin: null, slot: "backend.framework", mode: "PREFERRED", resource: suggestion.resource, priority: 0, constraints: {}, rationale: "AI önerisi (fake-deterministic): Secret-free rationale text.", conditions: {}, updatedAt: at },
  project: null,
  recipe: null,
  profile: null,
  profiles: [],
  global: null,
};

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      const match = /session=(owner-a|owner-b)/.exec(headers.get("cookie") ?? "");
      if (!match?.[1]) return null;
      return { user: { id: match[1] === "owner-a" ? ownerA : ownerB, email: `${match[1]}@example.test`, name: match[1], image: null } };
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
    async changePassword() { return { setCookie: [] }; },
  };
}

function notFound() {
  return Object.assign(new Error("Project not found"), { statusCode: 404 });
}

function service(): AiService {
  return {
    status: vi.fn(async () => status),
    setConsent: vi.fn(async (_owner, consent) => ({ ...status, consented: consent, consentedAt: consent ? at : null })),
    requestDecisionProposal: vi.fn(async (owner, _project, slot) => {
      if (owner !== ownerA) throw notFound();
      if (slot === "backend.orm") return { suggestion, reused: true, usage: { inputTokens: 0, outputTokens: 0 } };
      return { suggestion, reused: false, usage: { inputTokens: 812, outputTokens: 64 } };
    }),
    list: vi.fn(async (owner) => {
      if (owner !== ownerA) throw notFound();
      return [suggestion];
    }),
    accept: vi.fn(async (owner, _id, input) => {
      if (owner !== ownerA) throw Object.assign(new Error("Suggestion not found"), { statusCode: 404 });
      return { suggestion: { ...suggestion, status: "accepted" as const, decidedAt: at }, decision: { ...decision, effective: { ...decision.effective, mode: input.mode } } };
    }),
    reject: vi.fn(async (owner) => {
      if (owner !== ownerA) throw Object.assign(new Error("Suggestion not found"), { statusCode: 404 });
      return { ...suggestion, status: "rejected" as const, decidedAt: at };
    }),
    exportAll: vi.fn(async () => [suggestion]),
  };
}

async function createApp(ai = service(), rateLimits?: Partial<RateLimitPolicy>) {
  const audit = memoryAudit();
  const app = await buildApp(
    readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }),
    { auth: auth(), ai, audit, ...(rateLimits ? { rateLimits } : {}) },
  );
  apps.push(app);
  return { app, ai, audit };
}

function actions(audit: MemoryAudit) {
  return audit.events.map((event) => event.action);
}

describe("AI routes", () => {
  it("requires a session on every route", async () => {
    const { app, ai } = await createApp();
    const requests = [
      { method: "GET" as const, url: "/v1/ai" },
      { method: "PUT" as const, url: "/v1/ai/consent", payload: { consent: true } },
      { method: "POST" as const, url: `/v1/projects/${projectId}/ai/suggestions`, payload: { slot: "backend.framework" } },
      { method: "GET" as const, url: `/v1/projects/${projectId}/ai/suggestions` },
      { method: "POST" as const, url: `/v1/ai/suggestions/${suggestionId}/accept`, payload: {} },
      { method: "POST" as const, url: `/v1/ai/suggestions/${suggestionId}/reject` },
    ];
    for (const request of requests) expect((await app.inject(request)).statusCode, request.url).toBe(401);
    expect(ai.requestDecisionProposal).not.toHaveBeenCalled();
  });

  it("reports status and records consent changes without content", async () => {
    const { app, ai, audit } = await createApp();
    expect(aiStatusResponseSchema.parse((await app.inject({ url: "/v1/ai", headers: headersA })).json()).ai).toEqual(status);
    expect((await app.inject({ method: "PUT", url: "/v1/ai/consent", headers: headersA, payload: { consent: "yes" } })).statusCode).toBe(400);
    const revoked = await app.inject({ method: "PUT", url: "/v1/ai/consent", headers: headersA, payload: { consent: false } });
    expect(aiStatusResponseSchema.parse(revoked.json()).ai.consented).toBe(false);
    expect(ai.setConsent).toHaveBeenCalledWith(ownerA, false);
    expect(actions(audit)).toEqual(["account.ai_consent_revoked"]);
  });

  it("creates (201) or reuses (200) a proposal and keeps telemetry content-free", async () => {
    const { app, ai, audit } = await createApp();
    const created = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA, payload: { slot: "backend.framework" } });
    expect(created.statusCode).toBe(201);
    expect(aiSuggestionResponseSchema.parse(created.json()).suggestion.id).toBe(suggestionId);
    expect(ai.requestDecisionProposal).toHaveBeenCalledWith(ownerA, projectId, "backend.framework", expect.any(AbortSignal));
    const reused = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA, payload: { slot: "backend.orm" } });
    expect(reused.statusCode).toBe(200);
    const recorded = audit.events.filter((event) => event.action === "ai.suggestion_created");
    expect(recorded).toHaveLength(2);
    expect(recorded[0]!.metadata).toMatchObject({ projectId, slot: "backend.framework", provider: "fake", reused: false, inputTokens: 812, outputTokens: 64, hasChoice: true });
    expect(JSON.stringify(audit.events)).not.toContain("Secret-free rationale text.");
  });

  it("validates slots and ids before calling the provider", async () => {
    const { app, ai } = await createApp();
    expect((await app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA, payload: { slot: "not a slot" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/projects/not-a-uuid/ai/suggestions", headers: headersA, payload: { slot: "backend.framework" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: `/v1/ai/suggestions/${suggestionId}/accept`, headers: headersA, payload: { mode: "AI_DECIDE" } })).statusCode).toBe(400);
    expect((await app.inject({ url: `/v1/projects/${projectId}/ai/suggestions?limit=500`, headers: headersA })).statusCode).toBe(400);
    expect(ai.requestDecisionProposal).not.toHaveBeenCalled();
  });

  it("hides other users' Projects and suggestions", async () => {
    const { app } = await createApp();
    expect((await app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersB, payload: { slot: "backend.framework" } })).statusCode).toBe(404);
    expect((await app.inject({ url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersB })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `/v1/ai/suggestions/${suggestionId}/accept`, headers: headersB, payload: {} })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `/v1/ai/suggestions/${suggestionId}/reject`, headers: headersB })).statusCode).toBe(404);
  });

  it("accepts with the default mode and records both the suggestion and the decision change", async () => {
    const { app, ai, audit } = await createApp();
    const listed = await app.inject({ url: `/v1/projects/${projectId}/ai/suggestions?status=all`, headers: headersA });
    expect(aiSuggestionListResponseSchema.parse(listed.json()).suggestions).toHaveLength(1);
    expect(ai.list).toHaveBeenCalledWith(ownerA, projectId, { status: "all", limit: 20 });
    const accepted = await app.inject({ method: "POST", url: `/v1/ai/suggestions/${suggestionId}/accept`, headers: headersA });
    expect(accepted.statusCode).toBe(200);
    expect(acceptAiSuggestionResponseSchema.parse(accepted.json()).decision.effective.mode).toBe("PREFERRED");
    expect(ai.accept).toHaveBeenCalledWith(ownerA, suggestionId, { mode: "PREFERRED" });
    expect(actions(audit)).toEqual(["ai.suggestion_accepted", "project.decision_changed"]);
    expect(audit.events[1]!.metadata).toMatchObject({ source: "ai_suggestion", mode: "PREFERRED" });
    const rejected = await app.inject({ method: "POST", url: `/v1/ai/suggestions/${suggestionId}/reject`, headers: headersA });
    expect(aiSuggestionResponseSchema.parse(rejected.json()).suggestion.status).toBe("rejected");
  });

  it("answers provider failures with a content-free code and records them", async () => {
    const ai = service();
    vi.mocked(ai.requestDecisionProposal).mockRejectedValueOnce(providerFailureError(new AiProviderError("ai_rate_limited", true)));
    vi.mocked(ai.requestDecisionProposal).mockRejectedValueOnce(aiConsentRequiredError());
    const { app, audit } = await createApp(ai);
    const busy = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA, payload: { slot: "backend.framework" } });
    expect(busy.statusCode).toBe(503);
    const envelope = apiErrorSchema.parse(busy.json()).error;
    expect(envelope.details).toEqual([{ path: ["ai"], code: "ai_rate_limited" }]);
    expect(envelope.message).toBe("The AI service is busy. Try again in a moment.");
    expect(audit.events.find((event) => event.action === "ai.suggestion_failed")?.metadata).toEqual({ slot: "backend.framework", code: "ai_rate_limited" });
    const refused = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA, payload: { slot: "backend.framework" } });
    expect(refused.statusCode).toBe(403);
    expect(apiErrorSchema.parse(refused.json()).error.details).toEqual([{ path: ["ai"], code: "ai_consent_required" }]);
    // Refusals decided by the product (consent, quota) are not provider failures.
    expect(audit.events.filter((event) => event.action === "ai.suggestion_failed")).toHaveLength(1);
  });

  it("rate limits proposal requests on their own rule", async () => {
    const { app } = await createApp(service(), { ai: { name: "ai", max: 2, windowMs: 60_000 } });
    const ask = () => app.inject({ method: "POST", url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA, payload: { slot: "backend.framework" } });
    expect((await ask()).statusCode).toBe(201);
    expect((await ask()).statusCode).toBe(201);
    const blocked = await ask();
    expect(blocked.statusCode).toBe(429);
    expect(apiErrorSchema.parse(blocked.json()).error.code).toBe("RATE_LIMITED");
    // Listing is not charged to the AI rule.
    expect((await app.inject({ url: `/v1/projects/${projectId}/ai/suggestions`, headers: headersA })).statusCode).toBe(200);
  });
});
