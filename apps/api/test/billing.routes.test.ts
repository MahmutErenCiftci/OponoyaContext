import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  apiErrorSchema,
  billingRedirectResponseSchema,
  billingReconcileResponseSchema,
  billingSummaryResponseSchema,
  billingWebhookResponseSchema,
  type Resource,
} from "@devcontext/contracts";
import { buildApp, type AppDependencies } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import type { WebhookPayload } from "../src/modules/billing/provider.js";
import { signWebhook, signatureHeader } from "../src/modules/billing/signature.js";
import type { ContextService } from "../src/modules/context/service.js";
import type { ProfileService } from "../src/modules/profiles/service.js";
import type { ProjectService } from "../src/modules/projects/service.js";
import type { RecipeService } from "../src/modules/recipes/service.js";
import type { ResourceService } from "../src/modules/resources/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { memorySubscriptions, memoryUsage, planEntitlements, proRecord } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const secret = "billing-webhook-test-secret-with-32-characters!";
const now = new Date().toISOString();
const asA = { cookie: "session=owner-a" };
const asB = { cookie: "session=owner-b" };

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
  };
}

const resource: Resource = {
  id: "00000000-0000-4000-8000-000000000010", name: "Next.js", slug: "next-js-1", type: "framework", description: null, sourceUrl: null, docsUrl: null, repoUrl: null,
  installCommand: null, notes: null, metadata: {}, tags: [], preference: null, favorite: false, archivedAt: null, createdAt: now, updatedAt: now,
};

/** Services that only prove whether the plan guard let the request through. */
function reached() {
  const calls: string[] = [];
  const hit = (name: string) => vi.fn(async () => { calls.push(name); throw Object.assign(new Error(`reached ${name}`), { statusCode: 418 }); });
  const resources: ResourceService = {
    list: vi.fn(async () => ({ resources: [], total: 0 })), get: vi.fn(async () => resource),
    create: vi.fn(async () => { calls.push("resources.create"); return { resource, warnings: [], duplicates: [] }; }),
    update: hit("resources.update"), archive: hit("resources.archive"), restore: hit("resources.restore"), listCatalogLinks: vi.fn(async () => []),
  };
  const projects = { create: hit("projects.create"), clone: hit("projects.clone"), restore: hit("projects.restore") } as unknown as ProjectService;
  const profiles = { create: hit("profiles.create"), saveFromProject: hit("profiles.saveFromProject"), restore: hit("profiles.restore") } as unknown as ProfileService;
  const recipes = { create: hit("recipes.create"), saveFromProject: hit("recipes.saveFromProject"), restore: hit("recipes.restore") } as unknown as RecipeService;
  const context = {
    export: hit("context.export"), bundle: hit("context.bundle"), diff: hit("context.diff"),
    listVersions: vi.fn(async () => Array.from({ length: 5 }, (_, index) => ({ version: 5 - index }))),
  } as unknown as ContextService;
  return { calls, resources, projects, profiles, recipes, context };
}

async function createApp(options: { provider?: "fake" | "none"; usage?: ReturnType<typeof memoryUsage>; clock?: () => Date; overrides?: Partial<AppDependencies> } = {}) {
  const subscriptions = memorySubscriptions();
  const usage = options.usage ?? memoryUsage();
  const clock = options.clock ?? (() => new Date());
  const services = reached();
  const logs: string[] = [];
  const logStream = new Writable({ write(chunk, _encoding, callback) { logs.push(String(chunk)); callback(); } });
  const audit = memoryAudit();
  const app = await buildApp(readConfig({
    NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
    BILLING_PROVIDER: options.provider ?? "fake", BILLING_WEBHOOK_SECRET: secret, BILLING_PRO_PRICE_LABEL: "9 USD / month",
  }), {
    auth: auth(), audit, subscriptions, entitlements: planEntitlements(subscriptions, usage, clock), logStream, logLevel: "debug",
    resources: services.resources, projects: services.projects, profiles: services.profiles, recipes: services.recipes, context: services.context,
    ...options.overrides,
  });
  apps.push(app);
  return { app, subscriptions, usage, services, audit, logs };
}

function signed(payload: WebhookPayload, key = secret, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload);
  return { payload: body, headers: { [signatureHeader]: signWebhook(key, body, timestamp), "content-type": "application/json" } };
}

function payload(id: string, createdAt: string, overrides: Partial<WebhookPayload["subscription"]> = {}): WebhookPayload {
  return {
    id, type: "subscription.updated", createdAt,
    subscription: { customerId: "cus_x", subscriptionId: "sub_x", ownerUserId: ownerA, status: "active", plan: "pro", currentPeriodStart: "2026-09-01T00:00:00.000Z", currentPeriodEnd: "2099-01-01T00:00:00.000Z", cancelAtPeriodEnd: false, canceledAt: null, ...overrides },
  };
}

describe("billing routes", () => {
  it("reports plan, usage, plans and provider state; without a provider the Free plan simply has no upgrade path", async () => {
    const { app } = await createApp({ usage: memoryUsage({ projects: 2 }) });
    expect((await app.inject("/v1/billing")).statusCode).toBe(401);
    const summary = billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asA })).json()).billing;
    expect(summary.entitlement).toMatchObject({ plan: "free", reason: "no_subscription" });
    expect(summary.usage.projects).toEqual({ used: 2, limit: 3, remaining: 1 });
    expect(summary.provider).toEqual({ id: "fake", configured: true, testMode: true });
    expect(summary.plans.map((plan) => plan.id)).toEqual(["free", "pro"]);
    expect(summary.plans[1]).toMatchObject({ priceLabel: "9 USD / month", features: { diff: true, bundle: true } });
    expect(summary.subscription.manageable).toBe(false);

    const { app: offline } = await createApp({ provider: "none" });
    const none = billingSummaryResponseSchema.parse((await offline.inject({ url: "/v1/billing", headers: asA })).json()).billing;
    expect(none.provider).toEqual({ id: null, configured: false, testMode: false });
    const checkout = await offline.inject({ method: "POST", url: "/v1/billing/checkout", headers: asA });
    expect(checkout.statusCode).toBe(409);
    expect(apiErrorSchema.parse(checkout.json()).error.details).toEqual([{ path: ["provider"], code: "billing_unavailable" }]);
    expect((await offline.inject({ method: "POST", url: "/v1/billing/test/portal", headers: asA, payload: { action: "cancel" } })).statusCode).toBe(404);
  });

  it("upgrades, cancels, fails and expires through the fake provider using signed webhooks only", async () => {
    const { app, audit } = await createApp();
    const checkout = billingRedirectResponseSchema.parse((await app.inject({ method: "POST", url: "/v1/billing/checkout", headers: asA })).json());
    const sessionId = new URL(checkout.url).searchParams.get("session")!;
    expect(checkout.url.startsWith("http://localhost:3000/billing/checkout?session=cs_fake_")).toBe(true);
    expect((await app.inject({ method: "POST", url: `/v1/billing/test/checkout/${sessionId}`, headers: asB, payload: { outcome: "paid" } })).statusCode).toBe(404);

    const paid = billingRedirectResponseSchema.parse((await app.inject({ method: "POST", url: `/v1/billing/test/checkout/${sessionId}`, headers: asA, payload: { outcome: "paid" } })).json());
    expect(paid.url).toBe("http://localhost:3000/workspace/billing?billing=success");
    let summary = billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asA })).json()).billing;
    expect(summary.entitlement).toMatchObject({ plan: "pro", reason: "active", paymentProblem: false });
    expect(summary.subscription).toMatchObject({ status: "active", provider: "fake", manageable: true });
    expect(summary.usage.projects.limit).toBe(500);
    expect(billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asB })).json()).billing.entitlement.plan).toBe("free");

    const portal = billingRedirectResponseSchema.parse((await app.inject({ method: "POST", url: "/v1/billing/portal", headers: asA })).json());
    expect(portal.url).toContain("/billing/portal?customer=cus_fake_");
    await app.inject({ method: "POST", url: "/v1/billing/test/portal", headers: asA, payload: { action: "cancel" } });
    summary = billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asA })).json()).billing;
    expect(summary.entitlement).toMatchObject({ plan: "pro", reason: "cancel_at_period_end", cancelAtPeriodEnd: true });
    await app.inject({ method: "POST", url: "/v1/billing/test/portal", headers: asA, payload: { action: "resume" } });
    await app.inject({ method: "POST", url: "/v1/billing/test/portal", headers: asA, payload: { action: "fail_renewal" } });
    summary = billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asA })).json()).billing;
    expect(summary.entitlement).toMatchObject({ plan: "pro", reason: "past_due_grace", paymentProblem: true });
    const reconciled = billingReconcileResponseSchema.parse((await app.inject({ method: "POST", url: "/v1/billing/reconcile", headers: asA })).json());
    expect(reconciled.subscription.status).toBe("past_due");
    await app.inject({ method: "POST", url: "/v1/billing/test/portal", headers: asA, payload: { action: "expire" } });
    summary = billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asA })).json()).billing;
    expect(summary.entitlement).toMatchObject({ plan: "free", reason: "canceled" });

    const events = audit.events.filter((event) => event.action.startsWith("billing."));
    expect(events.map((event) => event.action)).toEqual(expect.arrayContaining(["billing.checkout_started", "billing.webhook_processed", "billing.portal_opened", "billing.reconciled"]));
    for (const event of events) {
      expect(event.actorUserId).toBe(ownerA);
      expect(JSON.stringify(event.metadata)).not.toMatch(/cus_fake|sub_fake|example\.test/);
    }
  });

  it("verifies signatures over the raw body, answers duplicates and stale events without changes, and never leaks the secret", async () => {
    const { app, subscriptions, logs } = await createApp();
    const first = signed(payload("evt_1", "2026-09-01T00:00:00.000Z"));
    const processed = await app.inject({ method: "POST", url: "/v1/billing/webhook", ...first });
    expect(processed.statusCode).toBe(200);
    expect(billingWebhookResponseSchema.parse(processed.json())).toEqual({ received: true, eventId: "evt_1", status: "processed" });
    expect((await subscriptions.find(ownerA))?.status).toBe("active");

    const duplicate = await app.inject({ method: "POST", url: "/v1/billing/webhook", ...signed(payload("evt_1", "2026-09-01T00:00:00.000Z", { status: "canceled" })) });
    expect(billingWebhookResponseSchema.parse(duplicate.json()).status).toBe("duplicate");
    expect((await subscriptions.find(ownerA))?.status).toBe("active");

    const stale = await app.inject({ method: "POST", url: "/v1/billing/webhook", ...signed(payload("evt_0", "2026-08-01T00:00:00.000Z", { status: "canceled" })) });
    expect(billingWebhookResponseSchema.parse(stale.json()).status).toBe("ignored");
    expect((await subscriptions.find(ownerA))?.status).toBe("active");

    const unmatched = await app.inject({ method: "POST", url: "/v1/billing/webhook", ...signed(payload("evt_9", "2026-09-02T00:00:00.000Z", { ownerUserId: null, customerId: "cus_unknown" })) });
    expect(billingWebhookResponseSchema.parse(unmatched.json()).status).toBe("unmatched");

    const tampered = signed(payload("evt_2", "2026-09-03T00:00:00.000Z"));
    tampered.payload = tampered.payload.replace('"status":"active"', '"status":"canceled"');
    const rejected = await app.inject({ method: "POST", url: "/v1/billing/webhook", ...tampered });
    expect(rejected.statusCode).toBe(400);
    expect(apiErrorSchema.parse(rejected.json()).error.details).toEqual([{ path: ["signature"], code: "webhook_signature_invalid" }]);
    expect((await app.inject({ method: "POST", url: "/v1/billing/webhook", ...signed(payload("evt_3", "2026-09-03T00:00:00.000Z"), "wrong-secret-that-is-also-32-characters-long") })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/billing/webhook", ...signed(payload("evt_4", "2026-09-03T00:00:00.000Z"), secret, Math.floor(Date.now() / 1000) - 3_600) })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/billing/webhook", payload: "{}", headers: { "content-type": "application/json" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/billing/webhook", ...signed({ ...payload("evt_5", "2026-09-03T00:00:00.000Z"), type: "bogus" as WebhookPayload["type"] }) })).statusCode).toBe(400);
    expect((await subscriptions.find(ownerA))?.status).toBe("active");
    expect(logs.join("") + rejected.body + processed.body).not.toContain(secret);
  });

  it("enforces limits and Pro features on the API, including restore, clone and imports, and lifts them after upgrade", async () => {
    const usage = memoryUsage({ projects: 3, resources: 50, profiles: 2, recipes: 1 });
    const { app, subscriptions, services } = await createApp({ usage });
    const project = "00000000-0000-4000-8000-000000000020";
    const blocked: Array<{ method: "POST" | "GET"; url: string; body?: Record<string, unknown> }> = [
      { method: "POST", url: "/v1/resources", body: { name: "One more", type: "framework" } },
      { method: "POST", url: `/v1/resources/${resource.id}/restore` },
      { method: "POST", url: "/v1/projects", body: { name: "Fourth" } },
      { method: "POST", url: `/v1/projects/${project}/clone`, body: {} },
      { method: "POST", url: `/v1/projects/${project}/restore` },
      { method: "POST", url: "/v1/profiles", body: { name: "Third", type: "stack" } },
      { method: "POST", url: `/v1/projects/${project}/save-as-profile`, body: { name: "Third", type: "stack" } },
      { method: "POST", url: "/v1/recipes", body: { name: "Second" } },
      { method: "POST", url: `/v1/projects/${project}/save-as-recipe`, body: { name: "Second" } },
      { method: "POST", url: `/v1/projects/${project}/exports`, body: { target: "cursor" } },
      { method: "GET", url: `/v1/projects/${project}/context/bundle` },
      { method: "GET", url: `/v1/projects/${project}/context/diff` },
    ];
    for (const { method, url, body } of blocked) {
      const response = await app.inject({ method, url, headers: asA, ...(body ? { payload: body } : {}) });
      expect(response.statusCode, `${method} ${url}`).toBe(403);
      const error = apiErrorSchema.parse(response.json()).error;
      expect(error.details?.[0]?.code).toMatch(/^plan_(limit|feature)$/);
      expect(error.message).toContain("Pro");
    }
    expect(services.calls).toEqual([]);
    const versions = await app.inject({ url: `/v1/projects/${project}/context/versions`, headers: asA });
    expect((versions.json() as { versions: unknown[] }).versions).toHaveLength(3);
    expect((await app.inject({ method: "POST", url: `/v1/projects/${project}/exports`, headers: asA, payload: { target: "agents" } })).statusCode).toBe(418);

    subscriptions.set(proRecord(ownerA));
    for (const { method, url, body } of blocked) {
      const response = await app.inject({ method, url, headers: asA, ...(body ? { payload: body } : {}) });
      expect(response.statusCode, `${method} ${url}`).not.toBe(403);
    }
    expect(services.calls).toEqual(expect.arrayContaining(["projects.create", "projects.clone", "projects.restore", "profiles.create", "recipes.create", "context.export", "context.bundle", "context.diff", "resources.restore"]));
    expect((await app.inject({ url: `/v1/projects/${project}/context/versions`, headers: asA }).then((r) => r.json() as { versions: unknown[] })).versions).toHaveLength(5);
    expect(billingSummaryResponseSchema.parse((await app.inject({ url: "/v1/billing", headers: asB })).json()).billing.entitlement.plan).toBe("free");
  });
});
