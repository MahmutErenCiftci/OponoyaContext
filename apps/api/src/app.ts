import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";
import Fastify, { LogController } from "fastify";
import cors from "@fastify/cors";
import { createDatabase, type Database } from "@devcontext/db";
import type { AppConfig, LogLevel } from "./config.js";
import { registerErrorHandlers } from "./errors.js";
import { registerClientIp } from "./lib/client-ip.js";
import { createErrorReporter, type ErrorReporter } from "./lib/error-reporter.js";
import { registerObservability, registerOriginGuard } from "./lib/observability.js";
import { createRateLimiter, defaultRateLimitPolicy, type RateLimitPolicy } from "./lib/rate-limit.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { createAccountRepository } from "./modules/account/repository.js";
import { registerAccountRoutes } from "./modules/account/routes.js";
import { createAccountService, type AccountService } from "./modules/account/service.js";
import { createAnthropicProvider } from "./modules/ai/anthropic-provider.js";
import { createFakeAiProvider } from "./modules/ai/fake-provider.js";
import type { AiProvider } from "./modules/ai/provider.js";
import { createAiRepository } from "./modules/ai/repository.js";
import { registerAiRoutes } from "./modules/ai/routes.js";
import { createAiService, type AiService } from "./modules/ai/service.js";
import { createAuditRepository, type AuditRepository } from "./modules/audit/repository.js";
import { registerAuditRoutes } from "./modules/audit/routes.js";
import { registerCatalogRoutes } from "./modules/catalog/routes.js";
import { createCatalogService, type CatalogService } from "./modules/catalog/service.js";
import { createCatalogTransaction } from "./modules/catalog/transaction.js";
import { createEntitlementService, type EntitlementService } from "./modules/billing/entitlements.js";
import { createFakeProvider } from "./modules/billing/fake-provider.js";
import type { BillingProvider } from "./modules/billing/provider.js";
import { createSubscriptionRepository, createUsageRepository, type SubscriptionRepository } from "./modules/billing/repository.js";
import { registerBillingRoutes } from "./modules/billing/routes.js";
import { createBillingService, type BillingService } from "./modules/billing/service.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { createAuthProvider, type AuthProvider } from "./modules/auth/service.js";
import { createLogEmailSender, type EmailSender } from "./modules/email/sender.js";
import { createCompatibilityRepository } from "./modules/compatibility/repository.js";
import { registerCompatibilityRoutes } from "./modules/compatibility/routes.js";
import { createCompatibilityService, type CompatibilityService } from "./modules/compatibility/service.js";
import { createSearchRepository } from "./modules/search/repository.js";
import { registerSearchRoutes } from "./modules/search/routes.js";
import { createSearchService, type SearchService } from "./modules/search/service.js";
import { createTelemetry, type Telemetry } from "./modules/telemetry/service.js";
import { createWorkspaceRepository, type WorkspaceRepository } from "./modules/workspace/repository.js";
import { registerWorkspaceRoutes } from "./modules/workspace/routes.js";
import { createRecipeRepository } from "./modules/recipes/repository.js";
import { registerRecipeRoutes } from "./modules/recipes/routes.js";
import { createRecipeService, type RecipeService } from "./modules/recipes/service.js";
import { createSampleTransaction } from "./modules/samples/transaction.js";
import { registerSampleRoutes } from "./modules/samples/routes.js";
import { createSampleService, type SampleService } from "./modules/samples/service.js";
import { createPortabilityRepository } from "./modules/portability/repository.js";
import { registerPortabilityRoutes } from "./modules/portability/routes.js";
import { createPortabilityService, type PortabilityService } from "./modules/portability/service.js";
import { createContextRepository } from "./modules/context/repository.js";
import { registerContextRoutes } from "./modules/context/routes.js";
import { createContextService, type ContextService } from "./modules/context/service.js";
import { createDecisionRepository } from "./modules/decisions/repository.js";
import { registerDecisionRoutes } from "./modules/decisions/routes.js";
import { createDecisionService, type DecisionService } from "./modules/decisions/service.js";
import { createProfileRepository } from "./modules/profiles/repository.js";
import { registerProfileRoutes } from "./modules/profiles/routes.js";
import { createProfileService, type ProfileService } from "./modules/profiles/service.js";
import { createProjectRepository } from "./modules/projects/repository.js";
import { registerProjectRoutes } from "./modules/projects/routes.js";
import { createProjectService, type ProjectService } from "./modules/projects/service.js";
import { createResourceRepository } from "./modules/resources/repository.js";
import { registerResourceRoutes } from "./modules/resources/routes.js";
import { createResourceService, type ResourceService } from "./modules/resources/service.js";

/** Largest accepted JSON body. Contracts cap every field far below this; the limit stops raw floods. */
export const requestBodyLimit = 1_048_576;

export type AppDependencies = {
  auth?: AuthProvider;
  resources?: ResourceService;
  projects?: ProjectService;
  decisions?: DecisionService;
  context?: ContextService;
  profiles?: ProfileService;
  compatibility?: CompatibilityService;
  search?: SearchService;
  recipes?: RecipeService;
  workspace?: WorkspaceRepository;
  samples?: SampleService;
  portability?: PortabilityService;
  catalog?: CatalogService;
  /** Plan enforcement; route tests that are not about plans inject `unlimitedEntitlements()`. */
  entitlements?: EntitlementService;
  subscriptions?: SubscriptionRepository;
  billingProvider?: BillingProvider | null;
  billing?: BillingService;
  audit?: AuditRepository;
  /** Account export, deletion and legal configuration (Handoff 11). */
  account?: AccountService;
  /** AI provider override; `null` disables AI regardless of configuration. */
  aiProvider?: AiProvider | null;
  ai?: AiService;
  /** Error reporting transport (Handoff 12); tests inject a recorder. */
  reporter?: ErrorReporter;
  rateLimits?: Partial<RateLimitPolicy>;
  /** Transactional e-mail; `null` switches password reset off regardless of configuration. */
  emailSender?: EmailSender | null;
  /** Test hooks for asserting on structured logs. */
  logStream?: Writable;
  logLevel?: LogLevel;
};

export async function buildApp(config: AppConfig, dependencies: AppDependencies = {}) {
  const app = Fastify({
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    // Private-network load balancers (or an explicit CIDR list) only; a client-written X-Forwarded-For entry is never trusted.
    trustProxy: config.TRUST_PROXY,
    bodyLimit: requestBodyLimit,
    // Slow clients cannot hold a socket open indefinitely while sending a request.
    requestTimeout: 30_000,
    logger: {
      level: dependencies.logLevel ?? config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
      ...(dependencies.logStream ? { stream: dependencies.logStream } : {}),
    },
  });

  const database = createDatabase(config.DATABASE_URL, { max: config.DATABASE_POOL_MAX, statementTimeoutMs: config.DATABASE_STATEMENT_TIMEOUT_MS });
  const reporter = dependencies.reporter ?? createErrorReporter({
    sentryDsn: config.SENTRY_DSN,
    url: config.ERROR_REPORTING_URL,
    token: config.ERROR_REPORTING_TOKEN,
    environment: config.APP_ENV,
    release: config.RELEASE,
    service: "devcontext-api",
  }, app.log);
  const emailSender: EmailSender | null = dependencies.emailSender !== undefined
    ? dependencies.emailSender
    : config.EMAIL_PROVIDER === "log" ? createLogEmailSender(app.log, config.EMAIL_OUTBOX_FILE) : null;
  const auth = dependencies.auth ?? createAuthProvider(database, config, app.log, emailSender);
  const resourceService = dependencies.resources ?? createResourceService(createResourceRepository(database));
  const projectService = dependencies.projects ?? createProjectService(createProjectRepository(database));
  const decisionService = dependencies.decisions ?? createDecisionService(createDecisionRepository(database));
  const contextRepository = createContextRepository(database);
  const contextService = dependencies.context ?? createContextService(contextRepository);
  const profileService = dependencies.profiles ?? createProfileService(createProfileRepository(database));
  const compatibilityService = dependencies.compatibility ?? createCompatibilityService(createCompatibilityRepository(database));
  const searchService = dependencies.search ?? createSearchService(createSearchRepository(database));
  const recipeService = dependencies.recipes ?? createRecipeService(createRecipeRepository(database));
  const workspaceRepository = dependencies.workspace ?? createWorkspaceRepository(database);
  const sampleService = dependencies.samples ?? createSampleService(createSampleTransaction(database));
  const portabilityService = dependencies.portability ?? createPortabilityService(createPortabilityRepository(database));
  const catalogService = dependencies.catalog ?? createCatalogService(resourceService, profileService, createCatalogTransaction(database));
  const subscriptionRepository = dependencies.subscriptions ?? createSubscriptionRepository(database);
  const entitlementService = dependencies.entitlements ?? createEntitlementService(subscriptionRepository, createUsageRepository(database));
  const billingProvider = dependencies.billingProvider !== undefined
    ? dependencies.billingProvider
    : config.BILLING_PROVIDER === "fake" && config.BILLING_WEBHOOK_SECRET
      ? createFakeProvider({
        secret: config.BILLING_WEBHOOK_SECRET,
        webOrigin: config.CORS_ORIGIN,
        deliver: async (rawBody, headers) => {
          const response = await app.inject({ method: "POST", url: "/v1/billing/webhook", payload: rawBody, headers });
          if (response.statusCode >= 400) throw Object.assign(new Error("Fake provider webhook delivery failed"), { statusCode: 502 });
        },
      })
      : null;
  const billingService = dependencies.billing ?? createBillingService({
    provider: billingProvider,
    subscriptions: subscriptionRepository,
    entitlements: entitlementService,
    urls: {
      success: `${config.CORS_ORIGIN}/workspace/billing?billing=success`,
      cancel: `${config.CORS_ORIGIN}/workspace/billing?billing=canceled`,
      portalReturn: `${config.CORS_ORIGIN}/workspace/billing?billing=portal`,
    },
    proPriceLabel: config.BILLING_PRO_PRICE_LABEL,
  });
  const aiProvider = dependencies.aiProvider !== undefined
    ? dependencies.aiProvider
    : config.AI_PROVIDER === "fake"
      ? createFakeAiProvider()
      : config.AI_PROVIDER === "anthropic" && config.AI_API_KEY
        ? createAnthropicProvider({
          apiKey: config.AI_API_KEY,
          model: config.AI_MODEL,
          effort: config.AI_EFFORT,
          timeoutMs: config.AI_TIMEOUT_MS,
          maxOutputTokens: config.AI_MAX_OUTPUT_TOKENS,
        })
        : null;
  const aiRepository = createAiRepository(database);
  const aiService = dependencies.ai ?? createAiService({
    provider: aiProvider,
    repository: aiRepository,
    decisions: decisionService,
    loadCompileInput: (ownerUserId, projectId) => contextRepository.loadCompileInput(ownerUserId, projectId),
    monthlyQuota: (ownerUserId) => entitlementService.aiMonthlyQuota(ownerUserId),
  });
  const auditRepository = dependencies.audit ?? createAuditRepository(database);
  const accountService = dependencies.account ?? createAccountService({
    repository: createAccountRepository(database),
    auth,
    billing: billingService,
    subscriptions: subscriptionRepository,
    portability: portabilityService,
    workspace: workspaceRepository,
    audit: auditRepository,
    ai: aiService,
    aiProvider: aiProvider?.id ?? null,
    config,
  });
  const telemetry = createTelemetry(auditRepository, app.log);
  const limiter = createRateLimiter();
  const policy: RateLimitPolicy = { ...defaultRateLimitPolicy, ...dependencies.rateLimits };
  const sweep = setInterval(() => limiter.sweep(), 60_000);
  sweep.unref();

  app.decorate("database", database);
  app.decorate("config", config);
  app.decorate("auth", auth);
  app.decorate("telemetry", telemetry);
  app.decorate("entitlements", entitlementService);
  app.decorate("reporter", reporter);
  /** Flipped by the process on SIGTERM so `/ready` fails and the orchestrator stops routing new traffic. */
  app.decorate("readiness", { draining: false });
  database.pool.on("error", () => {
    app.log.error({ category: "database_connection" }, "Idle database connection failed");
  });
  // Pool watchdog: a queue in front of the pool means the instance is saturated or the database is slow.
  const poolWatch = setInterval(() => {
    const stats = database.stats();
    if (stats.waiting > 0 || stats.total >= stats.max) app.log.warn({ category: "database_pool", ...stats }, "database_pool_pressure");
  }, 15_000);
  poolWatch.unref();
  registerErrorHandlers(app);
  // JSON only: the browser can send text/plain cross-site without a preflight, so no route accepts it.
  app.removeContentTypeParser("text/plain");
  registerClientIp(app, config.WEB_PROXY_SECRET);
  registerOriginGuard(app, [config.CORS_ORIGIN, config.BETTER_AUTH_URL]);
  registerObservability(app);

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  app.addHook("onClose", async () => {
    clearInterval(sweep);
    clearInterval(poolWatch);
    await database.close();
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app, auth, { limiter, policy, telemetry, passwordReset: emailSender !== null });
  await registerResourceRoutes(app, resourceService);
  await registerProjectRoutes(app, projectService);
  await registerDecisionRoutes(app, decisionService);
  await registerContextRoutes(app, contextService);
  await registerProfileRoutes(app, profileService);
  await registerCompatibilityRoutes(app, compatibilityService);
  await registerSearchRoutes(app, searchService);
  await registerRecipeRoutes(app, recipeService);
  await registerWorkspaceRoutes(app, workspaceRepository);
  await registerSampleRoutes(app, sampleService);
  await registerPortabilityRoutes(app, portabilityService);
  await registerCatalogRoutes(app, catalogService);
  await registerBillingRoutes(app, billingService);
  await registerAuditRoutes(app, auditRepository);
  await registerAccountRoutes(app, accountService);
  await registerAiRoutes(app, aiService);
  /**
   * Readiness: the process accepts traffic only while it is not draining and
   * the database answers. Connection details never appear in the response.
   */
  app.get("/ready", async (request, reply) => {
    if (app.readiness.draining) {
      return reply.code(503).send({ error: { code: "SERVICE_UNAVAILABLE", message: "Shutting down", requestId: request.id } });
    }
    try {
      await database.pool.query("SELECT 1");
      return { ok: true, service: "devcontext-api", environment: config.APP_ENV, release: config.RELEASE };
    } catch {
      return reply.code(503).send({ error: {
        code: "SERVICE_UNAVAILABLE", message: "Database is unavailable", requestId: request.id,
      } });
    }
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    database: Database;
    telemetry: Telemetry;
    entitlements: EntitlementService;
    reporter: ErrorReporter;
    readiness: { draining: boolean };
  }
}
