import { existsSync } from "node:fs";
import { join } from "node:path";
import { createScratchDatabase } from "../packages/db/dist/testing.js";
import { root, run } from "./run.mjs";

let scratch;
try {
  if (!process.env.DATABASE_URL) throw new Error("Database configuration missing");
  const target = new URL(process.env.DATABASE_URL);
  const control = join(root, ".local/postgres/pgsql/bin/pg_ctl.exe");
  const data = join(root, ".local/pgdata");
  // Only start this workspace's known portable server; never provision a
  // replacement for an unavailable remote or user-configured database.
  if (process.platform === "win32" && ["127.0.0.1", "localhost"].includes(target.hostname)
    && target.port === "55432" && existsSync(control) && existsSync(join(data, "PG_VERSION"))) {
    try { await run(control, ["-D", data, "status"]); }
    catch { await run(control, ["-D", data, "-l", join(root, ".local/postgres.log"), "-w", "start"]); }
  }
  scratch = await createScratchDatabase(process.env.DATABASE_URL);
  process.env.DATABASE_URL = scratch.url;
  // Execute the installed test runner directly; verification does not need a package-manager process.
  await run(process.execPath, [join(root, "node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)]);
} catch {
  console.error("E2E verification failed. Check the test output, PostgreSQL connectivity and CREATEDB permission. Run pnpm build before retrying.");
  process.exitCode = 1;
} finally {
  if (scratch) {
    try { await scratch.drop(); }
    catch {
      console.error("E2E scratch database cleanup failed; check PostgreSQL connectivity.");
      process.exitCode = 1;
    }
  }
}
