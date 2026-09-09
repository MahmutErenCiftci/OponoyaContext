import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { summarizeError } from "./lib/redact.js";

/**
 * Process lifecycle for containers and orchestrators (Handoff 12):
 * - configuration is validated before anything listens (secret values are
 *   never part of the error),
 * - SIGTERM/SIGINT flip readiness to draining, stop accepting connections,
 *   let in-flight requests finish and close the pool; a hard exit follows
 *   after SHUTDOWN_TIMEOUT_MS,
 * - unhandled rejections are summarised (content-free) and reported.
 */
async function main() {
  const config = readConfig();
  const app = await buildApp(config);
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    app.readiness.draining = true;
    app.log.info({ category: "lifecycle", event: "shutdown_started", signal }, "shutdown_started");
    const timeout = setTimeout(() => {
      app.log.error({ category: "lifecycle", event: "shutdown_timeout", timeoutMs: config.SHUTDOWN_TIMEOUT_MS }, "shutdown_timeout");
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS).unref();
    try {
      await app.close();
      app.log.info({ category: "lifecycle", event: "shutdown_complete" }, "shutdown_complete");
    } finally {
      clearTimeout(timeout);
    }
  };
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("unhandledRejection", (reason) => {
    const summary = summarizeError(reason);
    const { message: _message, ...safe } = summary;
    void _message;
    app.log.error({ category: "unhandled_rejection", error: safe }, "unhandled_rejection");
    void app.reporter.report(summary, { category: "unhandled_rejection" });
  });
  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST });
    app.log.info({
      category: "lifecycle", event: "startup", environment: config.APP_ENV, release: config.RELEASE,
      node: process.version, errorReporting: app.reporter.target, billingProvider: config.BILLING_PROVIDER,
    }, "startup");
  } catch {
    await app.close();
    throw new Error("API startup failed");
  }
}

main().catch((error: unknown) => {
  // Configuration errors list field names only; connection strings and secrets never reach stderr.
  const detail = error instanceof Error && error.message.startsWith("Invalid environment variables") ? ` ${error.message}` : "";
  console.error(`API startup failed. Check environment configuration, database URL and port availability.${detail}`);
  process.exitCode = 1;
});
