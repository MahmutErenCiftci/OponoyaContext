import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { databaseUrlSchema, readDatabaseUrl } from "./config.js";

/**
 * Retention job for the account deletion ledger (Handoff 11/12).
 *
 *   node dist/retention-cli.js --years N [--dry-run] [--url postgresql://…]
 *
 * Deletes `account_deletions` rows that completed more than N years ago: the
 * minimal billing record has then outlived BILLING_RECORDS_RETENTION_YEARS.
 * Rows that are not completed are never touched. Prints counts only; the
 * connection string is never printed.
 */
export async function purgeCompletedDeletions(pool: Pool, years: number, dryRun: boolean) {
  const [expired] = (await pool.query<{ value: string }>(
    "SELECT count(*)::text AS value FROM account_deletions WHERE status = 'completed' AND completed_at < now() - make_interval(years => $1)",
    [years],
  )).rows;
  const candidates = Number(expired?.value ?? 0);
  if (dryRun || candidates === 0) return { candidates, deleted: 0 };
  const result = await pool.query(
    "DELETE FROM account_deletions WHERE status = 'completed' AND completed_at < now() - make_interval(years => $1)",
    [years],
  );
  return { candidates, deleted: result.rowCount ?? 0 };
}

async function main() {
  const { values } = parseArgs({ options: { years: { type: "string" }, url: { type: "string" }, "dry-run": { type: "boolean", default: false } } });
  const years = Number(values.years);
  if (!Number.isInteger(years) || years < 1 || years > 30) throw new Error("usage");
  const url = values.url ? databaseUrlSchema.parse(values.url) : readDatabaseUrl();
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const outcome = await purgeCompletedDeletions(pool, years, values["dry-run"]);
    console.log(JSON.stringify({ job: "account_deletions_retention", years, dryRun: values["dry-run"], ...outcome }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    if (error instanceof Error && error.message === "usage") console.error("Usage: retention --years N [--dry-run] [--url postgresql://…]");
    else console.error("Retention job failed. Check DATABASE_URL and connectivity.");
    process.exitCode = 1;
  });
}
