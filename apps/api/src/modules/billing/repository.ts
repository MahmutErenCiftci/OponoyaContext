import type { BillingWebhookStatus, PlanId, PlanLimitKey, SubscriptionStatus } from "@devcontext/contracts";
import {
  and,
  billingEvents,
  count,
  eq,
  isNull,
  profiles,
  projects,
  recipes,
  resources,
  sql,
  subscriptions,
  type RepositoryDatabase,
} from "@devcontext/db";
import type { SubscriptionRecord, UsageRepository } from "./entitlements.js";
import type { BillingWebhookEvent, ProviderSubscriptionSnapshot } from "./provider.js";

export type ApplyResult = { status: BillingWebhookStatus; ownerUserId: string | null };

export interface SubscriptionRepository {
  find(ownerUserId: string): Promise<SubscriptionRecord | null>;
  /**
   * Applies one provider event in a transaction: the event id is recorded
   * first (a duplicate returns without changes), the owner is matched by
   * checkout metadata or provider ids, and events older than the last applied
   * one are ignored so retries and reordering cannot roll state back.
   */
  applyEvent(provider: string, event: BillingWebhookEvent): Promise<ApplyResult>;
  /** Overwrites the record from a trusted provider read (reconciliation). */
  applySnapshot(provider: string, ownerUserId: string, snapshot: ProviderSubscriptionSnapshot, at: Date): Promise<SubscriptionRecord>;
}

type Row = typeof subscriptions.$inferSelect;

function toRecord(row: Row): SubscriptionRecord {
  return {
    ownerUserId: row.ownerUserId,
    // Text columns written only by this module after contract validation.
    plan: row.plan as PlanId,
    status: row.status as SubscriptionStatus,
    provider: row.provider,
    providerCustomerId: row.providerCustomerId,
    providerSubscriptionId: row.providerSubscriptionId,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    canceledAt: row.canceledAt,
    lastEventAt: row.lastEventAt,
  };
}

function snapshotValues(provider: string, snapshot: ProviderSubscriptionSnapshot, eventAt: Date) {
  return {
    plan: snapshot.plan,
    status: snapshot.status,
    provider,
    providerCustomerId: snapshot.customerId,
    providerSubscriptionId: snapshot.subscriptionId,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.canceledAt,
    lastEventAt: eventAt,
    updatedAt: new Date(),
  };
}

export function createSubscriptionRepository(database: RepositoryDatabase): SubscriptionRepository {
  return {
    async find(ownerUserId) {
      const [row] = await database.db.select().from(subscriptions).where(eq(subscriptions.ownerUserId, ownerUserId)).limit(1);
      return row ? toRecord(row) : null;
    },

    async applyEvent(provider, event) {
      return database.db.transaction(async (tx): Promise<ApplyResult> => {
        const inserted = await tx
          .insert(billingEvents)
          .values({ provider, providerEventId: event.id, type: event.type, ownerUserId: null, eventAt: event.createdAt, status: "received" })
          .onConflictDoNothing()
          .returning({ id: billingEvents.id });
        const eventRow = inserted[0];
        if (!eventRow) return { status: "duplicate", ownerUserId: null };

        const finish = async (status: BillingWebhookStatus, ownerUserId: string | null, note: string | null) => {
          await tx.update(billingEvents).set({ status, ownerUserId, note }).where(eq(billingEvents.id, eventRow.id));
          return { status, ownerUserId };
        };

        let ownerUserId = event.subscription.ownerUserId;
        if (!ownerUserId) {
          const [match] = await tx
            .select({ ownerUserId: subscriptions.ownerUserId })
            .from(subscriptions)
            .where(and(eq(subscriptions.provider, provider), eq(subscriptions.providerCustomerId, event.subscription.customerId)))
            .limit(1);
          ownerUserId = match?.ownerUserId ?? null;
        }
        if (!ownerUserId) return finish("unmatched", null, "unknown_customer");

        await tx.insert(subscriptions).values({ ownerUserId }).onConflictDoNothing();
        const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.ownerUserId, ownerUserId)).for("update");
        if (!current) return finish("unmatched", null, "missing_owner");
        if (current.lastEventAt && event.createdAt < current.lastEventAt) return finish("ignored", ownerUserId, "stale");

        await tx.update(subscriptions).set(snapshotValues(provider, event.subscription, event.createdAt)).where(eq(subscriptions.ownerUserId, ownerUserId));
        return finish("processed", ownerUserId, null);
      });
    },

    async applySnapshot(provider, ownerUserId, snapshot, at) {
      await database.db.insert(subscriptions).values({ ownerUserId }).onConflictDoNothing();
      const [row] = await database.db
        .update(subscriptions)
        .set(snapshotValues(provider, snapshot, at))
        .where(eq(subscriptions.ownerUserId, ownerUserId))
        .returning();
      return toRecord(row!);
    },
  };
}

/** Active entity counts that plan limits apply to; archived rows never count. */
export function createUsageRepository(database: RepositoryDatabase): UsageRepository {
  return {
    async counts(ownerUserId): Promise<Record<PlanLimitKey, number>> {
      const [projectRows, resourceRows, profileRows, recipeRows] = await Promise.all([
        database.db.select({ value: count() }).from(projects).where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.status, "active"))),
        database.db.select({ value: count() }).from(resources).where(and(eq(resources.ownerUserId, ownerUserId), isNull(resources.archivedAt))),
        database.db.select({ value: count() }).from(profiles).where(and(eq(profiles.ownerUserId, ownerUserId), isNull(profiles.archivedAt))),
        database.db.select({ value: count() }).from(recipes).where(and(eq(recipes.ownerUserId, ownerUserId), isNull(recipes.archivedAt))),
      ]);
      return {
        projects: projectRows[0]?.value ?? 0,
        resources: resourceRows[0]?.value ?? 0,
        profiles: profileRows[0]?.value ?? 0,
        recipes: recipeRows[0]?.value ?? 0,
      };
    },
  };
}

/** Exposed for tests that need to assert the raw event log without a second query builder. */
export const billingEventStatusExpression = sql`${billingEvents.status}`;
