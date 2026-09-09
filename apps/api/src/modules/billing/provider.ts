import { planIdSchema, subscriptionStatusSchema, type PlanId, type SubscriptionStatus } from "@devcontext/contracts";
import { z } from "zod";

/**
 * Provider-neutral billing boundary. A concrete adapter (the in-process fake
 * today, Stripe once the owner activates an account) maps its own checkout,
 * portal and webhook formats onto these types. Core domain code depends only
 * on this file.
 *
 * Environment contract for a real adapter (validated in `config.ts`):
 * `BILLING_PROVIDER`, `BILLING_SECRET_KEY` (server-only API key),
 * `BILLING_WEBHOOK_SECRET` (raw-body signature secret), `BILLING_PRO_PRICE_ID`
 * (the Pro price on the provider) and `BILLING_PRO_PRICE_LABEL` (display text).
 */

/** The provider's view of one customer's subscription, normalised. */
export type ProviderSubscriptionSnapshot = {
  customerId: string;
  subscriptionId: string;
  /** Set from checkout metadata (`client_reference_id`); the provider ids are matched otherwise. */
  ownerUserId: string | null;
  status: SubscriptionStatus;
  plan: PlanId;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};

export const billingEventTypeSchema = z.enum([
  "checkout.completed",
  "subscription.updated",
  "subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);
export type BillingEventType = z.infer<typeof billingEventTypeSchema>;

export type BillingWebhookEvent = {
  id: string;
  type: BillingEventType;
  createdAt: Date;
  subscription: ProviderSubscriptionSnapshot;
};

/** Wire format of the normalised webhook used by the fake provider (and by tests). */
export const webhookPayloadSchema = z.object({
  id: z.string().min(1).max(200),
  type: billingEventTypeSchema,
  createdAt: z.iso.datetime(),
  subscription: z.object({
    customerId: z.string().min(1).max(200),
    subscriptionId: z.string().min(1).max(200),
    ownerUserId: z.uuid().nullable(),
    status: subscriptionStatusSchema,
    plan: planIdSchema,
    currentPeriodStart: z.iso.datetime().nullable(),
    currentPeriodEnd: z.iso.datetime().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    canceledAt: z.iso.datetime().nullable(),
  }),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export function toWebhookEvent(payload: WebhookPayload): BillingWebhookEvent {
  const s = payload.subscription;
  return {
    id: payload.id,
    type: payload.type,
    createdAt: new Date(payload.createdAt),
    subscription: {
      customerId: s.customerId,
      subscriptionId: s.subscriptionId,
      ownerUserId: s.ownerUserId,
      status: s.status,
      plan: s.plan,
      currentPeriodStart: s.currentPeriodStart ? new Date(s.currentPeriodStart) : null,
      currentPeriodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      canceledAt: s.canceledAt ? new Date(s.canceledAt) : null,
    },
  };
}

export type CheckoutInput = { ownerUserId: string; email: string; successUrl: string; cancelUrl: string };
export type PortalInput = { customerId: string; returnUrl: string };
export type RevocationInput = { customerId: string; subscriptionId: string | null };
/** `not_found` is a success: the provider no longer knows the customer, so nothing can charge them. */
export type ProviderRevocation = { status: "revoked" | "not_found" };

export interface BillingProvider {
  readonly id: string;
  /** Simulated provider: checkout and portal are in-app pages, no money moves. */
  readonly testMode: boolean;
  createCheckout(input: CheckoutInput): Promise<{ url: string; sessionId: string }>;
  createPortal(input: PortalInput): Promise<{ url: string }>;
  /** Verifies the signature over the raw body and returns the normalised event; throws `webhookSignatureError`. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): BillingWebhookEvent;
  /** Trusted read for reconciliation; null when the provider no longer knows the subscription. */
  fetchSubscription(subscriptionId: string): Promise<ProviderSubscriptionSnapshot | null>;
  /**
   * Account deletion: cancels the subscription immediately and detaches the
   * customer so no later charge or webhook can refer to the deleted user. Any
   * thrown error is treated as retryable and blocks the deletion.
   */
  revokeCustomer(input: RevocationInput): Promise<ProviderRevocation>;
}

export type BillingRevocationCode = "billing_provider_unavailable" | "billing_provider_not_configured";

/** Deletion stops here and stays retryable; the user is told nothing was deleted. */
export function billingRevocationError(code: BillingRevocationCode) {
  return Object.assign(new Error(`Billing revocation failed: ${code}`), {
    statusCode: 409,
    details: [{ path: ["billing"], code }],
    publicMessage: code === "billing_provider_not_configured"
      ? "Your subscription is linked to a payment provider that is not configured on this server, so it cannot be cancelled automatically. Nothing was deleted; contact support or try again once billing is configured."
      : "The payment provider could not be reached to cancel your subscription. Nothing was deleted; try again in a few minutes.",
    deletionCode: code,
  });
}

export function webhookSignatureError(reason: string) {
  return Object.assign(new Error(`Webhook signature ${reason}`), {
    statusCode: 400,
    details: [{ path: ["signature"], code: "webhook_signature_invalid" }],
    publicMessage: "The webhook signature could not be verified.",
  });
}

export function billingUnavailableError() {
  return Object.assign(new Error("Billing provider is not configured"), {
    statusCode: 409,
    details: [{ path: ["provider"], code: "billing_unavailable" }],
    publicMessage: "Billing is not available in this environment yet. The Free plan keeps working; nothing was changed.",
  });
}

export function subscriptionMissingError() {
  return Object.assign(new Error("No provider subscription"), {
    statusCode: 409,
    details: [{ path: ["subscription"], code: "subscription_missing" }],
    publicMessage: "There is no subscription to manage yet.",
  });
}
