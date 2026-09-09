import { randomUUID } from "node:crypto";
import type { ErrorSummary } from "./redact.js";

/**
 * Provider-neutral error reporting boundary (Handoff 12).
 *
 * Only the content-free `ErrorSummary` (class, driver code, constraint,
 * fingerprint, stack frames) plus release/environment/request identifiers are
 * sent: never the message, a body, a header or user content. Two transports:
 *
 * - `SENTRY_DSN`: Sentry's store endpoint, spoken directly (no SDK, so nothing
 *   instruments the process or captures request data by accident);
 * - `ERROR_REPORTING_URL` (+ optional bearer token): a generic JSON webhook.
 *
 * Reports are rate limited and deduplicated per fingerprint; a failing
 * transport is logged at most once a minute and never affects a request.
 */

export type ReporterOptions = {
  sentryDsn?: string | undefined;
  url?: string | undefined;
  token?: string | undefined;
  environment: string;
  release: string | null;
  service: string;
  /** Maximum reports per minute (default 60). */
  perMinute?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
};

export type ReportContext = {
  category: string;
  requestId?: string | null | undefined;
  route?: string | null | undefined;
  statusCode?: number | null | undefined;
};

export type ReporterLogger = { warn(payload: Record<string, unknown>, message: string): void };

export interface ErrorReporter {
  readonly enabled: boolean;
  readonly target: "none" | "sentry" | "webhook";
  /** Never throws and never blocks the caller for longer than the transport timeout. */
  report(summary: ErrorSummary, context: ReportContext): Promise<void>;
}

type SentryTarget = { endpoint: string; key: string };

/** Parses `https://<key>@<host>/<project>` into the legacy store endpoint; null when the DSN is malformed. */
export function parseSentryDsn(dsn: string): SentryTarget | null {
  const url = URL.parse(dsn);
  if (!url || !url.username || !url.pathname || url.pathname === "/") return null;
  const project = url.pathname.replace(/\/+$/, "").split("/").pop();
  if (!project) return null;
  return { endpoint: `${url.protocol}//${url.host}/api/${project}/store/`, key: url.username };
}

export function buildReport(summary: ErrorSummary, context: ReportContext, options: Pick<ReporterOptions, "environment" | "release" | "service">, at: Date) {
  return {
    service: options.service,
    environment: options.environment,
    release: options.release,
    timestamp: at.toISOString(),
    category: context.category,
    fingerprint: summary.fingerprint,
    name: summary.name,
    code: summary.code,
    constraint: summary.constraint,
    frames: summary.frames,
    requestId: context.requestId ?? null,
    route: context.route ?? null,
    statusCode: context.statusCode ?? null,
  };
}

function sentryEvent(report: ReturnType<typeof buildReport>) {
  return {
    event_id: randomUUID().replaceAll("-", ""),
    timestamp: report.timestamp,
    platform: "node",
    level: "error",
    logger: report.category,
    environment: report.environment,
    ...(report.release ? { release: report.release } : {}),
    fingerprint: [report.fingerprint],
    tags: { service: report.service, route: report.route ?? "unmatched", statusCode: String(report.statusCode ?? ""), requestId: report.requestId ?? "" },
    exception: {
      values: [{
        type: report.name,
        value: report.code ?? report.name,
        stacktrace: { frames: report.frames.map((frame) => ({ function: frame })) },
      }],
    },
  };
}

export function createErrorReporter(options: ReporterOptions, logger: ReporterLogger): ErrorReporter {
  const now = options.now ?? (() => Date.now());
  const fetchImpl = options.fetchImpl ?? fetch;
  const perMinute = options.perMinute ?? 60;
  const sentry = options.sentryDsn ? parseSentryDsn(options.sentryDsn) : null;
  const webhook = !sentry && options.url ? { endpoint: options.url, token: options.token ?? null } : null;
  const target: ErrorReporter["target"] = sentry ? "sentry" : webhook ? "webhook" : "none";
  if (options.sentryDsn && !sentry) logger.warn({ category: "monitoring" }, "SENTRY_DSN is malformed; error reporting disabled");

  let windowStart = now();
  let sent = 0;
  const recent = new Map<string, number>();
  let lastTransportWarning = 0;

  function allowed(fingerprint: string) {
    const at = now();
    if (at - windowStart >= 60_000) { windowStart = at; sent = 0; }
    if (sent >= perMinute) return false;
    const last = recent.get(fingerprint);
    if (last !== undefined && at - last < 10_000) return false;
    recent.set(fingerprint, at);
    if (recent.size > 500) for (const [key, seen] of recent) if (at - seen > 60_000) recent.delete(key);
    sent += 1;
    return true;
  }

  return {
    enabled: target !== "none",
    target,
    async report(summary, context) {
      if (target === "none" || !allowed(summary.fingerprint)) return;
      const report = buildReport(summary, context, options, new Date(now()));
      try {
        const headers: Record<string, string> = { "content-type": "application/json" };
        let endpoint: string;
        let body: unknown;
        if (sentry) {
          endpoint = sentry.endpoint;
          headers["x-sentry-auth"] = `Sentry sentry_version=7, sentry_client=devcontext-api/1.0, sentry_key=${sentry.key}`;
          body = sentryEvent(report);
        } else {
          endpoint = webhook!.endpoint;
          if (webhook!.token) headers.authorization = `Bearer ${webhook!.token}`;
          body = report;
        }
        const response = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(3_000) });
        if (!response.ok) throw new Error(`status ${response.status}`);
      } catch (error) {
        const at = now();
        if (at - lastTransportWarning >= 60_000) {
          lastTransportWarning = at;
          logger.warn({ category: "monitoring", target, reason: error instanceof Error ? error.message.slice(0, 80) : "unknown" }, "error report delivery failed");
        }
      }
    },
  };
}
