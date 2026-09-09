import { copyFileSync, constants, existsSync } from "node:fs";
import { join } from "node:path";
import { pnpm, root, run } from "./run.mjs";

try {
  const envFile = join(root, ".env");
  if (!existsSync(envFile)) {
    copyFileSync(join(root, ".env.example"), envFile, constants.COPYFILE_EXCL);
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
