import { describe, expect, it } from "vitest";
import type { CreateResourceInput, Resource, UpdateResourceInput } from "@devcontext/contracts";
import {
  createResourceService,
  findDuplicates,
  normalizeResourceName,
  normalizeSourceUrl,
  normalizeTags,
  slugifyResourceName,
  type ResourceRepository,
} from "../src/modules/resources/service.js";

const now = new Date().toISOString();

function createRepository(): ResourceRepository & { saved: Resource[] } {
  const saved: Resource[] = [];
  return {
    saved,
    async list(ownerUserId: string) {
      const resources = saved.filter((item) => item.metadata.ownerUserId === ownerUserId);
      return { resources, total: resources.length };
    },
    async findById(ownerUserId, resourceId) {
      return saved.find((item) => item.id === resourceId && item.metadata.ownerUserId === ownerUserId) ?? null;
    },
    async create(ownerUserId, resourceId, slug, input: CreateResourceInput) {
      const resource: Resource = {
        id: resourceId, slug, name: input.name, type: input.type,
        description: input.description ?? null, sourceUrl: input.sourceUrl ?? null,
        docsUrl: input.docsUrl ?? null, repoUrl: input.repoUrl ?? null,
        installCommand: input.installCommand ?? null, notes: input.notes ?? null,
        metadata: { ...input.metadata, ownerUserId }, tags: input.tags,
        preference: input.preference ? { id: crypto.randomUUID(), ...input.preference } : null,
        favorite: false, archivedAt: null, createdAt: now, updatedAt: now,
      };
      saved.push(resource);
      return resource;
    },
    async update(ownerUserId, resourceId, input: UpdateResourceInput) {
      const resource = saved.find((item) => item.id === resourceId && item.metadata.ownerUserId === ownerUserId);
      if (!resource) return null;
      if (input.name !== undefined) resource.name = input.name;
      if (input.tags !== undefined) resource.tags = input.tags;
      if (input.favorite !== undefined) resource.favorite = input.favorite;
      return resource;
    },
    async archive(ownerUserId, resourceId) {
      const resource = saved.find((item) => item.id === resourceId && item.metadata.ownerUserId === ownerUserId);
      if (!resource) return null;
      resource.archivedAt = now;
      resource.preference = null;
      return resource;
    },
    async restore(ownerUserId, resourceId) {
      const resource = saved.find((item) => item.id === resourceId && item.metadata.ownerUserId === ownerUserId);
      if (!resource) return null;
      resource.archivedAt = null;
      return resource;
    },
    async listDuplicateCandidates(ownerUserId, excludeResourceId) {
      return saved
        .filter((item) => item.metadata.ownerUserId === ownerUserId && item.id !== excludeResourceId && !item.archivedAt)
        .map((item) => ({ id: item.id, name: item.name, type: item.type, sourceUrl: item.sourceUrl }));
    },
    async listCatalogLinks(ownerUserId) {
      return saved
        .filter((item) => item.metadata.ownerUserId === ownerUserId && typeof item.metadata.catalogSlug === "string")
        .map((item) => ({ catalogSlug: String(item.metadata.catalogSlug), resourceId: item.id, archived: item.archivedAt !== null }));
    },
  };
}

describe("Resource Library domain", () => {
  it("creates stable slugs and canonical tags", () => {
    expect(slugifyResourceName("Şık Ölçekli Çözüm")).toBe("sik-olcekli-cozum");
    expect(normalizeTags([" Frontend ", "frontend", "SAAS"])).toEqual(["frontend", "saas"]);
  });

  it("normalizes URLs and names for duplicate detection", () => {
    expect(normalizeSourceUrl("https://www.NextJS.org/docs/?utm_source=x&b=2&a=1#top")).toBe("nextjs.org/docs?a=1&b=2");
    expect(normalizeSourceUrl("http://nextjs.org/docs")).toBe("nextjs.org/docs");
    expect(normalizeSourceUrl("not a url")).toBeNull();
    expect(normalizeResourceName("  Next.JS  ")).toBe("next js");
    expect(normalizeResourceName("shadcn/ui")).toBe("shadcn ui");
    const candidates = [
      { id: "1", name: "Next.js", type: "framework" as const, sourceUrl: "https://www.nextjs.org/" },
      { id: "2", name: "Next JS", type: "framework" as const, sourceUrl: null },
      { id: "3", name: "Next.js", type: "reference" as const, sourceUrl: null },
    ];
    expect(findDuplicates({ name: "next.js", type: "framework", sourceUrl: "http://nextjs.org?utm_campaign=a" }, candidates).map((item) => [item.id, item.reason]))
      .toEqual([["1", "url"], ["2", "name"]]);
  });

  it("normalizes writes, warns on duplicates with evidence and enforces ownership", async () => {
    const repository = createRepository();
    const service = createResourceService(repository);
    const input: CreateResourceInput = {
      name: "Next.js", type: "framework", sourceUrl: "https://nextjs.org",
      tags: [" Frontend ", "frontend"], metadata: {},
      preference: { slot: "frontend.framework", mode: "PREFERRED" },
    };
    const first = await service.create("owner-a", input);
    expect(first.resource.tags).toEqual(["frontend"]);
    expect(first.resource.slug).toMatch(/^next-js-[a-f0-9]{8}$/);
    expect(first.warnings).toEqual([]);
    expect(first.duplicates).toEqual([]);
    const second = await service.create("owner-a", { ...input, name: "Next docs", sourceUrl: "https://www.nextjs.org/" });
    expect(second.warnings).toEqual(["DUPLICATE_SOURCE_URL"]);
    expect(second.duplicates).toEqual([{ id: first.resource.id, name: "Next.js", type: "framework", sourceUrl: "https://nextjs.org", reason: "url" }]);
    const third = await service.create("owner-a", { ...input, name: "NEXT JS", sourceUrl: undefined });
    expect(third.warnings).toEqual(["DUPLICATE_NAME"]);
    const favorite = await service.update("owner-a", first.resource.id, { favorite: true });
    expect(favorite.resource.favorite).toBe(true);
    await expect(service.get("owner-b", first.resource.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await service.create("owner-b", input)).warnings).toEqual([]);
  });
});
