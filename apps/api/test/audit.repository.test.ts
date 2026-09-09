import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditEvents, count, eq, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createAuditRepository, type AuditRepository } from "../src/modules/audit/repository.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000030";
const profileId = "00000000-0000-4000-8000-000000000070";

let database: Pick<Database, "db" | "close">;
let audit: AuditRepository;

beforeAll(async () => {
  database = await createTestDatabase();
  audit = createAuditRepository(database);
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("audit trail persistence", () => {
  it("appends events and lists them newest first with owner scoping and filters", async () => {
    await audit.record({ actorUserId: ownerA, action: "project.created", entityType: "project", entityId: projectId, metadata: { stage: "mvp" }, requestId: "req-1" });
    await audit.record({ actorUserId: ownerA, action: "project.decision_changed", entityType: "project", entityId: projectId, metadata: { slot: "frontend.framework", mode: "LOCKED", resourceId: null }, requestId: "req-2" });
    await audit.record({ actorUserId: ownerA, action: "profile.created", entityType: "profile", entityId: profileId, metadata: { type: "stack" }, requestId: null });
    await audit.record({ actorUserId: ownerB, action: "project.created", entityType: "project", entityId: null, metadata: {}, requestId: "req-9" });

    const all = await audit.list(ownerA, { limit: 20 });
    expect(all.map((event) => event.action)).toEqual(["profile.created", "project.decision_changed", "project.created"]);
    expect(all[2]).toMatchObject({ entityType: "project", entityId: projectId, metadata: { stage: "mvp" }, requestId: "req-1" });
    expect(all[2]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((await audit.list(ownerA, { entityType: "project", limit: 20 })).map((event) => event.action)).toEqual(["project.decision_changed", "project.created"]);
    expect((await audit.list(ownerA, { entityId: profileId, limit: 20 })).map((event) => event.action)).toEqual(["profile.created"]);
    expect((await audit.list(ownerA, { limit: 1 })).map((event) => event.action)).toEqual(["profile.created"]);
    expect((await audit.list(ownerB, { limit: 20 })).map((event) => event.requestId)).toEqual(["req-9"]);
  });

  it("exposes no update or delete and follows the actor on account deletion", async () => {
    expect(Object.keys(audit).sort()).toEqual(["list", "record"]);
    await database.db.delete(users).where(eq(users.id, ownerB));
    expect(await audit.list(ownerB, { limit: 20 })).toEqual([]);
    expect((await database.db.select({ value: count() }).from(auditEvents))[0]?.value).toBe(3);
  });
});
