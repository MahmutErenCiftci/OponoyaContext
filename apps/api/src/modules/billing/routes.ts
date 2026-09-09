import type { FastifyInstance, FastifyRequest } from "fastify";
import { billingTestCheckoutSchema, billingTestPortalSchema } from "@devcontext/contracts";
import { z } from "zod";
import type { BillingService } from "./service.js";

const sessionParamsSchema = z.object({ sessionId: z.string().min(1).max(200) });

function ownerId(request: { currentUser: { id: string } | null }) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser.id;
}

function actor(request: FastifyRequest) {
  return { actorUserId: ownerId(request), requestId: request.id };
}

/**
 * Plan, usage and the provider boundary. The browser never sends plan, price
 * or customer identifiers; it only receives redirect URLs. The webhook route
 * is unauthenticated by design and verifies the provider signature over the
 * raw body inside its own content-type scope.
 */
export async function registerBillingRoutes(app: FastifyInstance, billing: BillingService) {
  app.get("/v1/billing", { preHandler: app.authenticate }, async (request) => ({
    billing: await billing.summary(ownerId(request)),
  }));

  app.post("/v1/billing/checkout", { preHandler: app.authenticate }, async (request) => {
    const user = request.currentUser!;
    const result = await billing.checkout(user.id, user.email);
    await app.telemetry.record(actor(request), { action: "billing.checkout_started", entityType: "account", entityId: user.id, metadata: { provider: billing.provider.id } });
    return result;
  });

  app.post("/v1/billing/portal", { preHandler: app.authenticate }, async (request) => {
    const result = await billing.portal(ownerId(request));
    await app.telemetry.record(actor(request), { action: "billing.portal_opened", entityType: "account", entityId: ownerId(request), metadata: { provider: billing.provider.id } });
    return result;
  });

  app.post("/v1/billing/reconcile", { preHandler: app.authenticate }, async (request) => {
    const result = await billing.reconcile(ownerId(request));
    await app.telemetry.record(actor(request), {
      action: "billing.reconciled", entityType: "account", entityId: ownerId(request),
      metadata: { provider: billing.provider.id, plan: result.entitlement.plan, status: result.subscription.status },
    });
    return result;
  });

  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
    scope.post("/v1/billing/webhook", async (request, reply) => {
      const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const outcome = await billing.processWebhook(rawBody, request.headers);
      if (outcome.ownerUserId) {
        await app.telemetry.record({ actorUserId: outcome.ownerUserId, requestId: request.id }, {
          action: "billing.webhook_processed", entityType: "account", entityId: outcome.ownerUserId,
          metadata: { provider: billing.provider.id, type: outcome.type, status: outcome.status },
        });
      } else {
        app.log.warn({ category: "billing", provider: billing.provider.id, type: outcome.type, status: outcome.status, requestId: request.id }, "Billing webhook not matched to an account");
      }
      return reply.code(200).send({ received: true, eventId: outcome.eventId, status: outcome.status });
    });
  });

  if (billing.provider.testMode) {
    app.post("/v1/billing/test/checkout/:sessionId", { preHandler: app.authenticate }, async (request) => {
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const { outcome } = billingTestCheckoutSchema.parse(request.body ?? {});
      return billing.testCheckout(ownerId(request), sessionId, outcome);
    });

    app.post("/v1/billing/test/portal", { preHandler: app.authenticate }, async (request) => {
      const { action } = billingTestPortalSchema.parse(request.body ?? {});
      return billing.testPortal(ownerId(request), action);
    });
  }
}
