import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Three servers: the API, the web app in front of it, and a second web
 * instance pointed at a port nothing listens on so the "API unavailable"
 * journey is deterministic without stopping the real API mid-run.
 */
export const unavailableWebUrl = "http://127.0.0.1:3200";

export default defineConfig({
  testDir: "./e2e",
  // The suite runs under a dark system preference so the dark adaptation stays covered; the light design (the default) is exercised in e2e/catalog.spec.ts and by .local/ui-shots.mjs.
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", colorScheme: "dark" },
  retries: process.env.CI ? 1 : 0,
  // Journeys such as usability and composer chain many real API round-trips; 30 s leaves no margin on this machine.
  timeout: 60_000,
  webServer: [
    {
      command: `"${process.execPath}" --env-file-if-exists=../../.env dist/server.js`,
      cwd: resolve("apps/api"),
      url: "http://127.0.0.1:4100/ready",
      env: {
        NODE_ENV: "test",
        API_PORT: "4100",
        API_HOST: "127.0.0.1",
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@127.0.0.1:5432/test",
        CORS_ORIGIN: "http://127.0.0.1:3100",
        BETTER_AUTH_URL: "http://127.0.0.1:4100",
        BETTER_AUTH_SECRET: "playwright-auth-secret-with-32-characters",
        BILLING_PROVIDER: "fake",
        BILLING_WEBHOOK_SECRET: "playwright-billing-webhook-secret-with-32-chars",
        BILLING_PRO_PRICE_LABEL: "9 USD / month (test)",
      },
      reuseExistingServer: false,
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start --port 3100`,
      cwd: resolve("apps/web"),
      url: "http://127.0.0.1:3100",
      env: { API_URL: "http://127.0.0.1:4100", NODE_ENV: "production" },
      reuseExistingServer: false,
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start --port 3200`,
      cwd: resolve("apps/web"),
      url: unavailableWebUrl,
      env: { API_URL: "http://127.0.0.1:4199", NODE_ENV: "production" },
      reuseExistingServer: false,
    },
  ],
});
