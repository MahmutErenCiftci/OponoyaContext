import type { BillingProviderInfo, BillingSummary, BillingWebhookStatus, Entitlement, PlanId, SubscriptionStatus, SubscriptionView } from "@devcontext/contracts";
import { resolveEntitlement, type EntitlementService, type SubscriptionRecord } from "./entitlements.js";
import type { FakeCheckoutOutcome, FakePortalAction, FakeProvider } from "./fake-provider.js";
import { planDefinitions } from "./plans.js";
import { billingRevocationError, billingUnavailableError, subscriptionMissingError, type BillingProvider } from "./provider.js";
import type { SubscriptionRepository } from "./repository.js";

export type WebhookOutcome = { eventId: string; type: string; status: BillingWebhookStatus; ownerUserId: string | null };

/** What remains of a deleted account's billing linkage: provider identifiers only, never card or invoice data. */
export type BillingRevocation = {
  provider: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  /** False only when there was a provider customer that could not be revoked (the call throws in that case). */
  revoked: boolean;
};

export interface BillingService {
  readonly provider: BillingProviderInfo;
  summary(ownerUserId: string): Promise<BillingSummary>;
  /** Starts an upgrade; the plan and price are fixed server-side, the browser only receives a redirect. */
  checkout(ownerUserId: string, email: string): Promise<{ url: string }>;
  portal(ownerUserId: string): Promise<{ url: string }>;
  processWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<WebhookOutcome>;
  /** Recovery path: re-read the subscription from the provider and overwrite local state. */
  reconcile(ownerUserId: string): Promise<{ entitlement: Entitlement; subscription: SubscriptionView }>;
  /** Test-mode controls; reject unless the fake provider is active. */
  testCheckout(ownerUserId: string, sessionId: string, outcome: FakeCheckoutOutcome): Promise<{ url: string }>;
  testPortal(ownerUserId: string, action: FakePortalAction): Promise<{ url: string }>;
  /**
   * Account deletion step (Handoff 11): cancels the provider subscription and
   * returns the identifiers kept as the minimal billing record. Throws a
   * retryable 409 when a linked provider cannot be reached or is not
   * configured; a Free account without a provider customer needs nothing.
   */
  revokeForDeletion(ownerUserId: string): Promise<BillingRevocation>;
}

export type BillingUrls = { success: string; cancel: string; portalReturn: string };

export function toSubscriptionView(record: SubscriptionRecord | null): SubscriptionView {
  return {
    status: record?.status ?? "none",
    provider: record?.provider ?? null,
    currentPeriodStart: record?.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: record?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
    canceledAt: record?.canceledAt?.toISOString() ?? null,
    manageable: Boolean(record?.providerCustomerId),
  };
}

export function createBillingService(options: {
  provider: BillingProvider | null;
  subscriptions: SubscriptionRepository;
  entitlements: EntitlementService;
  urls: BillingUrls;
  proPriceLabel: string | null;
  now?: () => Date;
}): BillingService {
  const { provider, subscriptions, entitlements, urls } = options;
  const now = options.now ?? (() => new Date());
  const fake = provider && provider.id === "fake" ? (provider as FakeProvider) : null;

  function requireProvider(): BillingProvider {
    if (!provider) throw billingUnavailableError();
    return provider;
  }

  return {
    provider: { id: provider?.id ?? null, configured: provider !== null, testMode: provider?.testMode ?? false },

    async summary(ownerUserId) {
      const [record, usage] = await Promise.all([subscriptions.find(ownerUserId), entitlements.usage(ownerUserId)]);
      return {
        entitlement: resolveEntitlement(record, now()),
        usage,
        subscription: toSubscriptionView(record),
        provider: this.provider,
        plans: planDefinitions(options.proPriceLabel),
      };
    },

    async checkout(ownerUserId, email) {
      const active = requireProvider();
      const session = await active.createCheckout({ ownerUserId, email, successUrl: urls.success, cancelUrl: urls.cancel });
      return { url: session.url };
    },

    async portal(ownerUserId) {
      const active = requireProvider();
      const record = await subscriptions.find(ownerUserId);
      if (!record?.providerCustomerId || record.provider !== active.id) throw subscriptionMissingError();
      return active.createPortal({ customerId: record.providerCustomerId, returnUrl: urls.portalReturn });
    },

    async processWebhook(rawBody, headers) {
      const active = requireProvider();
      const event = active.parseWebhook(rawBody, headers);
      const result = await subscriptions.applyEvent(active.id, event);
      return { eventId: event.id, type: event.type, status: result.status, ownerUserId: result.ownerUserId };
    },

    async reconcile(ownerUserId) {
      const active = requireProvider();
      const record = await subscriptions.find(ownerUserId);
      if (!record?.providerSubscriptionId || record.provider !== active.id) throw subscriptionMissingError();
      const snapshot = await active.fetchSubscription(record.providerSubscriptionId);
      const updated = snapshot
        ? await subscriptions.applySnapshot(active.id, ownerUserId, { ...snapshot, ownerUserId }, now())
        : await subscriptions.applySnapshot(active.id, ownerUserId, {
          customerId: record.providerCustomerId ?? "",
          subscriptionId: record.providerSubscriptionId,
          ownerUserId,
          status: "expired",
          plan: record.plan,
          currentPeriodStart: record.currentPeriodStart,
          currentPeriodEnd: record.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: record.canceledAt ?? now(),
        }, now());
      return { entitlement: resolveEntitlement(updated, now()), subscription: toSubscriptionView(updated) };
    },

    async testCheckout(ownerUserId, sessionId, outcome) {
      if (!fake) throw billingUnavailableError();
      return fake.completeCheckout(sessionId, ownerUserId, outcome);
    },

    async testPortal(ownerUserId, action) {
      if (!fake) throw billingUnavailableError();
      const record = await subscriptions.find(ownerUserId);
      if (!record?.providerCustomerId) throw subscriptionMissingError();
      return fake.portalAction(record.providerCustomerId, action, urls.portalReturn);
    },

    async revokeForDeletion(ownerUserId) {
      const record = await subscriptions.find(ownerUserId);
      const base = {
        provider: record?.provider ?? null,
        customerId: record?.providerCustomerId ?? null,
        subscriptionId: record?.providerSubscriptionId ?? null,
        plan: record?.plan ?? "free" as PlanId,
        status: record?.status ?? "none" as SubscriptionStatus,
      };
      if (!record?.providerCustomerId) return { ...base, revoked: true };
      if (!provider || provider.id !== record.provider) throw billingRevocationError("billing_provider_not_configured");
      try {
        await provider.revokeCustomer({ customerId: record.providerCustomerId, subscriptionId: record.providerSubscriptionId });
      } catch {
        throw billingRevocationError("billing_provider_unavailable");
      }
      return { ...base, status: "canceled", revoked: true };
    },
  };
}
