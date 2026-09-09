import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDatabase, type Database } from "./index.js";
import { runMigrations } from "./migrate.js";

/**
 * In-memory PostgreSQL (PGlite) with every committed migration applied.
 *
 * Intended for repository tests that need real SQL semantics without a server.
 * PGlite is a development dependency of this package and is loaded lazily, so
 * production code that never calls this function never loads it.
 */
export async function createTestDatabase(): Promise<Pick<Database, "db" | "close">> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)) });
  return {
    // Repositories only use Drizzle's shared query builder, which the PGlite
    // driver implements with the same API as node-postgres.
    db: db as unknown as Database["db"],
    async close() {
      await client.close();
    },
  };
}

export type ScratchDatabase = {
  /** Connection URL of the freshly created, fully migrated database. */
  url: string;
  /** Drops the scratch database. Close every pool connected to it first. */
  drop(): Promise<void>;
};

/**
 * Creates a throwaway database on the PostgreSQL server behind `baseUrl` and
 * applies every migration to it. Integration tests use it for destructive
 * drills (restore, concurrency) so the development database is never touched.
 * Requires CREATEDB on the connecting role.
 */
export async function createScratchDatabase(baseUrl: string): Promise<ScratchDatabase> {
  const name = `devcontext_scratch_${randomBytes(6).toString("hex")}`;
  const admin = createDatabase(baseUrl);
  try {
    await admin.pool.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.close();
  }
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const scratch = createDatabase(url.toString());
  try {
    await runMigrations(scratch);
  } finally {
    await scratch.close();
  }
  return {
    url: url.toString(),
    async drop() {
      const cleaner = createDatabase(baseUrl);
      try {
        await cleaner.pool.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await cleaner.close();
      }
    },
  };
}
