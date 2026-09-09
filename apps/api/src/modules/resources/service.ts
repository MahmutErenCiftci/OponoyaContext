import type {
  CreateResourceInput,
  Resource,
  ResourceDuplicate,
  ResourceListQuery,
  ResourceWarning,
  UpdateResourceInput,
} from "@devcontext/contracts";
import { slugify } from "../../lib/slug.js";

export type ResourceMutationResult = {
  resource: Resource;
  warnings: ResourceWarning[];
  /** Evidence for the warnings: the other active Resources that matched. */
  duplicates: ResourceDuplicate[];
};

export type DuplicateCandidate = { id: string; name: string; type: Resource["type"]; sourceUrl: string | null };

/** A Resource created from the technology catalog, identified by `metadata.catalogSlug`. */
export type CatalogLink = { catalogSlug: string; resourceId: string; archived: boolean };

export interface ResourceRepository {
  list(ownerUserId: string, query: ResourceListQuery): Promise<{ resources: Resource[]; total: number }>;
  findById(ownerUserId: string, resourceId: string): Promise<Resource | null>;
  create(ownerUserId: string, resourceId: string, slug: string, input: CreateResourceInput): Promise<Resource>;
  update(ownerUserId: string, resourceId: string, input: UpdateResourceInput): Promise<Resource | null>;
  archive(ownerUserId: string, resourceId: string): Promise<Resource | null>;
  restore(ownerUserId: string, resourceId: string): Promise<Resource | null>;
  /** Active Resources of the owner other than `excludeResourceId`, used for duplicate detection. */
  listDuplicateCandidates(ownerUserId: string, excludeResourceId: string): Promise<DuplicateCandidate[]>;
  /** Active and archived Resources created from the technology catalog. */
  listCatalogLinks(ownerUserId: string): Promise<CatalogLink[]>;
}

function notFoundError() {
  return Object.assign(new Error("Resource not found"), { statusCode: 404 });
}

export function slugifyResourceName(name: string) {
  return slugify(name, "resource");
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

const trackingParameter = /^(utm_|ref$|fbclid$|gclid$|mc_cid$|mc_eid$)/i;

/**
 * Canonical form for duplicate detection: scheme, `www.`, trailing slashes,
 * fragments and tracking parameters are ignored; host and path are lower-cased.
 */
export function normalizeSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (trackingParameter.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    const query = url.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

/** Case-, punctuation- and whitespace-insensitive name key. */
export function normalizeResourceName(name: string) {
  return name.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function findDuplicates(
  resource: Pick<Resource, "name" | "type" | "sourceUrl">,
  candidates: DuplicateCandidate[],
): ResourceDuplicate[] {
  const url = normalizeSourceUrl(resource.sourceUrl);
  const name = normalizeResourceName(resource.name);
  return candidates.flatMap((candidate): ResourceDuplicate[] => {
    if (url && normalizeSourceUrl(candidate.sourceUrl) === url) return [{ ...candidate, reason: "url" }];
    if (candidate.type === resource.type && normalizeResourceName(candidate.name) === name) return [{ ...candidate, reason: "name" }];
    return [];
  });
}

export function warningsFor(duplicates: ResourceDuplicate[]): ResourceWarning[] {
  const warnings: ResourceWarning[] = [];
  if (duplicates.some((item) => item.reason === "url")) warnings.push("DUPLICATE_SOURCE_URL");
  if (duplicates.some((item) => item.reason === "name")) warnings.push("DUPLICATE_NAME");
  return warnings;
}

function normalizeCreateInput(input: CreateResourceInput): CreateResourceInput {
  return { ...input, tags: normalizeTags(input.tags) };
}

function normalizeUpdateInput(input: UpdateResourceInput): UpdateResourceInput {
  if (!input.tags) return input;
  return { ...input, tags: normalizeTags(input.tags) };
}

async function withDuplicates(repository: ResourceRepository, ownerUserId: string, resource: Resource): Promise<ResourceMutationResult> {
  const duplicates = findDuplicates(resource, await repository.listDuplicateCandidates(ownerUserId, resource.id));
  return { resource, warnings: warningsFor(duplicates), duplicates };
}

export interface ResourceService {
  list(ownerUserId: string, query: ResourceListQuery): Promise<{ resources: Resource[]; total: number }>;
  get(ownerUserId: string, resourceId: string): Promise<Resource>;
  create(ownerUserId: string, input: CreateResourceInput): Promise<ResourceMutationResult>;
  update(ownerUserId: string, resourceId: string, input: UpdateResourceInput): Promise<ResourceMutationResult>;
  archive(ownerUserId: string, resourceId: string): Promise<ResourceMutationResult>;
  restore(ownerUserId: string, resourceId: string): Promise<ResourceMutationResult>;
  listCatalogLinks(ownerUserId: string): Promise<CatalogLink[]>;
}

export function createResourceService(repository: ResourceRepository): ResourceService {
  return {
    list(ownerUserId, query) {
      return repository.list(ownerUserId, query);
    },
    async get(ownerUserId, resourceId) {
      const resource = await repository.findById(ownerUserId, resourceId);
      if (!resource) throw notFoundError();
      return resource;
    },
    async create(ownerUserId, input) {
      const id = crypto.randomUUID();
      const slug = `${slugifyResourceName(input.name)}-${id.slice(0, 8)}`;
      const resource = await repository.create(ownerUserId, id, slug, normalizeCreateInput(input));
      return withDuplicates(repository, ownerUserId, resource);
    },
    async update(ownerUserId, resourceId, input) {
      const resource = await repository.update(ownerUserId, resourceId, normalizeUpdateInput(input));
      if (!resource) throw notFoundError();
      return withDuplicates(repository, ownerUserId, resource);
    },
    async archive(ownerUserId, resourceId) {
      const resource = await repository.archive(ownerUserId, resourceId);
      if (!resource) throw notFoundError();
      return { resource, warnings: [], duplicates: [] };
    },
    async restore(ownerUserId, resourceId) {
      const resource = await repository.restore(ownerUserId, resourceId);
      if (!resource) throw notFoundError();
      return withDuplicates(repository, ownerUserId, resource);
    },
    listCatalogLinks(ownerUserId) {
      return repository.listCatalogLinks(ownerUserId);
    },
  };
}
