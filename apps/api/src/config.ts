import { z } from "zod";
import { databaseUrlSchema } from "@devcontext/db/config";

const localAuthSecret = "devcontext-local-secret-change-before-production";

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
   * Trust `X-Forwarded-For` from the immediate upstream (platform load balancer
   * or the web proxy). Leave off when clients can reach the API directly,
   * otherwise a client could choose its own rate-limit bucket.
   */
  TRUST_PROXY: booleanFlag.default(false),
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
  if (value.NODE_ENV !== "production") return;
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
