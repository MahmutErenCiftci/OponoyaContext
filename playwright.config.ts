import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Three servers: the API, the web app in front of it, and a second web
 * instance pointed at a port nothing listens on so the "API unavailable"
 * journey is deterministic without stopping the real API mid-run.
 *
 * Ports default to 4100/3100/3200; `E2E_API_PORT`, `E2E_WEB_PORT` and
 * `E2E_UNAVAILABLE_WEB_PORT` move the suite when another local project
 * already listens there.
 */
const apiPort = process.env.E2E_API_PORT ?? "4100";
const webPort = process.env.E2E_WEB_PORT ?? "3100";
const unavailableWebPort = process.env.E2E_UNAVAILABLE_WEB_PORT ?? "3200";
/** The web proxy asserts the client address to the API with this shared secret, as in production. */
const webProxySecret = "playwright-web-proxy-secret-with-32-characters";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
export const unavailableWebUrl = `http://127.0.0.1:${unavailableWebPort}`;
/** The development e-mail provider appends messages here; the password reset journey reads its link from it. */
export const emailOutboxFile = resolve("test-results/e2e-outbox.jsonl");

export default defineConfig({
  testDir: "./e2e",
  // The suite runs under a dark system preference so the dark adaptation stays covered; the light design (the default) is exercised in e2e/catalog.spec.ts and by .local/ui-shots.mjs.
  use: { baseURL: webUrl, trace: "retain-on-failure", colorScheme: "dark" },
  retries: process.env.CI ? 1 : 0,
  // Journeys such as usability and composer chain many real API round-trips; 30 s leaves no margin on this machine.
  timeout: 60_000,
  webServer: [
    {
      command: `"${process.execPath}" --env-file-if-exists=../../.env dist/server.js`,
      cwd: resolve("apps/api"),
      url: `${apiUrl}/ready`,
      env: {
        NODE_ENV: "test",
        API_PORT: apiPort,
        API_HOST: "127.0.0.1",
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@127.0.0.1:5432/test",
        CORS_ORIGIN: webUrl,
        BETTER_AUTH_URL: apiUrl,
        BETTER_AUTH_SECRET: "playwright-auth-secret-with-32-characters",
        BILLING_PROVIDER: "fake",
        BILLING_WEBHOOK_SECRET: "playwright-billing-webhook-secret-with-32-chars",
        BILLING_PRO_PRICE_LABEL: "9 USD / month (test)",
        WEB_PROXY_SECRET: webProxySecret,
        // Deterministic AI provider: suggestion journeys run without a network call.
        AI_PROVIDER: "fake",
        // Password reset e-mails go to a local file instead of an inbox.
        EMAIL_PROVIDER: "log",
        EMAIL_OUTBOX_FILE: emailOutboxFile,
      },
      reuseExistingServer: false,
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start --port ${webPort}`,
      cwd: resolve("apps/web"),
      url: webUrl,
      env: { API_URL: apiUrl, NODE_ENV: "production", WEB_PROXY_SECRET: webProxySecret },
      reuseExistingServer: false,
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start --port ${unavailableWebPort}`,
      cwd: resolve("apps/web"),
      url: unavailableWebUrl,
      env: { API_URL: "http://127.0.0.1:4199", NODE_ENV: "production" },
      reuseExistingServer: false,
    },
  ],
});
