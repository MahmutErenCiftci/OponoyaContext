import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertTablesCovered,
  backupTableOrder,
  createSnapshot,
  listTables,
  parseSnapshot,
  restoreSnapshot,
  verifySnapshot,
  type Snapshot,
  type SqlExecutor,
} from "../src/backup.js";

const owner = "00000000-0000-4000-8000-000000000001";
const resourceId = "00000000-0000-4000-8000-000000000010";
const projectId = "00000000-0000-4000-8000-000000000030";

let client: PGlite;
let exec: SqlExecutor;

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)) });
  exec = (text, params) => client.query(text, params);
  await exec("INSERT INTO users (id, email, name) VALUES ($1, 'backup@example.test', 'Backup Owner')", [owner]);
  await exec(
    "INSERT INTO resources (id, owner_user_id, name, slug, type, metadata, notes, favorite) VALUES ($1, $2, 'Next.js — “quoted”', 'next-js', 'framework', $3::jsonb, $4, true)",
    [resourceId, owner, '{"weight": 1.0, "ratio": 0.10, "nested": {"keys": ["b", "a"]}, "note": "ünïcödé ✓"}', "line one\nline two\ttabbed"],
  );
  await exec("INSERT INTO tags (owner_user_id, name) VALUES ($1, 'frontend')", [owner]);
  await exec("INSERT INTO resource_tags (resource_id, tag_id) SELECT $1, id FROM tags WHERE owner_user_id = $2", [resourceId, owner]);
  await exec("INSERT INTO projects (id, owner_user_id, name, slug, platforms, rules) VALUES ($1, $2, 'Atlas', 'atlas-00000000', '[\"web\",\"cli\"]'::jsonb, '[\"Keep it boring.\"]'::jsonb)", [projectId, owner]);
  await exec("INSERT INTO project_resources (project_id, resource_id) VALUES ($1, $2)", [projectId, resourceId]);
  await exec("INSERT INTO project_decisions (project_id, slot, mode, resource_id, priority, constraints) VALUES ($1, 'frontend.framework', 'LOCKED', $2, 5, '{\"allowed\":[\"x\"]}'::jsonb)", [projectId, resourceId]);
  await exec("INSERT INTO global_decisions (owner_user_id, slot, mode, resource_id) VALUES ($1, 'frontend.framework', 'PREFERRED', $2)", [owner, resourceId]);
  await exec("INSERT INTO context_versions (project_id, version, compiler_version, canonical, content_hash) VALUES ($1, 1, '0.4.0', '{\"decisions\":[],\"warnings\":[]}'::jsonb, 'abc')", [projectId]);
  await exec("INSERT INTO export_events (project_id, context_version_id, target, metadata) SELECT $1, id, 'agents', '{\"fileName\":\"AGENTS.md\"}'::jsonb FROM context_versions WHERE project_id = $1", [projectId]);
  await exec("INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id) VALUES ($1, 'project.compiled', 'project', $2, '{\"version\":1}'::jsonb, 'req-1')", [owner, projectId]);
  await exec("INSERT INTO sessions (expires_at, token, user_id, ip_address) VALUES (now() + interval '1 day', 'session-token', $1, '127.0.0.1')", [owner]);
}, 60_000);

afterAll(async () => { await client.close(); });

describe("logical backup and restore", () => {
  let snapshot: Snapshot;

  it("covers every public table in dependency order", async () => {
    const tables = await listTables(exec);
    expect(() => assertTablesCovered(tables)).not.toThrow();
    expect(tables.sort()).toEqual([...backupTableOrder].sort());
    expect(() => assertTablesCovered([...tables, "stray_table"])).toThrow(/stray_table/);
  });

  it("snapshots rows as exact text and records migrations plus checksums", async () => {
    snapshot = await createSnapshot(exec, () => new Date("2026-09-07T00:00:00Z"));
    expect(snapshot.format).toBe(1);
    expect(snapshot.migrations).toHaveLength(9);
    expect(snapshot.checksums.resources).toMatchObject({ rows: 1 });
    expect(snapshot.checksums.audit_events).toMatchObject({ rows: 1 });
    expect(snapshot.checksums.recipes).toEqual({ rows: 0, hash: "" });
    const resources = snapshot.tables.resources!;
    const nameIndex = resources.columns.findIndex((column) => column.name === "name");
    const metadataIndex = resources.columns.findIndex((column) => column.name === "metadata");
    expect(resources.rows[0]![nameIndex]).toBe("Next.js — “quoted”");
    expect(resources.rows[0]![metadataIndex]).toContain('"weight": 1.0');
    expect(resources.rows[0]![metadataIndex]).toContain('"ratio": 0.10');
    expect(resources.columns.find((column) => column.name === "type")?.type).toBe("resource_type");
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    expect((await verifySnapshot(exec, snapshot)).ok).toBe(true);
  });

  it("restores after destructive mutations and verifies content hashes", async () => {
    await exec("DELETE FROM projects WHERE id = $1", [projectId]);
    await exec("UPDATE resources SET name = 'Renamed', metadata = '{}'::jsonb WHERE id = $1", [resourceId]);
    await exec("INSERT INTO tags (owner_user_id, name) VALUES ($1, 'stray')", [owner]);
    await exec("DELETE FROM audit_events");
    const damaged = await verifySnapshot(exec, snapshot);
    expect(damaged.ok).toBe(false);
    expect(damaged.mismatches.map((item) => item.table).sort()).toEqual(
      ["audit_events", "context_versions", "export_events", "project_decisions", "project_resources", "projects", "resources", "tags"],
    );

    const restored = await restoreSnapshot(exec, snapshot);
    expect(restored.checksums).toEqual(snapshot.checksums);
    expect((await verifySnapshot(exec, snapshot)).ok).toBe(true);
    const resource = await exec("SELECT name, metadata, notes, favorite FROM resources WHERE id = $1", [resourceId]);
    expect(resource.rows[0]).toMatchObject({ name: "Next.js — “quoted”", notes: "line one\nline two\ttabbed", favorite: true });
    expect(resource.rows[0]?.metadata).toEqual({ weight: 1, ratio: 0.1, nested: { keys: ["b", "a"] }, note: "ünïcödé ✓" });
    expect((await exec("SELECT metadata::text AS text FROM resources WHERE id = $1", [resourceId])).rows[0]?.text).toContain('"weight": 1.0');
    expect((await exec("SELECT count(*)::int AS value FROM projects")).rows[0]?.value).toBe(1);
    expect((await exec("SELECT count(*)::int AS value FROM tags")).rows[0]?.value).toBe(1);
    expect((await exec("SELECT action FROM audit_events")).rows).toEqual([{ action: "project.compiled" }]);
    expect((await exec("SELECT priority, constraints FROM project_decisions")).rows[0]).toEqual({ priority: 5, constraints: { allowed: ["x"] } });
  });

  it("rolls back when the snapshot cannot be reproduced and refuses mismatched schemas", async () => {
    const before = await createSnapshot(exec);
    const corrupted: Snapshot = { ...snapshot, checksums: { ...snapshot.checksums, resources: { rows: 1, hash: "0".repeat(32) } } };
    await expect(restoreSnapshot(exec, corrupted)).rejects.toThrow(/verification failed for: resources/);
    expect((await verifySnapshot(exec, before)).ok).toBe(true);
    await expect(restoreSnapshot(exec, { ...snapshot, migrations: snapshot.migrations.slice(0, -1) })).rejects.toThrow(/migration state differs/);
    await expect(restoreSnapshot(exec, { ...snapshot, tables: { ...snapshot.tables, extra: { columns: [], rows: [] } } })).rejects.toThrow(/do not match/);
    expect(() => parseSnapshot({ format: 2 })).toThrow(/Unsupported/);
    expect(() => parseSnapshot("nope")).toThrow(/not an object/);
    expect((await verifySnapshot(exec, before)).ok).toBe(true);
  });
});
