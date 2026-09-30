import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pnpm, root, run } from "./run.mjs";

const placeholder = "replace-with-at-least-32-random-characters";

try {
  const envFile = join(root, ".env");
  if (!existsSync(envFile)) {
    // Every documented placeholder secret gets its own random value, so a fresh checkout never runs on a shared secret.
    const template = readFileSync(join(root, ".env.example"), "utf8");
    const filled = template.split(placeholder).reduce((text, part) => `${text}${randomBytes(36).toString("base64url")}${part}`);
    writeFileSync(envFile, filled, { flag: "wx", mode: 0o600 });
    process.loadEnvFile(envFile);
  }
  const pgControl = join(root, ".local/postgres/pgsql/bin/pg_ctl.exe");
  const pgData = join(root, ".local/pgdata");
  if (process.platform === "win32" && existsSync(pgControl) && existsSync(join(pgData, "PG_VERSION"))) {
    try {
      await run(pgControl, ["-D", pgData, "status"]);
    } catch {
      await run(pgControl, ["-D", pgData, "-l", join(root, ".local/postgres.log"), "-w", "start"]);
    }
  } else {
    await run("docker", ["compose", "up", "-d", "--wait", "postgres"]);
  }
  await pnpm(["db:migrate"]);
  await pnpm(["exec", "turbo", "dev"]);
} catch {
  console.error("Development startup failed. Check Docker Compose and .env, or use pnpm dev:apps with an existing PostgreSQL server.");
  process.exitCode = 1;
}
