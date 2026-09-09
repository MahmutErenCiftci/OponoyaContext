import { describe, expect, it } from "vitest";
import type { CompileInput } from "@devcontext/context-compiler";
import { compileResponseSchema, contextStateResponseSchema, exportResponseSchema } from "@devcontext/contracts";
import {
  createContextService,
  type ContextRepository,
  type ContextVersionRow,
  type ExportEventRow,
} from "../src/modules/context/service.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectA = "00000000-0000-4000-8000-000000000030";
const nextJs = "00000000-0000-4000-8000-000000000010";

function createRepository() {
  const versions: ContextVersionRow[] = [];
  const exports: Array<ExportEventRow & { idempotencyKey: string | null }> = [];
  let input: CompileInput = {
    project: { id: projectA, name: "Atlas Finance", stage: "mvp", platforms: ["web"], priorities: ["Fast MVP"] },
    resources: [{ id: nextJs, name: "Next.js", type: "framework", sourceUrl: "https://nextjs.org" }],
    attachedResourceIds: [nextJs],
    globalDecisions: [{ id: "g1", scope: "global", slot: "frontend.framework", mode: "PREFERRED", resourceId: nextJs }],
    projectDecisions: [],
  };
  const owns = (ownerUserId: string, projectId: string) => ownerUserId === ownerA && projectId === projectA;
  const repository: ContextRepository = {
    async projectExists(ownerUserId, projectId) { return owns(ownerUserId, projectId); },
    async loadCompileInput(ownerUserId, projectId) { return owns(ownerUserId, projectId) ? structuredClone(input) : null; },
    async latestVersion(ownerUserId, projectId) { return owns(ownerUserId, projectId) ? versions.at(-1) ?? null : null; },
    async listVersions(ownerUserId, projectId) { return owns(ownerUserId, projectId) ? [...versions].reverse() : []; },
    async findVersion(ownerUserId, projectId, version) { return owns(ownerUserId, projectId) ? versions.find((row) => row.version === version) ?? null : null; },
    async createVersionIfChanged(ownerUserId, projectId, canonical, contentHash, compilerVersion) {
      if (!owns(ownerUserId, projectId)) return null;
      const latest = versions.at(-1);
      if (latest && latest.contentHash === contentHash) return { row: latest, created: false };
      const row: ContextVersionRow = { id: crypto.randomUUID(), version: (latest?.version ?? 0) + 1, compilerVersion, contentHash, canonical, createdAt: new Date() };
      versions.push(row);
      return { row, created: true };
    },
    async recordExport(ownerUserId, projectId, contextVersionId, target, fileName, idempotencyKey) {
      if (!owns(ownerUserId, projectId)) return null;
      const existing = idempotencyKey ? exports.find((item) => item.idempotencyKey === idempotencyKey) : undefined;
      if (existing) return { row: existing, created: false };
      const version = versions.find((row) => row.id === contextVersionId);
      const row = { id: crypto.randomUUID(), target, metadata: { fileName }, contextVersion: version?.version ?? null, contentHash: version?.contentHash ?? null, createdAt: new Date(), idempotencyKey };
      exports.push(row);
      return { row, created: true };
    },
    async listExports(ownerUserId, projectId) { return owns(ownerUserId, projectId) ? [...exports].reverse() : []; },
  };
  return {
    repository,
    versions,
    exports,
    lockFrontend() {
      input = { ...input, projectDecisions: [{ id: "d1", scope: "project", slot: "frontend.framework", mode: "LOCKED", resourceId: nextJs, rationale: "Team standard" }] };
    },
  };
}

describe("Context service", () => {
  it("compiles a canonical version, suppresses duplicates and numbers changes monotonically", async () => {
    const fixture = createRepository();
    const service = createContextService(fixture.repository);
    const before = await service.current(ownerA, projectA);
    expect(before).toMatchObject({ version: null, stale: true });
    expect(contextStateResponseSchema.parse(before).draftHash).toMatch(/^[a-f0-9]{64}$/);

    const first = await service.compile(ownerA, projectA);
    expect(compileResponseSchema.parse(first).created).toBe(true);
    expect(first.version).toMatchObject({ version: 1, compilerVersion: "0.4.1", decisionCount: 1, warningCount: 0 });
    expect(first.version.canonical.decisions[0]).toMatchObject({ slot: "frontend.framework", mode: "PREFERRED", source: "global" });
    expect(first.version.previews.map((preview) => preview.target)).toEqual(["generic", "agents", "claude", "cursor", "copilot"]);
    expect(first.version.previews.find((preview) => preview.target === "agents")?.content).toContain("Prefer Next.js");

    const again = await service.compile(ownerA, projectA);
    expect(again.created).toBe(false);
    expect(again.version.version).toBe(1);
    expect(fixture.versions).toHaveLength(1);
    expect((await service.current(ownerA, projectA)).stale).toBe(false);

    fixture.lockFrontend();
    const state = await service.current(ownerA, projectA);
    expect(state.stale).toBe(true);
    expect(state.version?.version).toBe(1);
    const second = await service.compile(ownerA, projectA);
    expect(second).toMatchObject({ created: true, version: { version: 2 } });
    expect(second.version.canonical.decisions[0]).toMatchObject({ mode: "LOCKED", source: "project", shadowed: [{ decisionId: "g1", scope: "global" }] });
    expect((await service.listVersions(ownerA, projectA)).map((item) => item.version)).toEqual([2, 1]);
    expect((await service.getVersion(ownerA, projectA, 1)).canonical.decisions[0]?.mode).toBe("PREFERRED");
    await expect(service.getVersion(ownerA, projectA, 9)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("exports only compiled versions, records events idempotently and isolates owners", async () => {
    const fixture = createRepository();
    const service = createContextService(fixture.repository);
    await expect(service.export(ownerA, projectA, { target: "agents" })).rejects.toMatchObject({ statusCode: 409, details: [{ path: ["version"], code: "context_not_compiled" }] });
    await service.compile(ownerA, projectA);

    const key = "00000000-0000-4000-8000-000000000099";
    const first = await service.export(ownerA, projectA, { target: "agents" }, key);
    expect(exportResponseSchema.parse(first).created).toBe(true);
    expect(first.export).toMatchObject({ fileName: "AGENTS.md", contextVersion: 1 });
    expect(first.export.content).toContain("# AGENTS.md — Atlas Finance");
    const replay = await service.export(ownerA, projectA, { target: "agents" }, key);
    expect(replay.created).toBe(false);
    expect(replay.event.id).toBe(first.event.id);
    const cursor = await service.export(ownerA, projectA, { target: "cursor", version: 1 });
    expect(cursor.export.fileName).toBe(".cursor/rules/devcontext.mdc");
    expect((await service.listExports(ownerA, projectA)).map((item) => item.target)).toEqual(["cursor", "agents"]);
    await expect(service.export(ownerA, projectA, { target: "claude", version: 4 })).rejects.toMatchObject({ statusCode: 404 });

    for (const call of [
      () => service.compile(ownerB, projectA),
      () => service.current(ownerB, projectA),
      () => service.listVersions(ownerB, projectA),
      () => service.getVersion(ownerB, projectA, 1),
      () => service.export(ownerB, projectA, { target: "agents" }),
      () => service.listExports(ownerB, projectA),
    ]) {
      await expect(call()).rejects.toMatchObject({ statusCode: 404 });
    }
  });
});
