import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billingEvents, eq, projects, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import type { BillingWebhookEvent } from "../src/modules/billing/provider.js";
import { createSubscriptionRepository, createUsageRepository, type SubscriptionRepository } from "../src/modules/billing/repository.js";
import type { UsageRepository } from "../src/modules/billing/entitlements.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";

let database: Pick<Database, "db" | "close">;
let subscriptions: SubscriptionRepository;
let usage: UsageRepository;

function event(id: string, createdAt: string, overrides: Partial<BillingWebhookEvent["subscription"]> = {}, type: BillingWebhookEvent["type"] = "subscription.updated"): BillingWebhookEvent {
  return {
    id, type, createdAt: new Date(createdAt),
    subscription: {
      customerId: "cus_a", subscriptionId: "sub_a", ownerUserId: null, status: "active", plan: "pro",
      currentPeriodStart: new Date("2026-09-01T00:00:00Z"), currentPeriodEnd: new Date("2026-10-01T00:00:00Z"), cancelAtPeriodEnd: false, canceledAt: null, ...overrides,
    },
  };
}

beforeAll(async () => {
  database = await createTestDatabase();
  subscriptions = createSubscriptionRepository(database);
  usage = createUsageRepository(database);
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("subscription repository", () => {
  it("applies events once, matches later events by provider ids and ignores stale ones", async () => {
    expect(await subscriptions.find(ownerA)).toBeNull();
    const unmatched = await subscriptions.applyEvent("fake", event("evt_0", "2026-09-01T00:00:00Z"));
    expect(unmatched).toEqual({ status: "unmatched", ownerUserId: null });
    expect(await subscriptions.find(ownerA)).toBeNull();

    const first = await subscriptions.applyEvent("fake", event("evt_1", "2026-09-01T00:00:10Z", { ownerUserId: ownerA }, "checkout.completed"));
    expect(first).toEqual({ status: "processed", ownerUserId: ownerA });
    expect(await subscriptions.find(ownerA)).toMatchObject({ plan: "pro", status: "active", provider: "fake", providerCustomerId: "cus_a", providerSubscriptionId: "sub_a", cancelAtPeriodEnd: false });

    const duplicate = await subscriptions.applyEvent("fake", event("evt_1", "2026-09-01T00:00:10Z", { ownerUserId: ownerA, status: "canceled" }));
    expect(duplicate.status).toBe("duplicate");
    expect((await subscriptions.find(ownerA))?.status).toBe("active");

    const cancel = await subscriptions.applyEvent("fake", event("evt_3", "2026-09-05T00:00:00Z", { cancelAtPeriodEnd: true, canceledAt: new Date("2026-09-05T00:00:00Z") }));
    expect(cancel).toEqual({ status: "processed", ownerUserId: ownerA });
    expect((await subscriptions.find(ownerA))?.cancelAtPeriodEnd).toBe(true);

    const stale = await subscriptions.applyEvent("fake", event("evt_2", "2026-09-03T00:00:00Z", { cancelAtPeriodEnd: false }));
    expect(stale).toEqual({ status: "ignored", ownerUserId: ownerA });
    expect((await subscriptions.find(ownerA))?.cancelAtPeriodEnd).toBe(true);

    const rows = await database.db.select({ id: billingEvents.providerEventId, status: billingEvents.status, note: billingEvents.note, owner: billingEvents.ownerUserId }).from(billingEvents).orderBy(billingEvents.receivedAt);
    expect(rows.map((row) => [row.id, row.status, row.note])).toEqual([["evt_0", "unmatched", "unknown_customer"], ["evt_1", "processed", null], ["evt_3", "processed", null], ["evt_2", "ignored", "stale"]]);
    expect(rows.filter((row) => row.status === "processed").every((row) => row.owner === ownerA)).toBe(true);
    expect(await subscriptions.find(ownerB)).toBeNull();
  });

  it("overwrites from a trusted snapshot and keeps events from another provider apart", async () => {
    const updated = await subscriptions.applySnapshot("fake", ownerA, {
      customerId: "cus_a", subscriptionId: "sub_a", ownerUserId: ownerA, status: "past_due", plan: "pro",
      currentPeriodStart: new Date("2026-09-01T00:00:00Z"), currentPeriodEnd: new Date("2026-10-01T00:00:00Z"), cancelAtPeriodEnd: true, canceledAt: null,
    }, new Date("2026-09-06T00:00:00Z"));
    expect(updated).toMatchObject({ status: "past_due", lastEventAt: new Date("2026-09-06T00:00:00Z") });
    const other = await subscriptions.applyEvent("other", event("evt_1", "2026-09-07T00:00:00Z"));
    expect(other.status).toBe("unmatched");
    expect((await subscriptions.find(ownerA))?.provider).toBe("fake");
  });

  it("counts only active entities per owner", async () => {
    await database.db.insert(resources).values([
      { ownerUserId: ownerA, name: "Active", slug: "active", type: "framework" },
      { ownerUserId: ownerA, name: "Archived", slug: "archived", type: "framework", archivedAt: new Date() },
      { ownerUserId: ownerB, name: "Foreign", slug: "foreign", type: "framework" },
    ]);
    await database.db.insert(projects).values([
      { ownerUserId: ownerA, name: "Live", slug: "live" },
      { ownerUserId: ownerA, name: "Gone", slug: "gone", status: "archived" },
    ]);
    expect(await usage.counts(ownerA)).toEqual({ projects: 1, resources: 1, profiles: 0, recipes: 0 });
    expect(await usage.counts(ownerB)).toEqual({ projects: 0, resources: 1, profiles: 0, recipes: 0 });
    await database.db.delete(users).where(eq(users.id, ownerB));
    expect(await usage.counts(ownerB)).toEqual({ projects: 0, resources: 0, profiles: 0, recipes: 0 });
  });
});
