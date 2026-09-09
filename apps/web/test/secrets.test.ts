import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("../", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return entry === "node_modules" || entry === ".next" ? [] : sourceFiles(path);
    return /\.(tsx?|mjs|json)$/.test(entry) ? [path] : [];
  });
}

/** Billing secrets are server-only on the API; the web app must never reference them, so they cannot reach a client bundle. */
describe("web app secrets", () => {
  it("never references provider secrets or the webhook secret", () => {
    const offenders = ["app", "components", "lib", "next.config.ts"]
      .flatMap((entry) => (statSync(join(webRoot, entry)).isDirectory() ? sourceFiles(join(webRoot, entry)) : [join(webRoot, entry)]))
      .filter((file) => /BILLING_WEBHOOK_SECRET|BILLING_SECRET_KEY|BETTER_AUTH_SECRET/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
