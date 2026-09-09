import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSnapshot, restoreSnapshot, verifySnapshot, type SqlExecutor } from "../src/backup.js";
import { readDatabaseUrl } from "../src/config.js";
import { createDatabase, type Database } from "../src/index.js";
import { runMigrations } from "../src/migrate.js";
import { createScratchDatabase, type ScratchDatabase } from "../src/testing.js";

it("replays migrations idempotently on PostgreSQL and preserves records", async () => {
  const database = createDatabase(readDatabaseUrl());
  const id = crypto.randomUUID();
  try {
    await runMigrations(database);
    await database.pool.query("INSERT INTO users (id, email, name) VALUES ($1, $2, $3)", [id, `${id}@example.test`, "Integration User"]);
    await runMigrations(database);
    expect((await database.pool.query("SELECT id FROM users WHERE id = $1", [id])).rowCount).toBe(1);
    expect((await database.pool.query("SELECT * FROM drizzle.__drizzle_migrations")).rowCount).toBeGreaterThan(0);
    // Migration 0005 is present; the shared development database may already hold audit rows.
    expect((await database.pool.query("SELECT count(*)::int AS value FROM audit_events WHERE actor_user_id = $1", [id])).rows[0]).toEqual({ value: 0 });
  } finally {
    try {
      await database.pool.query("DELETE FROM users WHERE id = $1", [id]);
    } finally {
      await database.close();
    }
  }
});

describe("backup and restore drill on a scratch PostgreSQL database", () => {
  let scratch: ScratchDatabase;
  let database: Database;
  const owner = crypto.randomUUID();
  const projectId = crypto.randomUUID();

  beforeAll(async () => {
    scratch = await createScratchDatabase(readDatabaseUrl());
    database = createDatabase(scratch.url);
  }, 60_000);

  afterAll(async () => {
    await database.close();
    await scratch.drop();
  });

  async function withClient<T>(work: (exec: SqlExecutor) => Promise<T>) {
    const client = await database.pool.connect();
    try {
      return await work((text, params) => client.query(text, params));
    } finally {
      client.release();
    }
  }

  it("backs up, survives a destructive mutation and restores with matching checksums", async () => {
    await database.pool.query("INSERT INTO users (id, email, name) VALUES ($1, $2, 'Drill Owner')", [owner, `${owner}@example.test`]);
    await database.pool.query(
      "INSERT INTO resources (owner_user_id, name, slug, type, metadata, notes) VALUES ($1, 'Drill resource', 'drill', 'database', $2::jsonb, 'private notes')",
      [owner, JSON.stringify({ version: 18.6, tags: ["a", "b"] })],
    );
    await database.pool.query("INSERT INTO projects (id, owner_user_id, name, slug, platforms) VALUES ($1, $2, 'Drill project', 'drill-project', '[\"web\"]'::jsonb)", [projectId, owner]);
    await database.pool.query("INSERT INTO context_versions (project_id, version, compiler_version, canonical, content_hash) VALUES ($1, 1, '0.4.0', '{\"decisions\":[]}'::jsonb, 'hash-1')", [projectId]);
    await database.pool.query("INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1, 'project.compiled', 'project', $2, '{\"version\":1}'::jsonb)", [owner, projectId]);

    const snapshot = await withClient((exec) => createSnapshot(exec));
    expect(snapshot.checksums.projects?.rows).toBe(1);
    expect(snapshot.checksums.context_versions?.rows).toBe(1);
    expect((await withClient((exec) => verifySnapshot(exec, snapshot))).ok).toBe(true);

    await database.pool.query("DELETE FROM projects WHERE id = $1", [projectId]);
    await database.pool.query("UPDATE resources SET notes = NULL, metadata = '{}'::jsonb");
    const damaged = await withClient((exec) => verifySnapshot(exec, snapshot));
    expect(damaged.ok).toBe(false);
    // Audit rows reference the project by id only (no FK), so they survive the cascade and stay intact.
    expect(damaged.mismatches.map((item) => item.table).sort()).toEqual(["context_versions", "projects", "resources"]);

    const restored = await withClient((exec) => restoreSnapshot(exec, snapshot));
    expect(restored.checksums).toEqual(snapshot.checksums);
    expect((await withClient((exec) => verifySnapshot(exec, snapshot))).ok).toBe(true);
    const resource = await database.pool.query("SELECT notes, metadata FROM resources WHERE owner_user_id = $1", [owner]);
    expect(resource.rows[0]).toEqual({ notes: "private notes", metadata: { version: 18.6, tags: ["a", "b"] } });
    expect((await database.pool.query("SELECT version FROM context_versions WHERE project_id = $1", [projectId])).rows).toEqual([{ version: 1 }]);
    expect((await database.pool.query("SELECT action FROM audit_events WHERE actor_user_id = $1", [owner])).rows).toEqual([{ action: "project.compiled" }]);
  }, 60_000);

  it("refuses to restore a snapshot taken at a different migration state", async () => {
    const snapshot = await withClient((exec) => createSnapshot(exec));
    await expect(withClient((exec) => restoreSnapshot(exec, { ...snapshot, migrations: [] }))).rejects.toThrow(/migration state differs/);
    expect((await withClient((exec) => verifySnapshot(exec, snapshot))).ok).toBe(true);
  });
});
