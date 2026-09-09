import { describe, expect, it } from "vitest";
import type { Project, ProjectListQuery, ProjectProfileAttachment } from "@devcontext/contracts";
import {
  createProjectService,
  normalizeProfiles,
  normalizeStringList,
  slugifyProjectName,
  unavailableProfilesError,
  unavailableResourcesError,
  type ProjectRepository,
} from "../src/modules/projects/service.js";

const now = new Date().toISOString();
const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const resourceA1 = "00000000-0000-4000-8000-000000000010";
const resourceA2 = "00000000-0000-4000-8000-000000000011";
const resourceB1 = "00000000-0000-4000-8000-000000000020";
const profileA = "00000000-0000-4000-8000-000000000070";
const profileB = "00000000-0000-4000-8000-000000000071";
const requestKey = "00000000-0000-4000-8000-000000000099";

type Stored = Project & { ownerUserId: string; clientRequestId: string };

function summary(id: string): Project["resources"][number] {
  return { id, name: `Resource ${id.slice(-2)}`, slug: `resource-${id.slice(-8)}`, type: "framework", sourceUrl: null, archivedAt: null, attachedAt: now };
}

function profileSummary(attachment: ProjectProfileAttachment): Project["profiles"][number] {
  return { id: attachment.profileId, name: `Profile ${attachment.profileId.slice(-2)}`, slug: `profile-${attachment.profileId.slice(-8)}`, type: "stack", priority: attachment.priority, archivedAt: null };
}

function createRepository(activeResources: Record<string, string[]>, activeProfiles: Record<string, string[]> = {}): ProjectRepository & { saved: Stored[] } {
  const saved: Stored[] = [];
  function assertAttachable(ownerUserId: string, ids: string[], retained: Set<string>) {
    const allowed = new Set(activeResources[ownerUserId] ?? []);
    const rejected = ids.flatMap((id, index) => retained.has(id) || allowed.has(id) ? [] : [index]);
    if (rejected.length > 0) throw unavailableResourcesError(rejected);
  }
  function assertProfiles(ownerUserId: string, attachments: ProjectProfileAttachment[], retained: Set<string>) {
    const allowed = new Set(activeProfiles[ownerUserId] ?? []);
    const rejected = attachments.flatMap((item, index) => retained.has(item.profileId) || allowed.has(item.profileId) ? [] : [index]);
    if (rejected.length > 0) throw unavailableProfilesError(rejected);
  }
  function find(ownerUserId: string, projectId: string) {
    return saved.find((item) => item.ownerUserId === ownerUserId && item.id === projectId);
  }
  return {
    saved,
    async list(ownerUserId, query) {
      const projects = saved.filter((item) => item.ownerUserId === ownerUserId && (query.status === "all" || item.status === query.status));
      return { projects, total: projects.length };
    },
    async findById(ownerUserId, projectId) {
      return find(ownerUserId, projectId) ?? null;
    },
    async create(ownerUserId, record, resourceIds, profiles) {
      const existing = saved.find((item) => item.ownerUserId === ownerUserId && item.clientRequestId === record.clientRequestId);
      if (existing) return { project: existing, created: false };
      assertAttachable(ownerUserId, resourceIds, new Set());
      assertProfiles(ownerUserId, profiles, new Set());
      const project: Stored = {
        ownerUserId, clientRequestId: record.clientRequestId, id: record.id, name: record.name, slug: record.slug,
        description: record.description, productType: record.productType, stage: record.stage, status: "active",
        platforms: record.platforms, priorities: record.priorities, rules: record.rules, recipe: null,
        profiles: profiles.map(profileSummary), resources: resourceIds.map(summary),
        createdAt: now, updatedAt: now,
      };
      saved.push(project);
      return { project, created: true };
    },
    async update(ownerUserId, projectId, patch, resourceIds, profiles) {
      const project = find(ownerUserId, projectId);
      if (!project) return null;
      Object.assign(project, patch);
      if (resourceIds !== undefined) {
        assertAttachable(ownerUserId, resourceIds, new Set(project.resources.map((item) => item.id)));
        project.resources = resourceIds.map((id) => project.resources.find((item) => item.id === id) ?? summary(id));
      }
      if (profiles !== undefined) {
        assertProfiles(ownerUserId, profiles, new Set(project.profiles.map((item) => item.id)));
        project.profiles = profiles.map(profileSummary);
      }
      return project;
    },
    async setStatus(ownerUserId, projectId, status) {
      const project = find(ownerUserId, projectId);
      if (!project) return null;
      project.status = status;
      return project;
    },
    async clone(ownerUserId, projectId, record) {
      const source = find(ownerUserId, projectId);
      if (!source) return null;
      const existing = saved.find((item) => item.ownerUserId === ownerUserId && item.clientRequestId === record.clientRequestId);
      if (existing) return { project: existing, created: false };
      const project: Stored = { ...source, id: record.id, slug: record.slug, clientRequestId: record.clientRequestId, name: record.name ?? `Copy of ${source.name}`, status: "active" };
      saved.push(project);
      return { project, created: true };
    },
  };
}

const listQuery: ProjectListQuery = { status: "active", limit: 50, offset: 0 };
const baseInput = { stage: "mvp" as const, platforms: ["web"], priorities: [], rules: [] };

describe("Projects domain", () => {
  it("creates stable slugs and normalizes repeated list values without rewriting them", () => {
    expect(slugifyProjectName("Atlas Finance — Şirket Paneli")).toBe("atlas-finance-sirket-paneli");
    expect(slugifyProjectName("???")).toBe("project");
    expect(normalizeStringList([" Web ", "web", "WEB", "Mobile", "", "  "])).toEqual(["Web", "Mobile"]);
    expect(normalizeProfiles([{ profileId: profileA, priority: 5 }, { profileId: profileA, priority: 1 }, { profileId: profileB, priority: 0 }]))
      .toEqual([{ profileId: profileA, priority: 5 }, { profileId: profileB, priority: 0 }]);
  });

  it("returns the same Project for a retried create instead of duplicating it", async () => {
    const repository = createRepository({ [ownerA]: [resourceA1] });
    const service = createProjectService(repository);
    const input = { ...baseInput, name: "Atlas Finance", clientRequestId: requestKey };
    const first = await service.create(ownerA, input);
    const retry = await service.create(ownerA, { ...input, name: "Atlas Finance (retry)" });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.project.id).toBe(first.project.id);
    expect(retry.project.name).toBe("Atlas Finance");
    expect(first.project.slug).toMatch(/^atlas-finance-[a-f0-9]{8}$/);
    expect(repository.saved).toHaveLength(1);

    const headerKey = "00000000-0000-4000-8000-000000000098";
    const viaHeader = await service.create(ownerA, { ...input, name: "Second" }, headerKey);
    expect(viaHeader.created).toBe(true);
    expect(repository.saved[1]?.clientRequestId).toBe(headerKey);
    const withoutKey = await service.create(ownerA, { ...baseInput, name: "Third" });
    expect(withoutKey.created).toBe(true);
    expect(repository.saved).toHaveLength(3);
  });

  it("normalizes the brief and attaches only the owner's active Resources and Profiles", async () => {
    const repository = createRepository({ [ownerA]: [resourceA1, resourceA2], [ownerB]: [resourceB1] }, { [ownerA]: [profileA] });
    const service = createProjectService(repository);
    const { project } = await service.create(ownerA, {
      ...baseInput, name: "Atlas Finance", description: "   ", productType: " SaaS ", stage: "production",
      platforms: [" web", "Web", "api"], priorities: ["Fast MVP", "fast mvp", "Maintainability"],
      rules: [" Prefer boring technology. ", "prefer boring technology."],
      resourceIds: [resourceA1, resourceA1, resourceA2],
      profiles: [{ profileId: profileA, priority: 3 }],
    });
    expect(project).toMatchObject({ description: null, productType: "SaaS", platforms: ["web", "api"], priorities: ["Fast MVP", "Maintainability"], rules: ["Prefer boring technology."] });
    expect(project.resources.map((item) => item.id)).toEqual([resourceA1, resourceA2]);
    expect(project.profiles).toEqual([expect.objectContaining({ id: profileA, priority: 3 })]);

    await expect(service.create(ownerA, { ...baseInput, name: "Leak", resourceIds: [resourceA1, resourceB1] }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceIds", "1"], code: "resource_unavailable" }] });
    await expect(service.create(ownerA, { ...baseInput, name: "Leak", profiles: [{ profileId: profileB, priority: 0 }] }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["profiles", "0", "profileId"], code: "profile_unavailable" }] });
    expect(repository.saved).toHaveLength(1);
  });

  it("replaces attachments only when provided and keeps owner boundaries", async () => {
    const repository = createRepository({ [ownerA]: [resourceA1, resourceA2] }, { [ownerA]: [profileA] });
    const service = createProjectService(repository);
    const { project } = await service.create(ownerA, { ...baseInput, name: "Atlas", resourceIds: [resourceA1] });

    const renamed = await service.update(ownerA, project.id, { name: "Atlas Finance", priorities: ["Speed", "speed"] });
    expect(renamed.resources.map((item) => item.id)).toEqual([resourceA1]);
    expect(renamed.priorities).toEqual(["Speed"]);
    const swapped = await service.update(ownerA, project.id, { resourceIds: [resourceA2] });
    expect(swapped.resources.map((item) => item.id)).toEqual([resourceA2]);
    const withProfile = await service.update(ownerA, project.id, { profiles: [{ profileId: profileA, priority: 2 }] });
    expect(withProfile.profiles.map((item) => item.id)).toEqual([profileA]);
    await expect(service.update(ownerA, project.id, { resourceIds: [resourceB1] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.update(ownerA, project.id, { profiles: [{ profileId: profileB, priority: 0 }] })).rejects.toMatchObject({ statusCode: 400 });

    await expect(service.get(ownerB, project.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.update(ownerB, project.id, { name: "Hijack" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.archive(ownerB, project.id)).rejects.toMatchObject({ statusCode: 404 });

    const cloneKey = "00000000-0000-4000-8000-000000000097";
    const clone = await service.clone(ownerA, project.id, {}, cloneKey);
    expect(clone).toMatchObject({ created: true, project: { name: "Copy of Atlas Finance", status: "active" } });
    expect(clone.project.slug).toMatch(/^copy-[a-f0-9]{8}$/);
    expect((await service.clone(ownerA, project.id, { name: "Other" }, cloneKey)).project.id).toBe(clone.project.id);
    expect((await service.clone(ownerA, project.id, { name: "  Beacon  " })).project.name).toBe("Beacon");
    await expect(service.clone(ownerB, project.id, {})).rejects.toMatchObject({ statusCode: 404 });
    expect((await service.archive(ownerA, project.id)).status).toBe("archived");
    expect((await service.list(ownerA, listQuery)).total).toBe(2);
    expect((await service.list(ownerA, { ...listQuery, status: "archived" })).total).toBe(1);
    expect((await service.restore(ownerA, project.id)).status).toBe("active");
    expect((await service.get(ownerA, project.id)).resources).toHaveLength(1);
  });
});
