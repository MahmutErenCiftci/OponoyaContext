import { drizzle } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema.js";

export { aliasedTable, and, asc, count, countDistinct, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
export type { SQL, Table } from "drizzle-orm";

/** `%text%` for ILIKE with `%`, `_` and `\` matched literally (backslash is PostgreSQL's default LIKE escape). */
export function containsPattern(text: string): string {
  return `%${text.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
}

type Results<T extends readonly (() => PromiseLike<unknown>)[]> = { -readonly [K in keyof T]: T[K] extends () => PromiseLike<infer R> ? R : never };

/**
 * Runs independent reads. Against the pool they run concurrently, each on its
 * own connection; inside a transaction, which is a single connection, they run
 * one after another: node-postgres deprecates (and pg 9 rejects) a query issued
 * while another one is still running on the same client. Repositories may be
 * handed a transaction (sample install, import), so they use this instead of
 * `Promise.all` over queries.
 */
export async function readAll<const T extends readonly (() => PromiseLike<unknown>)[]>(executor: object, tasks: T): Promise<Results<T>> {
  if (!(executor instanceof PgTransaction)) return (await Promise.all(tasks.map((task) => task()))) as Results<T>;
  const results: unknown[] = [];
  for (const task of tasks) results.push(await task());
  return results as Results<T>;
}

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
