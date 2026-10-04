import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accountDeletions,
  auditEvents,
  contextVersions,
  eq,
  exportEvents,
  feedback,
  projects,
  resources,
  sessions,
  users,
  workspaceSamples,
  type Database,
} from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { adminOverviewSchema } from "@devcontext/contracts";
import { createAdminRepository } from "../src/modules/admin/repository.js";
import { createFeedbackRepository } from "../src/modules/feedback/repository.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const ownerC = "00000000-0000-4000-8000-000000000003";
const dayMs = 86_400_000;
const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * dayMs);

let database: Pick<Database, "db" | "close">;

beforeAll(async () => {
  database = await createTestDatabase();
  const { db } = database;
  // A signed up two days ago, B forty days ago (outside every window), C just now.
  await db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A", createdAt: ago(2) },
    { id: ownerB, email: "b@example.test", name: "Owner B", createdAt: ago(40) },
    { id: ownerC, email: "c@example.test", name: "Owner C", createdAt: now },
  ]);
  await db.insert(sessions).values([
    { userId: ownerA, token: "token-a", expiresAt: new Date(now.getTime() + dayMs), updatedAt: ago(1) },
    { userId: ownerB, token: "token-b", expiresAt: ago(10), updatedAt: ago(20) },
  ]);
  await db.insert(auditEvents).values({ actorUserId: ownerC, action: "account.created", entityType: "account", entityId: ownerC });

  const [ownResource, sampleResourceA, sampleResourceB] = await db.insert(resources).values([
    { ownerUserId: ownerA, name: "Next.js", slug: "nextjs", type: "framework" },
    { ownerUserId: ownerA, name: "Sample · Hono", slug: "sample-hono", type: "framework" },
    { ownerUserId: ownerB, name: "Sample · Hono", slug: "sample-hono", type: "framework" },
  ]).returning();
  const [projectA1, projectA2, sampleProjectB, projectC] = await db.insert(projects).values([
    { ownerUserId: ownerA, name: "Atlas", slug: "atlas" },
    { ownerUserId: ownerA, name: "Beacon", slug: "beacon" },
    { ownerUserId: ownerB, name: "Sample · Demo", slug: "sample-demo" },
    { ownerUserId: ownerC, name: "Comet", slug: "comet" },
  ]).returning();
  await db.insert(workspaceSamples).values([
    { ownerUserId: ownerA, version: "1", key: "resource:hono", entityType: "resource", entityId: sampleResourceA!.id },
    { ownerUserId: ownerB, version: "1", key: "resource:hono", entityType: "resource", entityId: sampleResourceB!.id },
    { ownerUserId: ownerB, version: "1", key: "project:demo", entityType: "project", entityId: sampleProjectB!.id },
  ]);
  expect(ownResource).toBeDefined();
  expect(projectA2).toBeDefined();
  const [version] = await db.insert(contextVersions).values({ projectId: projectA1!.id, version: 1, compilerVersion: "0.4.4", canonical: {}, contentHash: "sha256:a" }).returning();
  expect(version).toBeDefined();
  await db.insert(exportEvents).values({ projectId: projectC!.id, target: "agents" });
  await db.insert(accountDeletions).values({ userId: "00000000-0000-4000-8000-0000000000dd", status: "completed" });
}, 60_000);

afterAll(async () => { await database.close(); });

describe("operator overview", () => {
  it("counts sign-ups, activity and the funnel per user, leaving sample entities out", async () => {
    const overview = adminOverviewSchema.parse(await createAdminRepository(database).overview(now));
    expect(overview.users).toEqual({ total: 3, last24h: 1, last7d: 2, last30d: 2, active7d: 2, active30d: 3, deleted: 1 });
    expect(overview.funnel).toEqual({ signedUp: 3, addedResource: 1, createdProject: 2, compiledContext: 1, exportedContext: 1, secondProject: 1 });
    expect(overview.totals).toMatchObject({ projects: 4, resources: 3, contextVersions: 1, exports: 1, sampleInstalls: 2, proSubscriptions: 0 });

    expect(overview.signupsByDay).toHaveLength(30);
    expect(overview.signupsByDay.reduce((sum, day) => sum + day.count, 0)).toBe(2);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
    expect(overview.signupsByDay.at(-1)).toEqual({ date: today, count: 1 });

    expect(overview.recentUsers.map((user) => [user.email, user.projects])).toEqual([["c@example.test", 1], ["a@example.test", 2], ["b@example.test", 0]]);
    const [userC, userA] = overview.recentUsers;
    expect(userC?.lastSeenAt).toBeNull();
    expect(Date.parse(userA!.lastSeenAt!)).toBeCloseTo(ago(1).getTime(), -3);
  });

  it("counts feedback per triage state", async () => {
    const repository = createFeedbackRepository(database);
    const first = await repository.create(ownerA, { kind: "bug", message: "Kaydet düğmesi çalışmıyor.", pagePath: "/workspace/projects" });
    await repository.create(ownerB, { kind: "suggestion", message: "Daha koyu bir yan menü olsun." });
    await repository.setStatus(first.feedback.id, "resolved");
    const overview = await createAdminRepository(database).overview(now);
    expect(overview.feedback).toEqual({ new: 1, reviewing: 0, resolved: 1, dismissed: 0 });
  });
});

describe("feedback persistence", () => {
  it("ignores a double submit, scopes own lists and joins the author for operators", async () => {
    const repository = createFeedbackRepository(database);
    const first = await repository.create(ownerC, { kind: "complaint", message: "Sayfa çok yavaş açılıyor." });
    const again = await repository.create(ownerC, { kind: "complaint", message: "Sayfa çok yavaş açılıyor." });
    expect(first.created).toBe(true);
    expect(again).toEqual({ feedback: first.feedback, created: false });
    expect((await repository.listOwn(ownerC, 20)).map((item) => item.message)).toEqual(["Sayfa çok yavaş açılıyor."]);

    const inbox = await repository.listAll({ status: "new", limit: 50 });
    expect(inbox.map((item) => item.user.email).sort()).toEqual(["b@example.test", "c@example.test"]);
    expect(inbox.find((item) => item.user.id === ownerC)).toMatchObject({ kind: "complaint", status: "new", pagePath: null });
    expect(await repository.setStatus("00000000-0000-4000-8000-0000000000ff", "resolved")).toBeNull();

    await database.db.delete(users).where(eq(users.id, ownerC));
    expect(await repository.listOwn(ownerC, 20)).toEqual([]);
    expect((await database.db.select().from(feedback)).some((row) => row.userId === ownerC)).toBe(false);
  });
});
