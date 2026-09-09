import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export { aliasedTable, and, asc, count, countDistinct, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

export type Database = ReturnType<typeof createDatabase>;
/** Query-builder surface shared by the pool and an existing transaction. */
export type RepositoryDatabase = { db: Pick<Database["db"], "select" | "insert" | "update" | "delete" | "execute" | "transaction"> };

export type DatabaseOptions = {
  /** Upper bound of open connections for this process (default 10). */
  max?: number | undefined;
  /** Per-statement timeout applied on the server and the client (default 5 s). */
  statementTimeoutMs?: number | undefined;
  /** Idle connections are released after this long (default 30 s). */
  idleTimeoutMs?: number | undefined;
  connectionTimeoutMs?: number | undefined;
};

export type PoolStats = { total: number; idle: number; waiting: number; max: number };

export function createDatabase(connectionString: string, options: DatabaseOptions = {}) {
  const max = options.max ?? 10;
  const statementTimeout = options.statementTimeoutMs ?? 5_000;
  const pool = new Pool({
    connectionString,
    max,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    query_timeout: statementTimeout,
    statement_timeout: statementTimeout,
  });
  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    /** Counters for the pool watchdog; contains no connection details. */
    stats(): PoolStats {
      return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max };
    },
    async close() {
      await pool.end();
    },
  };
}

export * from "./schema.js";
