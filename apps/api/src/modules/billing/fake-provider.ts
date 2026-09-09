import { randomUUID } from "node:crypto";
import type { SubscriptionStatus } from "@devcontext/contracts";
import {
  toWebhookEvent,
  webhookPayloadSchema,
  webhookSignatureError,
  type BillingEventType,
  type BillingProvider,
  type ProviderSubscriptionSnapshot,
  type WebhookPayload,
} from "./provider.js";
import { signWebhook, signatureHeader, verifyWebhookSignature } from "./signature.js";

/**
 * In-process billing provider for development, tests and Playwright. Checkout
 * and portal are pages of the web app that call the test routes; every state
 * change is delivered as a signed webhook through the real webhook route, so
 * signature verification, idempotency and reordering are exercised end to end.
 * State lives in memory and is lost on restart; nothing here touches money.
 */
export type FakeCheckoutOutcome = "paid" | "failed" | "canceled";
export type FakePortalAction = "cancel" | "resume" | "renew" | "fail_renewal" | "expire";

type FakeSubscription = ProviderSubscriptionSnapshot & { email: string };
type CheckoutSession = { id: string; ownerUserId: string; email: string; successUrl: string; cancelUrl: string; completed: boolean };

export type WebhookDelivery = (rawBody: Buffer, headers: Record<string, string>) => Promise<void>;

export type FakeProvider = BillingProvider & {
  /** Completes a checkout session the way the hosted page would; returns where to send the browser. */
  completeCheckout(sessionId: string, ownerUserId: string, outcome: FakeCheckoutOutcome): Promise<{ url: string }>;
  /** Portal actions for the caller's customer. */
  portalAction(customerId: string, action: FakePortalAction, returnUrl: string): Promise<{ url: string }>;
  customerFor(ownerUserId: string): string | null;
  /** Sends an arbitrary normalised event (tests use it for reordering and unknown customers). */
  emit(payload: WebhookPayload): Promise<void>;
};

export const fakePeriodMs = 30 * 24 * 60 * 60 * 1000;

export function createFakeProvider(options: { secret: string; webOrigin: string; now?: () => Date; deliver: WebhookDelivery }): FakeProvider {
  const now = options.now ?? (() => new Date());
  const sessions = new Map<string, CheckoutSession>();
  const subscriptions = new Map<string, FakeSubscription>();
  const customerByOwner = new Map<string, string>();
  let eventCounter = 0;

  function snapshot(subscription: FakeSubscription): ProviderSubscriptionSnapshot {
    const { email: _email, ...rest } = subscription;
    void _email;
    return rest;
  }

  async function emit(payload: WebhookPayload) {
    const rawBody = Buffer.from(JSON.stringify(payload));
    await options.deliver(rawBody, { [signatureHeader]: signWebhook(options.secret, rawBody, Math.floor(now().getTime() / 1000)), "content-type": "application/json" });
  }

  async function publish(type: BillingEventType, subscription: FakeSubscription) {
    eventCounter += 1;
    const s = snapshot(subscription);
    await emit({
      id: `evt_fake_${String(eventCounter).padStart(6, "0")}_${randomUUID().slice(0, 8)}`,
      type,
      createdAt: now().toISOString(),
      subscription: {
        ...s,
        currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
        canceledAt: s.canceledAt?.toISOString() ?? null,
      },
    });
  }

  function subscriptionOf(customerId: string) {
    const subscription = subscriptions.get(customerId);
    if (!subscription) throw Object.assign(new Error("Unknown fake customer"), { statusCode: 404 });
    return subscription;
  }

  function setStatus(subscription: FakeSubscription, status: SubscriptionStatus) {
    subscription.status = status;
  }

  return {
    id: "fake",
    testMode: true,
    async createCheckout(input) {
      const id = `cs_fake_${randomUUID()}`;
      sessions.set(id, { id, ownerUserId: input.ownerUserId, email: input.email, successUrl: input.successUrl, cancelUrl: input.cancelUrl, completed: false });
      return { url: `${options.webOrigin}/billing/checkout?session=${encodeURIComponent(id)}`, sessionId: id };
    },
    async createPortal(input) {
      subscriptionOf(input.customerId);
      return { url: `${options.webOrigin}/billing/portal?customer=${encodeURIComponent(input.customerId)}&return=${encodeURIComponent(input.returnUrl)}` };
    },
    parseWebhook(rawBody, headers) {
      const raw = headers[signatureHeader];
      const verdict = verifyWebhookSignature(options.secret, rawBody, Array.isArray(raw) ? raw[0] : raw, now());
      if (!verdict.ok) throw webhookSignatureError(verdict.reason);
      let parsed: unknown;
      try { parsed = JSON.parse(rawBody.toString("utf8")); } catch { throw webhookSignatureError("body"); }
      const payload = webhookPayloadSchema.safeParse(parsed);
      if (!payload.success) throw webhookSignatureError("payload");
      return toWebhookEvent(payload.data);
    },
    async fetchSubscription(subscriptionId) {
      const found = [...subscriptions.values()].find((item) => item.subscriptionId === subscriptionId);
      return found ? snapshot(found) : null;
    },
    /** Deletion path: the customer disappears without a webhook, exactly like a provider-side customer delete. */
    async revokeCustomer(input) {
      if (!subscriptions.has(input.customerId)) return { status: "not_found" };
      subscriptions.delete(input.customerId);
      for (const [owner, customer] of customerByOwner) if (customer === input.customerId) customerByOwner.delete(owner);
      return { status: "revoked" };
    },
    customerFor(ownerUserId) {
      return customerByOwner.get(ownerUserId) ?? null;
    },
    async completeCheckout(sessionId, ownerUserId, outcome) {
      const session = sessions.get(sessionId);
      if (!session || session.ownerUserId !== ownerUserId) throw Object.assign(new Error("Unknown checkout session"), { statusCode: 404, publicMessage: "This checkout session does not exist or belongs to another account." });
      if (outcome === "canceled") return { url: session.cancelUrl };
      if (session.completed) return { url: session.successUrl };
      session.completed = true;
      const customerId = customerByOwner.get(ownerUserId) ?? `cus_fake_${randomUUID().slice(0, 12)}`;
      customerByOwner.set(ownerUserId, customerId);
      const start = now();
      const subscription: FakeSubscription = {
        customerId,
        subscriptionId: subscriptions.get(customerId)?.subscriptionId ?? `sub_fake_${randomUUID().slice(0, 12)}`,
        ownerUserId,
        email: session.email,
        status: outcome === "paid" ? "active" : "incomplete",
        plan: "pro",
        currentPeriodStart: outcome === "paid" ? start : null,
        currentPeriodEnd: outcome === "paid" ? new Date(start.getTime() + fakePeriodMs) : null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      };
      subscriptions.set(customerId, subscription);
      await publish(outcome === "paid" ? "checkout.completed" : "invoice.payment_failed", subscription);
      return { url: outcome === "paid" ? session.successUrl : session.cancelUrl };
    },
    async portalAction(customerId, action, returnUrl) {
      const subscription = subscriptionOf(customerId);
      const current = now();
      switch (action) {
        case "cancel":
          subscription.cancelAtPeriodEnd = true;
          subscription.canceledAt = current;
          await publish("subscription.updated", subscription);
          break;
        case "resume":
          subscription.cancelAtPeriodEnd = false;
          subscription.canceledAt = null;
          setStatus(subscription, "active");
          await publish("subscription.updated", subscription);
          break;
        case "renew":
          setStatus(subscription, "active");
          subscription.currentPeriodStart = current;
          subscription.currentPeriodEnd = new Date(current.getTime() + fakePeriodMs);
          await publish("invoice.paid", subscription);
          break;
        case "fail_renewal":
          setStatus(subscription, "past_due");
          await publish("invoice.payment_failed", subscription);
          break;
        case "expire":
          setStatus(subscription, "canceled");
          subscription.cancelAtPeriodEnd = false;
          subscription.canceledAt = current;
          subscription.currentPeriodEnd = current;
          await publish("subscription.deleted", subscription);
          break;
      }
      return { url: returnUrl };
    },
    emit,
  };
}
