import { describe, expect, it } from "vitest";
import { catalogOverviewSchema, catalogStackSchema, catalogTechnologySchema } from "@devcontext/contracts";
import {
  catalogDomainOrder,
  catalogVersion,
  getOverview,
  getStack,
  getTechnology,
  listStacks,
  listTechnologies,
  pendingReferences,
  presetDecisionsForStack,
  technologiesForStack,
  unknownStackReferences,
} from "../src/index.js";

describe("technology catalog", () => {
  it("loads every research file and validates it against the contracts", () => {
    const overview = catalogOverviewSchema.parse(getOverview());
    expect(overview.technologyCount).toBe(246);
    expect(overview.stackCount).toBe(15);
    expect(overview.readinessCount).toBe(50);
    expect(overview.velocityCount).toBe(28);
    expect(overview.version).toBe(catalogVersion);
    expect(overview.domains.map((domain) => domain.id)).toEqual(catalogDomainOrder);
    expect(overview.domains.reduce((sum, domain) => sum + domain.count, 0)).toBe(246);
    expect(overview.domains.find((domain) => domain.id === "security")?.note).toContain("savunma");
    expect(overview.methodology.warning).toContain("editör değerlendirmesi");
    for (const item of listTechnologies()) catalogTechnologySchema.parse(getTechnology(item.slug));
    for (const item of listStacks()) catalogStackSchema.parse(getStack(item.slug));
  });

  it("keeps slugs unique and resolves references without inventing entries", () => {
    const slugs = listTechnologies().map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const next = getTechnology("nextjs");
    expect(next?.type).toBe("framework");
    expect(next?.readiness?.aiBuildability).toBeGreaterThanOrEqual(1);
    expect(next?.readiness?.aiPitfalls.length).toBeGreaterThan(0);
    expect(next?.pairsWith.find((ref) => ref.slug === "react")).toMatchObject({ known: true, name: "React" });
    expect(next?.stacks.map((stack) => stack.slug)).toContain("t3-stack");
    const pending = pendingReferences();
    expect(pending.length).toBeGreaterThan(300);
    expect(pending.every((entry) => getTechnology(entry.slug) === null)).toBe(true);
    expect(getTechnology("definitely-not-a-technology")).toBeNull();
  });

  it("filters by domain, type, tag and folded text", () => {
    expect(listTechnologies({ domain: "turkey" })).toHaveLength(12);
    expect(listTechnologies({ type: "orm" }).every((item) => item.type === "orm")).toBe(true);
    expect(listTechnologies({ q: "postgre" }).map((item) => item.slug)).toContain("postgresql");
    expect(listTechnologies({ q: "İYS" }).map((item) => item.slug)).toContain("iys");
    expect(listTechnologies({ q: "typescript orm" }).map((item) => item.slug)).toContain("drizzle-orm");
    expect(listTechnologies({ tag: "fullstack" }).length).toBeGreaterThan(0);
    expect(listTechnologies({ q: "zzzz-no-match" })).toHaveLength(0);
  });

  it("exposes stack presets with resolved layers and separate velocity scores", () => {
    const stack = getStack("t3-stack");
    expect(stack?.layers.map((layer) => layer.layer)).toEqual(["language", "frontend", "backend", "database", "infra"]);
    expect(stack?.layers[0]?.technologies[0]).toMatchObject({ slug: "typescript", known: true });
    expect(stack?.technologyCount).toBeGreaterThan(8);
    expect(stack?.velocity).toMatchObject({ prototypeSpeed: 4, productionReadiness: 4, timeToMvp: expect.any(String) });
    const vibe = getStack("vibe-coding-stack");
    expect(vibe?.prototypeSpeed).toBe(5);
    expect(vibe?.productionReadiness).toBe(2);
    expect(vibe?.velocity?.productionGaps.length).toBeGreaterThan(3);
    expect(technologiesForStack("t3-stack")?.map((item) => item.slug)).toContain("drizzle-orm");
    expect(unknownStackReferences("laravel-livewire")).toContain("livewire");
    expect(getStack("nope")).toBeNull();
    expect(technologiesForStack("nope")).toBeNull();
  });

  it("maps a stack preset to one technology per decision slot", () => {
    const decisions = presetDecisionsForStack("t3-stack") ?? [];
    const bySlot = Object.fromEntries(decisions.map((item) => [item.slot, item.technologySlug]));
    expect(bySlot).toMatchObject({
      "frontend.language": "typescript",
      "backend.language": "typescript",
      "frontend.framework": "nextjs",
      "frontend.ui.base": "shadcn-ui",
      "backend.api_style": "trpc",
      "auth.provider": "better-auth",
      "database.primary": "postgresql",
      "database.query_layer": "drizzle-orm",
      "infra.deployment.primary": "vercel",
    });
    expect(new Set(decisions.map((item) => item.slot)).size).toBe(decisions.length);
    expect(presetDecisionsForStack("django-htmx")?.find((item) => item.slot === "backend.language")?.technologySlug).toBe("python");
    expect(presetDecisionsForStack("nope")).toBeNull();
  });
});
