import type { PlanLimitKey } from "@devcontext/contracts";
import { createEntitlementService, type EntitlementService, type SubscriptionRecord, type UsageRepository } from "../../src/modules/billing/entitlements.js";
import type { BillingWebhookEvent, ProviderSubscriptionSnapshot } from "../../src/modules/billing/provider.js";
import type { ApplyResult, SubscriptionRepository } from "../../src/modules/billing/repository.js";

/** In-memory subscription store with the same idempotency and ordering rules as the SQL repository. */
export type MemorySubscriptions = SubscriptionRepository & {
  records: Map<string, SubscriptionRecord>;
  events: Array<{ provider: string; id: string; status: string }>;
  set(record: SubscriptionRecord): void;
};

export function memorySubscriptions(): MemorySubscriptions {
  const records = new Map<string, SubscriptionRecord>();
  const events: MemorySubscriptions["events"] = [];
  const seen = new Set<string>();
  const apply = (provider: string, ownerUserId: string, snapshot: ProviderSubscriptionSnapshot, at: Date): SubscriptionRecord => {
    const record: SubscriptionRecord = {
      ownerUserId, plan: snapshot.plan, status: snapshot.status, provider, providerCustomerId: snapshot.customerId, providerSubscriptionId: snapshot.subscriptionId,
      currentPeriodStart: snapshot.currentPeriodStart, currentPeriodEnd: snapshot.currentPeriodEnd, cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd, canceledAt: snapshot.canceledAt, lastEventAt: at,
    };
    records.set(ownerUserId, record);
    return record;
  };
  return {
    records,
    events,
    set(record) { records.set(record.ownerUserId, record); },
    async find(ownerUserId) { return records.get(ownerUserId) ?? null; },
    async applyEvent(provider, event): Promise<ApplyResult> {
      const key = `${provider}:${event.id}`;
      if (seen.has(key)) { events.push({ provider, id: event.id, status: "duplicate" }); return { status: "duplicate", ownerUserId: null }; }
      seen.add(key);
      const ownerUserId = event.subscription.ownerUserId
        ?? [...records.values()].find((item) => item.provider === provider && item.providerCustomerId === event.subscription.customerId)?.ownerUserId
        ?? null;
      if (!ownerUserId) { events.push({ provider, id: event.id, status: "unmatched" }); return { status: "unmatched", ownerUserId: null }; }
      const current = records.get(ownerUserId);
      if (current?.lastEventAt && event.createdAt < current.lastEventAt) { events.push({ provider, id: event.id, status: "ignored" }); return { status: "ignored", ownerUserId }; }
      apply(provider, ownerUserId, event.subscription, event.createdAt);
      events.push({ provider, id: event.id, status: "processed" });
      return { status: "processed", ownerUserId };
    },
    async applySnapshot(provider, ownerUserId, snapshot, at) { return apply(provider, ownerUserId, snapshot, at); },
  };
}

export function memoryUsage(initial: Partial<Record<PlanLimitKey, number>> = {}): UsageRepository & { counts: () => Promise<Record<PlanLimitKey, number>>; set(key: PlanLimitKey, value: number): void } {
  const state: Record<PlanLimitKey, number> = { projects: 0, resources: 0, profiles: 0, recipes: 0, ...initial };
  return {
    async counts() { return { ...state }; },
    set(key, value) { state[key] = value; },
  };
}

/** Entitlements for route tests that are not about plans: everything is allowed. */
export function unlimitedEntitlements(): EntitlementService {
  return {
    async entitlement() { return { plan: "pro", reason: "active", effectiveUntil: null, paymentProblem: false, cancelAtPeriodEnd: false }; },
    async usage() { const meter = { used: 0, limit: 1_000_000, remaining: 1_000_000 }; return { projects: meter, resources: meter, profiles: meter, recipes: meter }; },
    async assertCanCreate() {},
    async assertExportTarget() {},
    async assertFeature() {},
    async historyLimit() { return 50; },
  };
}

/** Real entitlement rules over in-memory state, for plan-enforcement tests. */
export function planEntitlements(subscriptions: MemorySubscriptions, usage: UsageRepository, now: () => Date = () => new Date()) {
  return createEntitlementService(subscriptions, usage, now);
}

export function proRecord(ownerUserId: string, overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  const start = new Date("2026-09-01T00:00:00Z");
  return {
    ownerUserId, plan: "pro", status: "active", provider: "fake", providerCustomerId: `cus_${ownerUserId.slice(-4)}`, providerSubscriptionId: `sub_${ownerUserId.slice(-4)}`,
    currentPeriodStart: start, currentPeriodEnd: new Date("2026-10-01T00:00:00Z"), cancelAtPeriodEnd: false, canceledAt: null, lastEventAt: start, ...overrides,
  };
}

export type { BillingWebhookEvent };
