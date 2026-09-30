import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";
import { readDatabaseUrl } from "../src/config.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));

/** Copies the committed migrations but truncates the journal to the first `count` entries. */
function partialMigrations(count: number) {
  const folder = mkdtempSync(join(tmpdir(), "devcontext-migrations-"));
  cpSync(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

it("applies committed migrations twice without data loss and enforces constraints", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder });
    const inserted = await client.query<{ id: string }>("INSERT INTO users (email, name) VALUES ('migration@example.test', 'Migration User') RETURNING id");
    const owner = inserted.rows[0]!.id;
    await client.query("INSERT INTO projects (owner_user_id, name, slug) VALUES ($1, 'Demo', 'demo')", [owner]);
    await migrate(db, { migrationsFolder });
    const projects = await client.query("SELECT * FROM projects");
    expect(projects.rows).toHaveLength(1);
    await expect(client.query("INSERT INTO projects (owner_user_id, name, slug) VALUES ($1, 'Duplicate', 'demo')", [owner])).rejects.toMatchObject({ code: "23505" });
    await expect(client.query("INSERT INTO projects (owner_user_id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'Orphan', 'orphan')")).rejects.toMatchObject({ code: "23503" });
    await expect(client.query("INSERT INTO sessions (expires_at, token, user_id) VALUES (now() + interval '1 day', 'orphan', '00000000-0000-0000-0000-000000000001')")).rejects.toMatchObject({ code: "23503" });
    await client.query("INSERT INTO audit_events (actor_user_id, action, entity_type) VALUES ($1, 'project.created', 'project')", [owner]);
    await expect(client.query("INSERT INTO audit_events (actor_user_id, action, entity_type) VALUES ('00000000-0000-0000-0000-000000000001', 'x', 'project')")).rejects.toMatchObject({ code: "23503" });
    await client.query("DELETE FROM users WHERE id = $1", [owner]);
    expect((await client.query("SELECT * FROM projects")).rows).toHaveLength(0);
    expect((await client.query("SELECT * FROM audit_events")).rows).toHaveLength(0);
  } finally {
    await client.close();
  }
});

it("upgrades a database that stopped at the previous migration without losing rows", async () => {
  const previous = partialMigrations(7);
  const client = new PGlite();
  const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder: previous });
    expect((await client.query("SELECT count(*)::int AS value FROM drizzle.__drizzle_migrations")).rows[0]).toEqual({ value: 7 });
    await expect(client.query("SELECT 1 FROM subscriptions")).rejects.toMatchObject({ code: "42P01" });
    const inserted = await client.query<{ id: string }>("INSERT INTO users (email, name) VALUES ('upgrade@example.test', 'Upgrade User') RETURNING id");
    const owner = inserted.rows[0]!.id;
    await client.query("INSERT INTO resources (owner_user_id, name, slug, type, favorite) VALUES ($1, 'Kept', 'kept', 'framework', true)", [owner]);
    await client.query("INSERT INTO projects (owner_user_id, name, slug, rules) VALUES ($1, 'Kept project', 'kept-project', '[\"rule\"]'::jsonb)", [owner]);

    await migrate(db, { migrationsFolder });
    expect((await client.query("SELECT count(*)::int AS value FROM drizzle.__drizzle_migrations")).rows[0]).toEqual({ value: 10 });
    expect((await client.query("SELECT name, favorite FROM resources")).rows).toEqual([{ name: "Kept", favorite: true }]);
    await client.query("INSERT INTO subscriptions (owner_user_id, plan, status) VALUES ($1, 'pro', 'active')", [owner]);
    await expect(client.query("INSERT INTO subscriptions (owner_user_id) VALUES ($1)", [owner])).rejects.toMatchObject({ code: "23505" });
    await client.query("INSERT INTO billing_events (provider, provider_event_id, type, event_at) VALUES ('fake', 'evt_1', 'invoice.paid', now())");
    await expect(client.query("INSERT INTO billing_events (provider, provider_event_id, type, event_at) VALUES ('fake', 'evt_1', 'invoice.paid', now())")).rejects.toMatchObject({ code: "23505" });
    expect((await client.query("SELECT plan, cancel_at_period_end FROM subscriptions")).rows).toEqual([{ plan: "pro", cancel_at_period_end: false }]);
    expect((await client.query("SELECT recipe_id FROM projects")).rows).toEqual([{ recipe_id: null }]);
    await client.query("INSERT INTO workspace_settings (owner_user_id, onboarding_state) VALUES ($1, 'skipped')", [owner]);
    expect((await client.query("SELECT onboarding_state, sample_version FROM workspace_settings")).rows).toEqual([{ onboarding_state: "skipped", sample_version: null }]);
    expect((await client.query("SELECT name, rules FROM projects")).rows).toEqual([{ name: "Kept project", rules: ["rule"] }]);
    await client.query("INSERT INTO audit_events (actor_user_id, action, entity_type) VALUES ($1, 'resource.created', 'resource')", [owner]);
    expect((await client.query("SELECT action FROM audit_events")).rows).toEqual([{ action: "resource.created" }]);
  } finally {
    await client.close();
    rmSync(previous, { recursive: true, force: true });
  }
});

it("0009 adds AI suggestions, the consent column and foreign-key indexes without touching existing rows", async () => {
  const previous = partialMigrations(9);
  const client = new PGlite();
  const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder: previous });
    await expect(client.query("SELECT 1 FROM ai_suggestions")).rejects.toMatchObject({ code: "42P01" });
    const inserted = await client.query<{ id: string }>("INSERT INTO users (email, name) VALUES ('ai-upgrade@example.test', 'AI Upgrade') RETURNING id");
    const owner = inserted.rows[0]!.id;
    await client.query("INSERT INTO workspace_settings (owner_user_id, onboarding_state) VALUES ($1, 'completed')", [owner]);
    const project = await client.query<{ id: string }>("INSERT INTO projects (owner_user_id, name, slug) VALUES ($1, 'Kept', 'kept') RETURNING id", [owner]);
    const projectId = project.rows[0]!.id;

    await migrate(db, { migrationsFolder });
    expect((await client.query("SELECT onboarding_state, ai_consent_at FROM workspace_settings")).rows).toEqual([{ onboarding_state: "completed", ai_consent_at: null }]);
    await client.query(
      "INSERT INTO ai_suggestions (owner_user_id, project_id, kind, slot, provider, model, input_hash, proposal) VALUES ($1, $2, 'decision_proposal', 'backend.framework', 'fake', 'fake-deterministic', 'hash', '{}'::jsonb)",
      [owner, projectId],
    );
    expect((await client.query("SELECT status, warnings, input_tokens FROM ai_suggestions")).rows).toEqual([{ status: "pending", warnings: [], input_tokens: 0 }]);
    const indexes = (await client.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((row) => row.indexname);
    for (const name of [
      "export_events_project_created_idx", "export_events_context_version_idx", "project_profiles_profile_idx", "recipe_profiles_profile_idx",
      "resource_tags_tag_idx", "global_decisions_resource_idx", "profile_decisions_resource_idx", "recipe_decisions_resource_idx", "project_decisions_resource_idx",
    ]) expect(indexes).toContain(name);
    // Suggestions follow the Project and the owner.
    await client.query("DELETE FROM projects WHERE id = $1", [projectId]);
    expect((await client.query("SELECT count(*)::int AS value FROM ai_suggestions")).rows[0]).toEqual({ value: 0 });
  } finally {
    await client.close();
    rmSync(previous, { recursive: true, force: true });
  }
});

it("validates database URLs without echoing secrets", () => {
  expect(() => readDatabaseUrl({ DATABASE_URL: "private-secret" })).toThrow("Invalid environment variable: DATABASE_URL");
  expect(readDatabaseUrl({ DATABASE_URL: "postgresql://localhost/test" })).toBe("postgresql://localhost/test");
});
