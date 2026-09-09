import type {
  CloneProjectInput,
  CreateProjectInput,
  Project,
  ProjectListQuery,
  ProjectProfileAttachment,
  ProjectStage,
  ProjectStatus,
  UpdateProjectInput,
} from "@devcontext/contracts";
import { slugify } from "../../lib/slug.js";

export type NewProjectRecord = {
  id: string;
  slug: string;
  clientRequestId: string;
  recipeId: string | null;
  name: string;
  description: string | null;
  productType: string | null;
  stage: ProjectStage;
  platforms: string[];
  priorities: string[];
  rules: string[];
};

export type ProjectPatch = Partial<Omit<NewProjectRecord, "id" | "slug" | "clientRequestId">>;

export type ProjectCreateResult = {
  project: Project;
  /** `false` when an earlier request with the same client request ID already created the Project. */
  created: boolean;
};

export interface ProjectRepository {
  list(ownerUserId: string, query: ProjectListQuery): Promise<{ projects: Project[]; total: number }>;
  findById(ownerUserId: string, projectId: string): Promise<Project | null>;
  /**
   * Inserts the Project, its Resource attachments and Profile attachments in one
   * transaction. Attachments must reference active same-owner Resources/Profiles;
   * otherwise the write is rolled back with `unavailableResourcesError` /
   * `unavailableProfilesError`. An applied Recipe must be active and owned
   * (`unavailableRecipeError`). A duplicate `clientRequestId` returns the
   * existing Project with `created: false`.
   */
  create(ownerUserId: string, record: NewProjectRecord, resourceIds: string[], profiles: ProjectProfileAttachment[]): Promise<ProjectCreateResult>;
  /**
   * `undefined` leaves an attachment set untouched. Otherwise the set is
   * replaced; already attached Resources/Profiles stay valid even if archived
   * later, while newly added IDs must be active and owned by `ownerUserId`.
   */
  update(
    ownerUserId: string,
    projectId: string,
    patch: ProjectPatch,
    resourceIds: string[] | undefined,
    profiles: ProjectProfileAttachment[] | undefined,
  ): Promise<Project | null>;
  setStatus(ownerUserId: string, projectId: string, status: ProjectStatus): Promise<Project | null>;
  /**
   * Copies brief, rules, Recipe reference, Resource attachments, Profile
   * attachments and Project decisions into a new active Project in one
   * transaction. `null` when the source is not the owner's; a repeated
   * `clientRequestId` returns the earlier clone with `created: false`.
   */
  clone(ownerUserId: string, projectId: string, record: { id: string; slug: string; clientRequestId: string; name: string | null }): Promise<ProjectCreateResult | null>;
}

function notFoundError() {
  return Object.assign(new Error("Project not found"), { statusCode: 404 });
}

/**
 * Missing, foreign and archived Resource IDs are reported identically so the
 * response does not reveal whether another user's Resource exists.
 */
export function unavailableResourcesError(indexes: number[]) {
  return Object.assign(new Error("Some resources cannot be attached"), {
    statusCode: 400,
    details: indexes.map((index) => ({ path: ["resourceIds", String(index)], code: "resource_unavailable" })),
  });
}

/** Same rule for Profiles: missing, foreign and archived attachments look alike. */
export function unavailableProfilesError(indexes: number[]) {
  return Object.assign(new Error("Some profiles cannot be attached"), {
    statusCode: 400,
    details: indexes.map((index) => ({ path: ["profiles", String(index), "profileId"], code: "profile_unavailable" })),
  });
}

/** And for the applied Recipe. */
export function unavailableRecipeError() {
  return Object.assign(new Error("The recipe cannot be applied"), {
    statusCode: 400,
    details: [{ path: ["recipeId"], code: "recipe_unavailable" }],
  });
}

/**
 * Trims entries, drops blanks and removes case-insensitive duplicates while
 * keeping the first spelling and the order the user typed.
 */
export function normalizeStringList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function normalizeResourceIds(values: string[]) {
  return [...new Set(values)];
}

/** Keeps the first priority given for a Profile and drops repeats. */
export function normalizeProfiles(values: ProjectProfileAttachment[]) {
  const seen = new Set<string>();
  const result: ProjectProfileAttachment[] = [];
  for (const value of values) {
    if (seen.has(value.profileId)) continue;
    seen.add(value.profileId);
    result.push({ profileId: value.profileId, priority: value.priority });
  }
  return result;
}

export function slugifyProjectName(name: string) {
  return slugify(name, "project");
}

function optionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.trim() || null;
}

export interface ProjectService {
  list(ownerUserId: string, query: ProjectListQuery): Promise<{ projects: Project[]; total: number }>;
  get(ownerUserId: string, projectId: string): Promise<Project>;
  create(ownerUserId: string, input: CreateProjectInput, idempotencyKey?: string): Promise<ProjectCreateResult>;
  update(ownerUserId: string, projectId: string, input: UpdateProjectInput): Promise<Project>;
  archive(ownerUserId: string, projectId: string): Promise<Project>;
  restore(ownerUserId: string, projectId: string): Promise<Project>;
  clone(ownerUserId: string, projectId: string, input: CloneProjectInput, idempotencyKey?: string): Promise<ProjectCreateResult>;
}

export function cloneName(sourceName: string, requested: string | undefined) {
  const name = requested?.trim() || `Copy of ${sourceName}`;
  return name.slice(0, 160);
}

export function createProjectService(repository: ProjectRepository): ProjectService {
  return {
    async clone(ownerUserId, projectId, input, idempotencyKey) {
      const id = crypto.randomUUID();
      const requested = input.name?.trim() || null;
      const result = await repository.clone(ownerUserId, projectId, {
        id,
        slug: `${slugifyProjectName(requested ?? "copy")}-${id.slice(0, 8)}`,
        clientRequestId: idempotencyKey ?? crypto.randomUUID(),
        name: requested,
      });
      if (!result) throw notFoundError();
      return result;
    },
    list(ownerUserId, query) {
      return repository.list(ownerUserId, query);
    },
    async get(ownerUserId, projectId) {
      const project = await repository.findById(ownerUserId, projectId);
      if (!project) throw notFoundError();
      return project;
    },
    create(ownerUserId, input, idempotencyKey) {
      const id = crypto.randomUUID();
      const record: NewProjectRecord = {
        id,
        slug: `${slugifyProjectName(input.name)}-${id.slice(0, 8)}`,
        clientRequestId: idempotencyKey ?? input.clientRequestId ?? crypto.randomUUID(),
        recipeId: input.recipeId ?? null,
        name: input.name,
        description: optionalText(input.description) ?? null,
        productType: optionalText(input.productType) ?? null,
        stage: input.stage,
        platforms: normalizeStringList(input.platforms),
        priorities: normalizeStringList(input.priorities),
        rules: normalizeStringList(input.rules ?? []),
      };
      return repository.create(
        ownerUserId,
        record,
        normalizeResourceIds(input.resourceIds ?? []),
        normalizeProfiles(input.profiles ?? []),
      );
    },
    async update(ownerUserId, projectId, input) {
      const patch: ProjectPatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = optionalText(input.description) ?? null;
      if (input.productType !== undefined) patch.productType = optionalText(input.productType) ?? null;
      if (input.stage !== undefined) patch.stage = input.stage;
      if (input.platforms !== undefined) patch.platforms = normalizeStringList(input.platforms);
      if (input.priorities !== undefined) patch.priorities = normalizeStringList(input.priorities);
      if (input.rules !== undefined) patch.rules = normalizeStringList(input.rules);
      if (input.recipeId !== undefined) patch.recipeId = input.recipeId;
      const resourceIds = input.resourceIds === undefined ? undefined : normalizeResourceIds(input.resourceIds);
      const profiles = input.profiles === undefined ? undefined : normalizeProfiles(input.profiles);
      const project = await repository.update(ownerUserId, projectId, patch, resourceIds, profiles);
      if (!project) throw notFoundError();
      return project;
    },
    async archive(ownerUserId, projectId) {
      const project = await repository.setStatus(ownerUserId, projectId, "archived");
      if (!project) throw notFoundError();
      return project;
    },
    async restore(ownerUserId, projectId) {
      const project = await repository.setStatus(ownerUserId, projectId, "active");
      if (!project) throw notFoundError();
      return project;
    },
  };
}
