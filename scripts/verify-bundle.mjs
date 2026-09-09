import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Client-bundle guard (Handoff 12): after `pnpm build`, no browser chunk may
 * mention a server-only variable or a connection string, and the standalone
 * server output must not carry an environment file.
 *
 *   node scripts/verify-bundle.mjs
 */
const root = fileURLToPath(new URL("../", import.meta.url));
const staticDir = join(root, "apps/web/.next/static");
const standaloneDir = join(root, "apps/web/.next/standalone");

const forbidden = [
  "BETTER_AUTH_SECRET",
  "BILLING_SECRET_KEY",
  "BILLING_WEBHOOK_SECRET",
  "ERROR_REPORTING_TOKEN",
  "SENTRY_DSN",
  "DATABASE_URL",
  "postgresql://",
  "postgres://",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!existsSync(staticDir)) {
  console.error("apps/web/.next/static is missing; run pnpm build first.");
  process.exit(1);
}

const findings = [];
let scanned = 0;
for (const file of walk(staticDir)) {
  if (!/\.(js|mjs|css|txt|json)$/.test(file)) continue;
  scanned += 1;
  const text = readFileSync(file, "utf8");
  for (const token of forbidden) if (text.includes(token)) findings.push({ file: file.slice(root.length), token });
}

if (existsSync(standaloneDir)) {
  for (const file of walk(standaloneDir)) {
    const name = file.split(/[\\/]/).pop() ?? "";
    if (name === ".env" || name.startsWith(".env.")) findings.push({ file: file.slice(root.length), token: "environment file" });
  }
}

if (findings.length > 0) {
  console.error(JSON.stringify({ bundle: "unsafe", scanned, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ bundle: "clean", scanned, standalone: existsSync(standaloneDir) }));
