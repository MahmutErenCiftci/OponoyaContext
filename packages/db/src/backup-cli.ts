import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createSnapshot, parseSnapshot, restoreSnapshot, summarizeSnapshot, verifySnapshot, type SqlExecutor } from "./backup.js";
import { databaseUrlSchema, readDatabaseUrl } from "./config.js";
import { createDatabase } from "./index.js";

/**
 * Development/test backup drill:
 *
 *   node dist/backup-cli.js backup  [--out backups/name.json] [--url postgresql://…]
 *   node dist/backup-cli.js verify  --file backups/name.json  [--url …]
 *   node dist/backup-cli.js restore --file backups/name.json --yes [--url …]
 *
 * `--url` defaults to DATABASE_URL. Connection strings are never printed.
 * Restore replaces every table on the target inside one transaction and only
 * commits when the checksums match the snapshot.
 */

function usage(): never {
  console.error("Usage: backup [--out file] | verify --file file | restore --file file --yes  (optional --url)");
  process.exitCode = 1;
  throw new Error("usage");
}

function targetUrl(value: string | undefined) {
  if (value === undefined) return readDatabaseUrl();
  const parsed = databaseUrlSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid --url: expected a PostgreSQL connection URL with a database name");
  return parsed.data;
}

function defaultBackupPath(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  return resolve("backups", `devcontext-${stamp}.json`);
}

function printSummary(rows: Array<{ table: string; rows: number; hash: string }>) {
  const width = Math.max(...rows.map((row) => row.table.length));
  for (const row of rows) console.log(`${row.table.padEnd(width)}  ${String(row.rows).padStart(6)} rows  ${row.hash}`);
  console.log(`${"total".padEnd(width)}  ${String(rows.reduce((sum, row) => sum + row.rows, 0)).padStart(6)} rows`);
}

async function withConnection<T>(url: string, work: (exec: SqlExecutor) => Promise<T>): Promise<T> {
  const database = createDatabase(url);
  const client = await database.pool.connect();
  try {
    return await work((text, params) => client.query(text, params));
  } finally {
    client.release();
    await database.close();
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string" },
      file: { type: "string" },
      url: { type: "string" },
      yes: { type: "boolean", default: false },
    },
  });
  const command = positionals[0];
  const url = targetUrl(values.url);

  if (command === "backup") {
    const path = values.out ? resolve(values.out) : defaultBackupPath();
    const snapshot = await withConnection(url, (exec) => createSnapshot(exec));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(snapshot), "utf8");
    console.log(`Snapshot written to ${path} (${snapshot.migrations.length} migrations applied)`);
    printSummary(summarizeSnapshot(snapshot));
    return;
  }

  if (command === "verify" || command === "restore") {
    if (!values.file) usage();
    const snapshot = parseSnapshot(JSON.parse(await readFile(resolve(values.file), "utf8")));
    if (command === "verify") {
      const result = await withConnection(url, (exec) => verifySnapshot(exec, snapshot));
      if (result.ok) {
        console.log("Target matches the snapshot.");
        printSummary(summarizeSnapshot(snapshot));
        return;
      }
      for (const mismatch of result.mismatches) {
        console.error(`${mismatch.table}: expected ${mismatch.expected.rows} rows/${mismatch.expected.hash.slice(0, 12)}, found ${mismatch.actual.rows} rows/${mismatch.actual.hash.slice(0, 12)}`);
      }
      process.exitCode = 1;
      return;
    }
    if (!values.yes) {
      console.error("Restore replaces every table on the target database. Re-run with --yes to confirm.");
      process.exitCode = 1;
      return;
    }
    const result = await withConnection(url, (exec) => restoreSnapshot(exec, snapshot));
    console.log("Restore committed; checksums verified.");
    printSummary(Object.entries(result.checksums).map(([table, checksum]) => ({ table, rows: checksum.rows, hash: checksum.hash.slice(0, 12) })));
    return;
  }

  usage();
}

main().catch((error: unknown) => {
  if (!(error instanceof Error && error.message === "usage")) {
    console.error(error instanceof Error ? error.message : "Backup command failed");
  }
  process.exitCode = 1;
});
