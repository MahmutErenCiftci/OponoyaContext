/**
 * Logical backup and restore for the DevContext database.
 *
 * The functions talk to PostgreSQL through a minimal executor so the same code
 * runs against node-postgres (development/CI drills, the CLI) and PGlite (unit
 * tests). Every column is read as text, which round-trips timestamps, enums,
 * booleans and JSONB exactly. Row content is verified with per-table checksums
 * computed by PostgreSQL itself, so a restore either reproduces the snapshot
 * bit for bit or is rolled back.
 *
 * Production managed backups (provider snapshots, retention, encryption) are a
 * separate concern documented for Handoff 12; this module is the automated
 * development/test drill and a portable escape hatch.
 */

export type QueryResultLike = { rows: Record<string, unknown>[] };

/**
 * Runs one SQL statement. For `createSnapshot` and `restoreSnapshot` the
 * executor must be bound to a single connection because both use transactions.
 */
export type SqlExecutor = (text: string, params?: unknown[]) => Promise<QueryResultLike>;

export const snapshotFormat = 1;

/** Insert order: every table appears after the tables it references. */
export const backupTableOrder = [
  "users",
  "workspace_settings",
  "subscriptions",
  "billing_events",
  "account_deletions",
  "import_requests",
  "sessions",
  "accounts",
  "verifications",
  "resources",
  "tags",
  "resource_tags",
  "profiles",
  "recipes",
  "projects",
  "project_resources",
  "project_profiles",
  "recipe_profiles",
  "global_decisions",
  "profile_decisions",
  "recipe_decisions",
  "project_decisions",
  "compatibility_rules",
  "context_versions",
  "export_events",
  "audit_events",
  "workspace_samples",
] as const;

export type ColumnDefinition = { name: string; type: string };
export type TableChecksum = { rows: number; hash: string };
export type TableSnapshot = { columns: ColumnDefinition[]; rows: Array<Array<string | null>> };

export type Snapshot = {
  format: typeof snapshotFormat;
  createdAt: string;
  /** Applied Drizzle migration hashes in order; a restore target must match exactly. */
  migrations: string[];
  tables: Record<string, TableSnapshot>;
  checksums: Record<string, TableChecksum>;
};

export type ChecksumMismatch = { table: string; expected: TableChecksum; actual: TableChecksum };

const identifierPattern = /^[a-z_][a-z0-9_]*$/;

function quote(name: string) {
  if (!identifierPattern.test(name)) throw new Error("Unsafe SQL identifier in snapshot");
  return `"${name}"`;
}

/** Text output of timestamps depends on session settings; pin them so checksums are comparable across databases. */
async function prepareSession(exec: SqlExecutor) {
  await exec("SET TIME ZONE 'UTC'");
  await exec("SET DateStyle TO 'ISO, YMD'");
}

export async function listTables(exec: SqlExecutor): Promise<string[]> {
  const result = await exec(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  return result.rows.map((row) => String(row.table_name));
}

async function listColumns(exec: SqlExecutor, table: string): Promise<ColumnDefinition[]> {
  const result = await exec(
    "SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
    [table],
  );
  return result.rows.map((row) => ({ name: String(row.column_name), type: String(row.udt_name) }));
}

/** Order-independent content hash: md5 of the sorted per-row md5 values. */
export async function checksumTable(exec: SqlExecutor, table: string): Promise<TableChecksum> {
  const result = await exec(
    `SELECT count(*)::int AS row_count, coalesce(md5(string_agg(md5(t::text), '' ORDER BY md5(t::text))), '') AS hash FROM ${quote(table)} t`,
  );
  const row = result.rows[0];
  return { rows: Number(row?.row_count ?? 0), hash: String(row?.hash ?? "") };
}

export async function checksumTables(exec: SqlExecutor, tables: readonly string[]): Promise<Record<string, TableChecksum>> {
  const checksums: Record<string, TableChecksum> = {};
  for (const table of tables) checksums[table] = await checksumTable(exec, table);
  return checksums;
}

export async function listMigrations(exec: SqlExecutor): Promise<string[]> {
  const result = await exec("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at, id");
  return result.rows.map((row) => String(row.hash));
}

/** Every public table must be listed in `backupTableOrder`; a new table cannot be silently skipped. */
export function assertTablesCovered(tables: readonly string[]) {
  const known = new Set<string>(backupTableOrder);
  const missing = tables.filter((table) => !known.has(table));
  if (missing.length > 0) throw new Error(`Backup order does not cover tables: ${missing.join(", ")}`);
}

export async function createSnapshot(exec: SqlExecutor, now: () => Date = () => new Date()): Promise<Snapshot> {
  await prepareSession(exec);
  const tables = await listTables(exec);
  assertTablesCovered(tables);
  const ordered = backupTableOrder.filter((table) => tables.includes(table));
  await exec("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const migrations = await listMigrations(exec);
    const snapshotTables: Record<string, TableSnapshot> = {};
    for (const table of ordered) {
      const columns = await listColumns(exec, table);
      const selectList = columns.map((column) => `${quote(column.name)}::text AS ${quote(column.name)}`).join(", ");
      const result = await exec(`SELECT ${selectList} FROM ${quote(table)}`);
      snapshotTables[table] = {
        columns,
        rows: result.rows.map((row) => columns.map((column) => {
          const value = row[column.name];
          return value === null || value === undefined ? null : String(value);
        })),
      };
    }
    const checksums = await checksumTables(exec, ordered);
    await exec("COMMIT");
    return { format: snapshotFormat, createdAt: now().toISOString(), migrations, tables: snapshotTables, checksums };
  } catch (error) {
    await exec("ROLLBACK");
    throw error;
  }
}

export function parseSnapshot(value: unknown): Snapshot {
  if (typeof value !== "object" || value === null) throw new Error("Snapshot file is not an object");
  const candidate = value as Partial<Snapshot>;
  if (candidate.format !== snapshotFormat) throw new Error("Unsupported snapshot format");
  if (!Array.isArray(candidate.migrations) || typeof candidate.tables !== "object" || candidate.tables === null || typeof candidate.checksums !== "object" || candidate.checksums === null) {
    throw new Error("Snapshot file is incomplete");
  }
  return candidate as Snapshot;
}

/** Recomputes checksums on the target and compares them with the snapshot. */
export async function verifySnapshot(exec: SqlExecutor, snapshot: Snapshot): Promise<{ ok: boolean; mismatches: ChecksumMismatch[] }> {
  await prepareSession(exec);
  const tables = Object.keys(snapshot.checksums);
  const actual = await checksumTables(exec, tables);
  const mismatches: ChecksumMismatch[] = [];
  for (const table of tables) {
    const expected = snapshot.checksums[table]!;
    const current = actual[table]!;
    if (expected.rows !== current.rows || expected.hash !== current.hash) mismatches.push({ table, expected, actual: current });
  }
  return { ok: mismatches.length === 0, mismatches };
}

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const insertChunkSize = 200;

async function insertRows(exec: SqlExecutor, table: string, snapshot: TableSnapshot) {
  if (snapshot.rows.length === 0) return;
  const columnList = snapshot.columns.map((column) => quote(column.name)).join(", ");
  for (let offset = 0; offset < snapshot.rows.length; offset += insertChunkSize) {
    const chunk = snapshot.rows.slice(offset, offset + insertChunkSize);
    const params: Array<string | null> = [];
    const tuples = chunk.map((row) => {
      const placeholders = snapshot.columns.map((column, index) => {
        params.push(row[index] ?? null);
        return `$${params.length}::${quote(column.type)}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await exec(`INSERT INTO ${quote(table)} (${columnList}) VALUES ${tuples.join(", ")}`, params);
  }
}

/**
 * Replaces every public table with the snapshot's rows in one transaction and
 * verifies the checksums before committing. Refuses to run when the target's
 * applied migrations differ from the snapshot's, because column sets would not
 * match.
 */
export async function restoreSnapshot(exec: SqlExecutor, snapshot: Snapshot): Promise<{ checksums: Record<string, TableChecksum> }> {
  if (snapshot.format !== snapshotFormat) throw new Error("Unsupported snapshot format");
  await prepareSession(exec);
  const tables = await listTables(exec);
  assertTablesCovered(tables);
  const migrations = await listMigrations(exec);
  if (!sameList(migrations, snapshot.migrations)) {
    throw new Error("Target migration state differs from the snapshot; migrate the target to the same schema first");
  }
  const snapshotTables = Object.keys(snapshot.tables);
  const unknown = snapshotTables.filter((table) => !tables.includes(table));
  const absent = tables.filter((table) => !snapshotTables.includes(table));
  if (unknown.length > 0 || absent.length > 0) throw new Error("Snapshot tables do not match the target schema");
  for (const table of tables) {
    const expected = (await listColumns(exec, table)).map((column) => column.name);
    const provided = snapshot.tables[table]!.columns.map((column) => column.name);
    if (!sameList(expected, provided)) throw new Error(`Snapshot columns do not match the target schema for ${table}`);
  }
  await exec("BEGIN");
  try {
    await exec(`TRUNCATE ${tables.map(quote).join(", ")} RESTART IDENTITY CASCADE`);
    for (const table of backupTableOrder) {
      const snapshotTable = snapshot.tables[table];
      if (snapshotTable) await insertRows(exec, table, snapshotTable);
    }
    const checksums = await checksumTables(exec, tables);
    const mismatches = tables.filter((table) => {
      const expected = snapshot.checksums[table];
      const actual = checksums[table]!;
      return !expected || expected.rows !== actual.rows || expected.hash !== actual.hash;
    });
    if (mismatches.length > 0) throw new Error(`Restore verification failed for: ${mismatches.join(", ")}`);
    await exec("COMMIT");
    return { checksums };
  } catch (error) {
    await exec("ROLLBACK");
    throw error;
  }
}

export function summarizeSnapshot(snapshot: Snapshot) {
  return Object.entries(snapshot.checksums).map(([table, checksum]) => ({ table, rows: checksum.rows, hash: checksum.hash.slice(0, 12) }));
}
