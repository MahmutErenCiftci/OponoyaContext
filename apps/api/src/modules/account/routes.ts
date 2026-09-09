import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { deleteAccountRequestSchema } from "@devcontext/contracts";
import { deletionCodeOf, type AccountService } from "./service.js";

function currentUser(request: FastifyRequest) {
  if (!request.currentUser) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return request.currentUser;
}

function actor(request: FastifyRequest) {
  return { actorUserId: currentUser(request).id, requestId: request.id };
}

/**
 * Account lifecycle (Handoff 11). Export and deletion are owner-scoped through
 * the session; the legal configuration is public so the Terms and Privacy
 * pages can render for visitors. Nothing here logs names, e-mails or content.
 */
export async function registerAccountRoutes(app: FastifyInstance, account: AccountService) {
  app.get("/v1/legal", async () => ({ legal: account.legal() }));

  app.get("/v1/account", { preHandler: app.authenticate }, async (request) => ({
    account: await account.summary(currentUser(request)),
  }));

  /** Structured export: portable workspace plus account, subscription state, compiled versions, exports and audit trail. No secrets. */
  app.get("/v1/account/export", { preHandler: app.authenticate }, async (request, reply) => {
    const document = await account.exportAccount(currentUser(request));
    await app.telemetry.record(actor(request), {
      action: "account.export_downloaded", entityType: "account", entityId: currentUser(request).id,
      metadata: {
        resources: document.workspace.resources.length, projects: document.workspace.projects.length,
        contextVersions: document.contextVersions.length, auditEvents: document.auditEvents.length,
      },
    });
    const stamp = document.exportedAt.slice(0, 10);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="devcontext-account-${stamp}.json"`);
    return reply.send(JSON.stringify(document));
  });

  /**
   * Deliberate deletion: typed e-mail plus password. A blocked external step
   * answers 409 with a content-free code and leaves a retryable ledger row; a
   * success clears the session cookie and answers with the completed state.
   */
  app.delete("/v1/account", { preHandler: app.authenticate }, async (request, reply) => {
    const input = deleteAccountRequestSchema.parse(request.body ?? {});
    const user = currentUser(request);
    try {
      const result = await account.deleteAccount(user, input, fromNodeHeaders(request.headers), request.id);
      request.log.info({ category: "security", event: "account_deleted", userId: user.id, requestId: request.id }, "account_deleted");
      if (result.setCookie.length > 0) reply.header("set-cookie", result.setCookie);
      return { deleted: true, deletion: result.deletion };
    } catch (error) {
      const code = deletionCodeOf(error);
      if (code) {
        await app.telemetry.record(actor(request), { action: "account.deletion_blocked", entityType: "account", entityId: user.id, metadata: { code } });
        request.log.warn({ category: "security", event: "account_deletion_blocked", userId: user.id, code, requestId: request.id }, "account_deletion_blocked");
      }
      throw error;
    }
  });
}
