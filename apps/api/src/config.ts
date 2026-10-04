import { isIP } from "node:net";
import { z } from "zod";
import { aiEffortSchema } from "@devcontext/contracts";
import { databaseUrlSchema } from "@devcontext/db/config";

const localAuthSecret = "devcontext-local-secret-change-before-production";
/** Values copied from the committed examples; a deployment that still carries one is misconfigured. */
const knownPlaceholders = new Set(["replace-with-at-least-32-random-characters"]);

const httpOriginSchema = z.url().refine((value) => {
  const url = URL.parse(value);
  return url !== null && ["http:", "https:"].includes(url.protocol) && value === url.origin;
}, "Expected an HTTP(S) origin without a path");

const booleanFlag = z.enum(["true", "false", "1", "0"]).transform((value) => value === "true" || value === "1");

export const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
export type LogLevel = z.infer<typeof logLevelSchema>;

function defaultLogLevel(nodeEnv: "development" | "test" | "production"): LogLevel {
  if (nodeEnv === "production") return "info";
  if (nodeEnv === "test") return "silent";
  return "debug";
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  DATABASE_URL: databaseUrlSchema,
  CORS_ORIGIN: httpOriginSchema.default("http://localhost:3000"),
  BETTER_AUTH_URL: httpOriginSchema.default("http://localhost:4000"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  /**
   * Which upstream proxies may set `X-Forwarded-For`. `false` (default) uses
   * the socket address. `true` trusts only private-network peers (loopback,
   * link-local, RFC 1918 / unique-local: a platform load balancer), so a
   * client on the internet can never pick its own address. Anything else is
   * an explicit comma-separated list of IPs or CIDR ranges.
   */
  TRUST_PROXY: z.string().trim().default("false").transform((value, context) => {
    const lowered = value.toLowerCase();
    if (["false", "0", ""].includes(lowered)) return false as const;
    if (["true", "1"].includes(lowered)) return "loopback,linklocal,uniquelocal";
    const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
    const valid = entries.length > 0 && entries.every((entry) => {
      if (["loopback", "linklocal", "uniquelocal"].includes(entry)) return true;
      const [address, prefix, extra] = entry.split("/");
      return extra === undefined && isIP(address ?? "") > 0 && (prefix === undefined || /^\d{1,3}$/.test(prefix));
    });
    if (!valid) {
      context.addIssue({ code: "custom", message: "Expected true, false or a comma-separated list of IPs/CIDR ranges" });
      return z.NEVER;
    }
    return entries.join(",");
  }),
  /**
   * Shared with the web app: its same-origin proxy presents this secret with
   * the end-user address it resolved, so anonymous rate limits (sign-in,
   * sign-up) key on the real client instead of the web server. Requests
   * without it fall back to the socket address. Required in production.
   */
  WEB_PROXY_SECRET: z.string().min(32).optional(),
  /** Overrides the per-environment default (production info, development debug, test silent). */
  LOG_LEVEL: logLevelSchema.optional(),
  /**
   * Billing boundary (Handoff 10). `none` keeps the product fully usable on the
   * Free plan with no upgrade path; `fake` enables the in-process test provider
   * (never in production); `stripe` is reserved for the real adapter, which is
   * an external activation step and is refused until it ships.
   */
  BILLING_PROVIDER: z.enum(["none", "fake", "stripe"]).default("none"),
  /** Shared secret that signs provider webhooks; required whenever a provider is enabled. */
  BILLING_WEBHOOK_SECRET: z.string().min(32).optional(),
  /** Server-only provider API key; never logged or exposed to the web app. */
  BILLING_SECRET_KEY: z.string().min(16).optional(),
  BILLING_PRO_PRICE_ID: z.string().min(1).optional(),
  /** Display-only price text for the Pro plan, e.g. "9 USD / month"; null until the operator sets it. */
  BILLING_PRO_PRICE_LABEL: z.string().trim().min(1).max(60).optional(),
  /**
   * Legal surfaces (Handoff 11). Every value is optional and owner-supplied;
   * while one is missing the Terms and Privacy pages render an explicit
   * placeholder and stay marked as drafts. Nothing here is ever invented.
   */
  LEGAL_ENTITY_NAME: z.string().trim().min(1).max(200).optional(),
  LEGAL_ENTITY_ADDRESS: z.string().trim().min(1).max(500).optional(),
  LEGAL_CONTACT_EMAIL: z.email().optional(),
  LEGAL_JURISDICTION: z.string().trim().min(1).max(200).optional(),
  LEGAL_EFFECTIVE_DATE: z.iso.date().optional(),
  /** Date the owner/legal reviewer approved the texts; unset keeps the draft banner even when every value is present. */
  LEGAL_APPROVED_AT: z.iso.date().optional(),
  /** Comma-separated processor names disclosed on the Privacy page. */
  LEGAL_SUBPROCESSORS: z.string().trim().max(2000).optional(),
  HOSTING_REGION: z.string().trim().min(1).max(200).optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).optional(),
  BILLING_RECORDS_RETENTION_YEARS: z.coerce.number().int().min(1).max(30).optional(),
  /**
   * Deployment identity (Handoff 12). `APP_ENV` tags logs and error reports
   * and separates preview/staging from production; it defaults to NODE_ENV.
   * `RELEASE` is the deployed build (git SHA or tag). Neither is a secret.
   */
  APP_ENV: z.enum(["development", "test", "preview", "staging", "production"]).optional(),
  RELEASE: z.string().trim().min(1).max(100).optional(),
  /**
   * Error reporting boundary: a Sentry DSN (store endpoint spoken directly, no
   * SDK) or a generic JSON webhook with an optional bearer token. Reports carry
   * class, code, constraint, fingerprint, frames and identifiers only.
   */
  SENTRY_DSN: z.url().optional(),
  ERROR_REPORTING_URL: z.url().optional(),
  ERROR_REPORTING_TOKEN: z.string().min(8).optional(),
  /** Bounded connection pool per API instance; keep instances × max below the database's connection limit. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
  /** How long in-flight requests may drain after SIGTERM before the process exits with an error. */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(10_000),
  /**
   * Lets a production build run behind plain HTTP for preview/staging stacks
   * that have no TLS terminator (Compose on a laptop, CI smoke). Refused when
   * `APP_ENV=production`.
   */
  INSECURE_HTTP_ORIGINS: booleanFlag.default(false),
  /**
   * AI assistance (V1.5 groundwork). `none` (default) keeps every AI route
   * answering `ai_unavailable` and nothing ever leaves the API; `fake` is the
   * deterministic development/test provider (never in production);
   * `anthropic` calls Claude with `AI_API_KEY`. Activation is an owner
   * decision that also needs the Privacy text and subprocessor list updated.
   */
  AI_PROVIDER: z.enum(["none", "fake", "anthropic"]).default("none"),
  /** Server-only provider key; never logged, never sent to the web app. */
  AI_API_KEY: z.string().trim().min(20).optional(),
  AI_MODEL: z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{2,99}$/, "Expected a model identifier").default("claude-opus-5"),
  /** Optional output effort; unset keeps the model default. */
  AI_EFFORT: aiEffortSchema.optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(600_000).default(120_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1_024).max(64_000).default(16_000),
  /**
   * Transactional e-mail (password reset). `none` (default) keeps password
   * reset off and its routes unreachable; `log` writes messages to the log
   * and, with `EMAIL_OUTBOX_FILE`, to a local JSON-lines file (development
   * and tests only, refused in production). A real provider is an owner
   * decision.
   */
  EMAIL_PROVIDER: z.enum(["none", "log"]).default("none"),
  EMAIL_OUTBOX_FILE: z.string().trim().min(1).optional(),
  /**
   * Who may open the cross-account operator overview (`/admin`): a
   * comma-separated list of user ids. Ids rather than e-mail addresses
   * because sign-up does not verify addresses, so an e-mail allow-list would
   * belong to whoever registers that address first. Empty (default) keeps the
   * overview closed to everyone.
   */
  ADMIN_USER_IDS: z.string().trim().default("").transform((value, context) => {
    const ids = value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    if (!ids.every((id) => z.uuid().safeParse(id).success)) {
      context.addIssue({ code: "custom", message: "Expected a comma-separated list of user ids" });
      return z.NEVER;
    }
    return [...new Set(ids)];
  }),
}).superRefine((value, context) => {
  if (value.BILLING_PROVIDER === "stripe") {
    context.addIssue({ code: "custom", path: ["BILLING_PROVIDER"], message: "The Stripe adapter is not part of this build; see docs/40_BILLING_HANDOFF.md" });
  }
  if (value.BILLING_PROVIDER !== "none" && !value.BILLING_WEBHOOK_SECRET) {
    context.addIssue({ code: "custom", path: ["BILLING_WEBHOOK_SECRET"], message: "A webhook secret is required when a billing provider is enabled" });
  }
  const appEnv = value.APP_ENV ?? value.NODE_ENV;
  if (value.INSECURE_HTTP_ORIGINS && appEnv === "production") {
    context.addIssue({ code: "custom", path: ["INSECURE_HTTP_ORIGINS"], message: "Plain HTTP origins are never allowed when APP_ENV is production" });
  }
  if (value.AI_PROVIDER === "anthropic" && !value.AI_API_KEY) {
    context.addIssue({ code: "custom", path: ["AI_API_KEY"], message: "An API key is required when the Anthropic AI provider is enabled" });
  }
  if (value.AI_PROVIDER === "fake" && appEnv === "production") {
    context.addIssue({ code: "custom", path: ["AI_PROVIDER"], message: "The fake AI provider cannot run in production" });
  }
  if (value.EMAIL_PROVIDER === "log" && appEnv === "production") {
    context.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "The log e-mail provider writes reset links to logs and cannot run in production" });
  }
  if (appEnv === "production" && !value.WEB_PROXY_SECRET) {
    context.addIssue({ code: "custom", path: ["WEB_PROXY_SECRET"], message: "Production needs the web proxy secret so sign-in limits apply per client" });
  }
  // Anything reachable beyond a laptop or CI signs sessions with its own secret, never the committed development default.
  if (!["development", "test"].includes(appEnv) && (!value.BETTER_AUTH_SECRET || value.BETTER_AUTH_SECRET === localAuthSecret)) {
    context.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "Preview, staging and production need their own authentication secret" });
  }
  if (!["development", "test"].includes(appEnv)) {
    for (const key of ["BETTER_AUTH_SECRET", "WEB_PROXY_SECRET", "BILLING_WEBHOOK_SECRET"] as const) {
      const secret = value[key];
      if (secret && knownPlaceholders.has(secret)) context.addIssue({ code: "custom", path: [key], message: "The secret is still the documented placeholder" });
    }
  }
  if (appEnv === "production") {
    for (const key of ["SENTRY_DSN", "ERROR_REPORTING_URL"] as const) {
      const url = value[key];
      if (url && !url.startsWith("https://")) context.addIssue({ code: "custom", path: [key], message: "Error reporting must use HTTPS in production" });
    }
    // A managed database is reached over TLS; only a loopback database may skip it.
    const database = URL.parse(value.DATABASE_URL);
    const loopback = database !== null && ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname);
    const sslMode = database?.searchParams.get("sslmode") ?? "";
    if (!loopback && !["require", "verify-ca", "verify-full"].includes(sslMode)) {
      context.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "Production database connections must set sslmode=require or stricter" });
    }
  }
  // Production rules apply to a production build and to anything labelled production, whichever variable says so.
  if (value.NODE_ENV !== "production" && appEnv !== "production") return;
  if (value.BILLING_PROVIDER === "fake" && appEnv === "production") {
    context.addIssue({ code: "custom", path: ["BILLING_PROVIDER"], message: "The fake billing provider cannot run in production" });
  }
  if (!value.BETTER_AUTH_SECRET) {
    context.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "A production authentication secret is required" });
  }
  if (value.BETTER_AUTH_SECRET === localAuthSecret) {
    context.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "The local development secret cannot be used by a production build" });
  }
  // Session cookies are only marked Secure for HTTPS base URLs; production must not ship them in clear text.
  if (!value.INSECURE_HTTP_ORIGINS) {
    for (const key of ["BETTER_AUTH_URL", "CORS_ORIGIN"] as const) {
      if (!value[key].startsWith("https://")) {
        context.addIssue({ code: "custom", path: [key], message: "Production origins must use HTTPS (set INSECURE_HTTP_ORIGINS=true only for preview/staging without TLS)" });
      }
    }
  }
}).transform((value) => ({
  ...value,
  BETTER_AUTH_SECRET: value.BETTER_AUTH_SECRET ?? localAuthSecret,
  LOG_LEVEL: value.LOG_LEVEL ?? defaultLogLevel(value.NODE_ENV),
  BILLING_PRO_PRICE_LABEL: value.BILLING_PRO_PRICE_LABEL ?? null,
  APP_ENV: value.APP_ENV ?? value.NODE_ENV,
  RELEASE: value.RELEASE ?? null,
  AI_EFFORT: value.AI_EFFORT ?? null,
}));

export type AppConfig = z.output<typeof envSchema>;

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
  }
  return result.data;
}
