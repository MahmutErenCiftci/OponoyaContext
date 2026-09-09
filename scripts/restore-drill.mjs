import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

/**
 * Backup → restore drill against a scratch database (Handoff 12).
 *
 *   node scripts/restore-drill.mjs --target postgresql://…/scratch [--source postgresql://…] [--out backups/drill.json]
 *
 * 1. snapshots the source (DATABASE_URL by default) with the repository's
 *    logical backup format,
 * 2. migrates the target to the committed schema and restores the snapshot,
 * 3. verifies every table checksum on the target,
 * 4. runs business reads (row counts of users, resources, projects, context
 *    versions, subscriptions) on both sides and compares them.
 * The target is wiped; it must never be the source or a production database.
 * Connection strings are never printed; the evidence file holds counts only.
 */
const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = `${root}.env`;
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { values } = parseArgs({
  options: {
    source: { type: "string" },
    target: { type: "string" },
    out: { type: "string", default: "backups/restore-drill.json" },
  },
});

const distIndex = `${root}packages/db/dist/index.js`;
if (!existsSync(distIndex)) {
  console.error("Build the database package first: pnpm --filter @devcontext/db build");
  process.exit(1);
}
// Windows needs file:// URLs for dynamic imports of absolute paths.
const { createDatabase } = await import(pathToFileURL(distIndex).href);
const { runMigrations } = await import(pathToFileURL(`${root}packages/db/dist/migrate.js`).href);
const { createSnapshot, verifySnapshot, restoreSnapshot, summarizeSnapshot } = await import(pathToFileURL(`${root}packages/db/dist/backup.js`).href);

const sourceUrl = values.source ?? process.env.DATABASE_URL;
const targetUrl = values.target;
if (!sourceUrl || !targetUrl) {
  console.error("Usage: restore-drill --target postgresql://…/scratch [--source postgresql://…] [--out file]");
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error("Refusing to restore onto the source database.");
  process.exit(1);
}

const businessReads = {
  users: "SELECT count(*)::int AS value FROM users",
  resources: "SELECT count(*)::int AS value FROM resources",
  projects: "SELECT count(*)::int AS value FROM projects",
  contextVersions: "SELECT count(*)::int AS value FROM context_versions",
  subscriptions: "SELECT count(*)::int AS value FROM subscriptions",
  accountDeletions: "SELECT count(*)::int AS value FROM account_deletions",
};

async function withClient(url, work) {
  // One pinned client for the snapshot transaction plus spare connections for the migrator.
  const database = createDatabase(url, { max: 3 });
  const client = await database.pool.connect();
  try {
    return await work((text, params) => client.query(text, params), database);
  } finally {
    client.release();
    await database.close();
  }
}

async function readCounts(exec) {
  const counts = {};
  for (const [key, query] of Object.entries(businessReads)) counts[key] = (await exec(query)).rows[0].value;
  return counts;
}

const started = Date.now();
const snapshot = await withClient(sourceUrl, (exec) => createSnapshot(exec));
const sourceCounts = await withClient(sourceUrl, (exec) => readCounts(exec));
const summary = summarizeSnapshot(snapshot);

const outcome = await withClient(targetUrl, async (exec, database) => {
  await runMigrations(database);
  const restored = await restoreSnapshot(exec, snapshot);
  const verification = await verifySnapshot(exec, snapshot);
  const targetCounts = await readCounts(exec);
  return { restored, verification, targetCounts };
});

const mismatches = Object.keys(businessReads).filter((key) => sourceCounts[key] !== outcome.targetCounts[key]);
const ok = outcome.verification.ok && mismatches.length === 0;
const evidence = {
  drill: ok ? "passed" : "failed",
  at: new Date().toISOString(),
  durationMs: Date.now() - started,
  snapshot: { format: snapshot.format, migrations: snapshot.migrations.length, tables: Object.keys(snapshot.tables).length, summary },
  checksums: { ok: outcome.verification.ok, mismatches: outcome.verification.mismatches },
  businessReads: { source: sourceCounts, target: outcome.targetCounts, mismatches },
};
mkdirSync(dirname(`${root}${values.out}`), { recursive: true });
writeFileSync(`${root}${values.out}`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
if (!ok) process.exitCode = 1;
