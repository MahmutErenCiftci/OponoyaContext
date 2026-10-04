import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accountDeletions,
  accounts,
  aiSuggestions,
  auditEvents,
  contextVersions,
  count,
  eq,
  exportEvents,
  feedback,
  importRequests,
  projectDecisions,
  projects,
  resources,
  sessions,
  subscriptions,
  tags,
  users,
  workspaceSettings,
  type Database,
  type Table,
} from "@devcontext/db";

type Column = Parameters<typeof eq>[0];
import { createTestDatabase } from "@devcontext/db/testing";
import { accountExportSchema, type CurrentUser } from "@devcontext/contracts";
import { readConfig } from "../src/config.js";
import { createAccountRepository } from "../src/modules/account/repository.js";
import { createAccountService, legalConfigFrom, type AccountService } from "../src/modules/account/service.js";
import { createAiRepository } from "../src/modules/ai/repository.js";
import { createAiService } from "../src/modules/ai/service.js";
import { createAuditRepository } from "../src/modules/audit/repository.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { createEntitlementService } from "../src/modules/billing/entitlements.js";
import type { BillingProvider } from "../src/modules/billing/provider.js";
import { createSubscriptionRepository, createUsageRepository } from "../src/modules/billing/repository.js";
import { createBillingService } from "../src/modules/billing/service.js";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService } from "../src/modules/decisions/service.js";
import { createPortabilityRepository } from "../src/modules/portability/repository.js";
import { createPortabilityService } from "../src/modules/portability/service.js";
import { createWorkspaceRepository } from "../src/modules/workspace/repository.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectA = "00000000-0000-4000-8000-000000000030";
const projectB = "00000000-0000-4000-8000-000000000031";
const resourceA = "00000000-0000-4000-8000-000000000010";
const resourceB = "00000000-0000-4000-8000-000000000011";
const userA: CurrentUser = { id: ownerA, email: "A@Example.test", name: "Owner A", image: null };
const password = "correct horse battery";

let database: Pick<Database, "db" | "close">;
let service: AccountService;
let providerDown = true;
const revoked: string[] = [];

const provider = {
  id: "stub",
  testMode: true,
  async revokeCustomer(input: { customerId: string }) {
    if (providerDown) throw new Error("provider offline");
    revoked.push(input.customerId);
    return { status: "revoked" as const };
  },
} as unknown as BillingProvider;

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession() { return null; },
    async verifyPassword(_headers, candidate) { return candidate === password; },
    // Better Auth deletes the user row; the schema cascades take everything owned with it.
    async deleteUser() {
      await database.db.delete(users).where(eq(users.id, ownerA));
      return { setCookie: ["better-auth.session_token=; Max-Age=0; Path=/"] };
    },
    async changePassword() { return { setCookie: [] }; },
  };
}

async function rows(table: Table, column: Column, owner: string) {
  const [row] = await database.db.select({ value: count() }).from(table as typeof users).where(eq(column, owner));
  return row!.value;
}

beforeAll(async () => {
  database = await createTestDatabase();
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(accounts).values([
    { accountId: ownerA, providerId: "credential", userId: ownerA, password: "scrypt$hash-secret-a" },
    { accountId: ownerB, providerId: "credential", userId: ownerB, password: "scrypt$hash-secret-b" },
  ]);
  const later = new Date(Date.now() + 86_400_000);
  await database.db.insert(sessions).values([
    { userId: ownerA, token: "session-token-secret-a", expiresAt: later, ipAddress: "203.0.113.9", userAgent: "agent" },
    { userId: ownerA, token: "session-token-secret-a2", expiresAt: later },
    { userId: ownerB, token: "session-token-secret-b", expiresAt: later },
  ]);
  await database.db.insert(resources).values([
    { id: resourceA, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework", notes: "own notes" },
    { id: resourceB, ownerUserId: ownerB, name: "Hono", slug: "hono", type: "framework" },
  ]);
  await database.db.insert(tags).values([{ ownerUserId: ownerA, name: "web" }, { ownerUserId: ownerB, name: "edge" }]);
  await database.db.insert(projects).values([
    { id: projectA, ownerUserId: ownerA, name: "Atlas", slug: "atlas" },
    { id: projectB, ownerUserId: ownerB, name: "Beacon", slug: "beacon" },
  ]);
  await database.db.insert(projectDecisions).values([
    { projectId: projectA, slot: "frontend.framework", mode: "LOCKED", resourceId: resourceA },
    { projectId: projectB, slot: "backend.framework", mode: "LOCKED", resourceId: resourceB },
  ]);
  const [version] = await database.db.insert(contextVersions).values({ projectId: projectA, version: 1, compilerVersion: "0.4.2", canonical: { project: "Atlas" }, contentHash: "sha256:a" }).returning();
  await database.db.insert(exportEvents).values({ projectId: projectA, contextVersionId: version!.id, target: "agents" });
  await database.db.insert(auditEvents).values([
    { actorUserId: ownerA, action: "project.created", entityType: "project", entityId: projectA },
    { actorUserId: ownerB, action: "project.created", entityType: "project", entityId: projectB },
  ]);
  await database.db.insert(importRequests).values({ ownerUserId: ownerA, requestId: "00000000-0000-4000-8000-000000000070", strategy: "merge", summary: {} });
  await database.db.insert(workspaceSettings).values({ ownerUserId: ownerA, aiConsentAt: new Date("2026-09-01T00:00:00Z") });
  await database.db.insert(aiSuggestions).values({
    ownerUserId: ownerA, projectId: projectA, kind: "decision_proposal", slot: "backend.framework", provider: "fake", model: "fake-deterministic",
    inputHash: "sha256:input", proposal: { resourceId: resourceA, rationale: "Fits.", alternatives: [], risks: [], confidence: "high" }, inputTokens: 10, outputTokens: 5,
  });
  await database.db.insert(feedback).values([
    { userId: ownerA, kind: "bug", message: "Kaydet düğmesi çalışmıyor.", pagePath: "/workspace/projects" },
    { userId: ownerB, kind: "suggestion", message: "Başka bir kullanıcının önerisi." },
  ]);
  await database.db.insert(subscriptions).values({ ownerUserId: ownerA, plan: "pro", status: "active", provider: "stub", providerCustomerId: "cus_a", providerSubscriptionId: "sub_a" });

  const subscriptionRepository = createSubscriptionRepository(database);
  const entitlements = createEntitlementService(subscriptionRepository, createUsageRepository(database));
  const decisions = createDecisionService(createDecisionRepository(database));
  const contextRepository = createContextRepository(database);
  const ai = createAiService({
    provider: null,
    repository: createAiRepository(database),
    decisions,
    loadCompileInput: (owner, project) => contextRepository.loadCompileInput(owner, project),
    monthlyQuota: async () => 100,
  });
  service = createAccountService({
    repository: createAccountRepository(database),
    auth: auth(),
    billing: createBillingService({
      provider,
      subscriptions: subscriptionRepository,
      entitlements,
      urls: { success: "http://localhost/s", cancel: "http://localhost/c", portalReturn: "http://localhost/p" },
      proPriceLabel: null,
    }),
    subscriptions: subscriptionRepository,
    portability: createPortabilityService(createPortabilityRepository(database)),
    workspace: createWorkspaceRepository(database),
    audit: createAuditRepository(database),
    ai,
    aiProvider: null,
    config: readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }),
  });
}, 60_000);

afterAll(async () => {
  await database.close();
});

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    const typed = error as { statusCode?: number; details?: Array<{ code: string }> };
    return `${typed.statusCode}:${typed.details?.[0]?.code ?? "none"}`;
  }
}

describe("account summary and export", () => {
  it("counts only the owner's rows in one statement", async () => {
    const summary = await service.summary(userA);
    expect(summary.stored).toEqual({
      resources: 1, tags: 1, profiles: 0, recipes: 0, projects: 1, decisions: 1, compatibilityRules: 0,
      contextVersions: 1, exports: 1, auditEvents: 1, importRequests: 1, aiSuggestions: 1, feedback: 1, sessions: 2,
    });
    expect(summary.integrations.billing).toMatchObject({ provider: "stub", plan: "pro", status: "active", linked: true });
    expect(summary.processing).toMatchObject({ externalAi: false, aiProvider: null, aiConsentedAt: "2026-09-01T00:00:00.000Z" });
    expect(summary.deletion).toMatchObject({ status: "none", attempts: 0 });
  });

  it("exports the owner's data and no secrets", async () => {
    const document = accountExportSchema.parse(await service.exportAccount(userA));
    expect(document.workspace.resources.map((resource) => resource.name)).toEqual(["Next.js"]);
    expect(document.workspace.projects.map((project) => project.name)).toEqual(["Atlas"]);
    expect(document.contextVersions).toHaveLength(1);
    expect(document.exports).toEqual([expect.objectContaining({ projectId: projectA, target: "agents" })]);
    expect(document.aiSuggestions).toHaveLength(1);
    expect(document.feedback).toEqual([expect.objectContaining({ kind: "bug", message: "Kaydet düğmesi çalışmıyor.", pagePath: "/workspace/projects", status: "new" })]);
    expect(document.settings.aiConsentedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(document.subscription).toMatchObject({ plan: "pro", status: "active", provider: "stub" });
    const text = JSON.stringify(document);
    for (const secret of ["hash-secret", "session-token-secret", "cus_a", "sub_a", "203.0.113.9", "Beacon", "Hono", "Başka bir kullanıcının"]) {
      expect(text, secret).not.toContain(secret);
    }
  });
});

describe("account deletion", () => {
  it("refuses a mismatched confirmation or a wrong password before anything external happens", async () => {
    expect(await failure(service.deleteAccount(userA, { confirmation: "someone@else.test", password }, new Headers(), "req-1"))).toBe("400:confirmation_mismatch");
    expect(await failure(service.deleteAccount(userA, { confirmation: "a@example.test", password: "wrong" }, new Headers(), "req-2"))).toBe("400:invalid_password");
    expect((await service.summary(userA)).deletion.status).toBe("none");
    expect(revoked).toEqual([]);
  });

  it("stays retryable while the payment provider is unreachable and deletes nothing", async () => {
    expect(await failure(service.deleteAccount(userA, { confirmation: " A@EXAMPLE.test ", password }, new Headers(), "req-3"))).toBe("409:billing_provider_unavailable");
    const summary = await service.summary(userA);
    expect(summary.deletion).toMatchObject({ status: "pending_external", attempts: 1, lastError: "billing_provider_unavailable", retryable: true });
    expect(summary.stored.projects).toBe(1);
  });

  it("revokes billing, deletes every owned row and session, and keeps only the minimal ledger", async () => {
    providerDown = false;
    const result = await service.deleteAccount(userA, { confirmation: "a@example.test", password }, new Headers(), "req-4");
    expect(result.deletion).toMatchObject({ status: "completed", attempts: 2, lastError: null, retryable: false });
    expect(result.setCookie).toHaveLength(1);
    expect(revoked).toEqual(["cus_a"]);

    for (const [name, table, column] of [
      ["users", users, users.id],
      ["accounts", accounts, accounts.userId],
      ["sessions", sessions, sessions.userId],
      ["resources", resources, resources.ownerUserId],
      ["tags", tags, tags.ownerUserId],
      ["projects", projects, projects.ownerUserId],
      ["audit_events", auditEvents, auditEvents.actorUserId],
      ["import_requests", importRequests, importRequests.ownerUserId],
      ["workspace_settings", workspaceSettings, workspaceSettings.ownerUserId],
      ["ai_suggestions", aiSuggestions, aiSuggestions.ownerUserId],
      ["feedback", feedback, feedback.userId],
      ["subscriptions", subscriptions, subscriptions.ownerUserId],
    ] as const) {
      expect(await rows(table, column, ownerA), name).toBe(0);
    }
    expect(await rows(contextVersions, contextVersions.projectId, projectA)).toBe(0);
    expect(await rows(exportEvents, exportEvents.projectId, projectA)).toBe(0);
    expect(await rows(projectDecisions, projectDecisions.projectId, projectA)).toBe(0);

    // The other account is untouched.
    for (const [table, column] of [[users, users.id], [sessions, sessions.userId], [resources, resources.ownerUserId], [projects, projects.ownerUserId], [auditEvents, auditEvents.actorUserId]] as const) {
      expect(await rows(table, column, ownerB)).toBeGreaterThan(0);
    }

    const [ledger] = await database.db.select().from(accountDeletions).where(eq(accountDeletions.userId, ownerA));
    expect(ledger).toMatchObject({ status: "completed", attempts: 2, billingProvider: "stub", billingCustomerId: "cus_a", billingSubscriptionId: "sub_a", billingPlan: "pro", billingStatus: "canceled" });
    expect(ledger!.billingRevokedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(ledger)).not.toContain("example.test");
  });
});

describe("legal configuration", () => {
  const base = { NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" };

  it("lists every unset fact instead of guessing and stays a draft", () => {
    const legal = legalConfigFrom(readConfig(base), { id: null, testMode: false });
    expect(legal.draft).toBe(true);
    expect(legal.missing).toEqual([
      "LEGAL_ENTITY_NAME", "LEGAL_ENTITY_ADDRESS", "LEGAL_CONTACT_EMAIL", "LEGAL_JURISDICTION", "LEGAL_EFFECTIVE_DATE",
      "HOSTING_REGION", "LEGAL_SUBPROCESSORS", "BACKUP_RETENTION_DAYS", "BILLING_RECORDS_RETENTION_YEARS", "LEGAL_APPROVED_AT",
    ]);
    expect(legal.entity).toEqual({ name: null, address: null, contactEmail: null, jurisdiction: null });
    expect(legal.processing).toMatchObject({ externalAi: false, aiProvider: null, hostingRegion: null, subprocessors: [] });
  });

  it("is final only when every fact is configured and discloses the AI provider", () => {
    const legal = legalConfigFrom(readConfig({
      ...base,
      LEGAL_ENTITY_NAME: "Example Ltd",
      LEGAL_ENTITY_ADDRESS: "1 Example Street",
      LEGAL_CONTACT_EMAIL: "privacy@example.test",
      LEGAL_JURISDICTION: "Example",
      LEGAL_EFFECTIVE_DATE: "2026-10-01",
      HOSTING_REGION: "eu-central",
      LEGAL_SUBPROCESSORS: "Hosting Co, Database Co ,",
      BACKUP_RETENTION_DAYS: "30",
      BILLING_RECORDS_RETENTION_YEARS: "10",
      LEGAL_APPROVED_AT: "2026-09-20",
    }), { id: "fake", testMode: true }, "anthropic");
    expect(legal.draft).toBe(false);
    expect(legal.missing).toEqual([]);
    expect(legal.processing).toMatchObject({ externalAi: true, aiProvider: "anthropic", billingProvider: "fake", billingTestMode: true, subprocessors: ["Hosting Co", "Database Co"] });
    expect(legal.retention).toEqual({ accountDeletion: "immediate", billingRecordsYears: 10, backupDays: 30 });
  });
});
