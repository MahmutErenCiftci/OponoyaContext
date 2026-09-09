import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  contextVersions,
  count,
  eq,
  exportEvents,
  globalDecisions,
  projectDecisions,
  projectResources,
  projects,
  resources,
  users,
  type Database,
} from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService, type ContextService } from "../src/modules/context/service.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectA = "00000000-0000-4000-8000-000000000030";
const projectB = "00000000-0000-4000-8000-000000000031";
const nextJs = "00000000-0000-4000-8000-000000000010";
const toggle = "00000000-0000-4000-8000-000000000011";
const redis = "00000000-0000-4000-8000-000000000012";
const foreign = "00000000-0000-4000-8000-000000000020";

let database: Pick<Database, "db" | "close">;
let service: ContextService;

beforeAll(async () => {
  database = await createTestDatabase();
  service = createContextService(createContextRepository(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: nextJs, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: "https://nextjs.org" },
    { id: toggle, ownerUserId: ownerA, name: "Animate UI Toggle", slug: "animate-ui-toggle", type: "component", sourceUrl: "https://animate-ui.com/docs/components/radix/toggle", installCommand: "npx shadcn add toggle" },
    { id: redis, ownerUserId: ownerA, name: "Redis", slug: "redis", type: "cache" },
    { id: foreign, ownerUserId: ownerB, name: "Foreign", slug: "foreign", type: "framework" },
  ]);
  await database.db.insert(projects).values([
    { id: projectA, ownerUserId: ownerA, name: "Atlas Finance", slug: "atlas-finance-000", description: "Finance SaaS", productType: "SaaS", platforms: ["web"], priorities: ["Fast MVP"] },
    { id: projectB, ownerUserId: ownerB, name: "Other", slug: "other-000" },
  ]);
  await database.db.insert(projectResources).values([{ projectId: projectA, resourceId: toggle }, { projectId: projectA, resourceId: redis }]);
  await database.db.insert(globalDecisions).values({ ownerUserId: ownerA, slot: "frontend.framework", mode: "PREFERRED", resourceId: nextJs });
  await database.db.insert(projectDecisions).values([
    { projectId: projectA, slot: "frontend.component.toggle", mode: "PREFERRED", resourceId: toggle },
    { projectId: projectA, slot: "backend.framework", mode: "AI_DECIDE", constraints: { allowed: ["Fastify"] } },
    { projectId: projectA, slot: "database.cache", mode: "DISABLED", resourceId: redis },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("Context persistence", () => {
  it("compiles owner-scoped inputs into a stored canonical version with previews", async () => {
    const result = await service.compile(ownerA, projectA);
    expect(result.created).toBe(true);
    const { canonical } = result.version;
    expect(canonical.project).toMatchObject({ name: "Atlas Finance", productType: "SaaS", platforms: ["web"] });
    expect(canonical.decisions.map((decision) => [decision.slot, decision.mode, decision.source])).toEqual([
      ["backend.framework", "AI_DECIDE", "project"],
      ["database.cache", "DISABLED", "project"],
      ["frontend.component.toggle", "PREFERRED", "project"],
      ["frontend.framework", "PREFERRED", "global"],
    ]);
    expect(canonical.resources.map((resource) => resource.name)).toEqual(["Animate UI Toggle", "Next.js"]);
    expect(canonical.resources[0]).toMatchObject({ attached: true, slots: ["frontend.component.toggle"], installCommand: "npx shadcn add toggle" });
    expect(canonical.warnings).toEqual([expect.objectContaining({ code: "DISABLED_RESOURCE_ATTACHED", resourceId: redis })]);
    expect(result.version.previews.find((preview) => preview.target === "claude")?.content).toContain("https://animate-ui.com/docs/components/radix/toggle");
  });

  it("suppresses duplicate versions, serializes concurrent compiles and numbers changes monotonically", async () => {
    const [first, second] = await Promise.all([service.compile(ownerA, projectA), service.compile(ownerA, projectA)]);
    expect(first.created || second.created).toBe(false);
    expect((await database.db.select({ value: count() }).from(contextVersions))[0]?.value).toBe(1);
    expect((await service.current(ownerA, projectA)).stale).toBe(false);

    await database.db.insert(projectDecisions).values({ projectId: projectA, slot: "frontend.framework", mode: "LOCKED", resourceId: nextJs, rationale: "Team standard" });
    expect((await service.current(ownerA, projectA)).stale).toBe(true);
    const next = await service.compile(ownerA, projectA);
    expect(next).toMatchObject({ created: true, version: { version: 2 } });
    expect(next.version.canonical.decisions.find((decision) => decision.slot === "frontend.framework")).toMatchObject({ mode: "LOCKED", source: "project", shadowed: [{ scope: "global", mode: "PREFERRED" }] });
    expect((await service.listVersions(ownerA, projectA)).map((item) => item.version)).toEqual([2, 1]);
  });

  it("keeps earlier versions readable after Resources change and flags archived ones in new compiles", async () => {
    const before = await service.getVersion(ownerA, projectA, 1);
    await database.db.update(resources).set({ archivedAt: new Date(), name: "Animate UI Toggle (old)" }).where(eq(resources.id, toggle));
    const stillReadable = await service.getVersion(ownerA, projectA, 1);
    expect(stillReadable.contentHash).toBe(before.contentHash);
    expect(stillReadable.canonical.resources[0]?.name).toBe("Animate UI Toggle");
    const recompiled = await service.compile(ownerA, projectA);
    expect(recompiled.version.version).toBe(3);
    expect(recompiled.version.canonical.warnings.map((warning) => warning.code)).toContain("RESOURCE_ARCHIVED");
    await database.db.update(resources).set({ archivedAt: null, name: "Animate UI Toggle" }).where(eq(resources.id, toggle));
  });

  it("records exports idempotently against stored versions and isolates owners", async () => {
    const key = "00000000-0000-4000-8000-000000000099";
    const first = await service.export(ownerA, projectA, { target: "agents", version: 2 }, key);
    expect(first).toMatchObject({ created: true, export: { fileName: "AGENTS.md", contextVersion: 2 }, event: { target: "agents", contextVersion: 2 } });
    const replay = await service.export(ownerA, projectA, { target: "agents", version: 2 }, key);
    expect(replay.created).toBe(false);
    expect(replay.event.id).toBe(first.event.id);
    await service.export(ownerA, projectA, { target: "copilot" });
    expect((await database.db.select({ value: count() }).from(exportEvents))[0]?.value).toBe(2);
    const history = await service.listExports(ownerA, projectA);
    expect(history.map((item) => [item.target, item.contextVersion])).toEqual([["copilot", 3], ["agents", 2]]);

    await expect(service.compile(ownerB, projectA)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getVersion(ownerB, projectA, 1)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.export(ownerB, projectA, { target: "agents" })).rejects.toMatchObject({ statusCode: 404 });
    expect(await service.listExports(ownerB, projectB)).toEqual([]);
    await expect(service.export(ownerB, projectB, { target: "agents" })).rejects.toMatchObject({ statusCode: 409 });
    const other = await service.compile(ownerB, projectB);
    expect(other.version.canonical.decisions).toEqual([]);
    expect(other.version.canonical.resources).toEqual([]);
  });
});
