import {
  profileListQuerySchema,
  type CatalogLibraryAddResult,
  type CatalogOverview,
  type CatalogPresetDecision,
  type CatalogStack,
  type CatalogStackLibraryResult,
  type CatalogStackProfileResult,
  type CatalogStackSummary,
  type CatalogTechnology,
  type CatalogTechnologyListQuery,
  type CatalogTechnologySummary,
  type CreateResourceInput,
  type Resource,
} from "@devcontext/contracts";
import {
  catalogVersion,
  getOverview,
  getStack,
  getTechnology,
  listStacks,
  listTechnologies,
  presetDecisionsForStack,
  technologiesForStack,
  unknownStackReferences,
} from "@devcontext/catalog";
import type { ProfileService } from "../profiles/service.js";
import type { ResourceService } from "../resources/service.js";

/**
 * Bridges the read-only technology catalog and the user's Library. Catalog
 * entries become ordinary Resources (with `metadata.catalogSlug` as the link)
 * so every existing rule, decision and export path applies unchanged.
 */
export interface CatalogService {
  overview(): CatalogOverview;
  listTechnologies(query: CatalogTechnologyListQuery): { technologies: CatalogTechnologySummary[]; total: number };
  getTechnology(slug: string): CatalogTechnology;
  listStacks(): CatalogStackSummary[];
  getStack(slug: string): CatalogStack;
  /** Catalog slug → active Resource id, for "already in your Library" states. */
  libraryLinks(ownerUserId: string): Promise<Record<string, string>>;
  /** Idempotent: an active copy is returned as is, an archived copy is restored, otherwise a Resource is created. */
  addTechnology(ownerUserId: string, slug: string): Promise<CatalogLibraryAddResult>;
  addStack(ownerUserId: string, slug: string): Promise<CatalogStackLibraryResult>;
  /** Adds the stack to the Library and creates a PREFERRED stack Profile from its preset slots. */
  createStackProfile(ownerUserId: string, slug: string): Promise<CatalogStackProfileResult>;
}

function notFoundError(kind: "technology" | "stack") {
  return Object.assign(new Error(`Catalog ${kind} not found`), {
    statusCode: 404,
    publicMessage: `This catalog ${kind} does not exist.`,
  });
}

function bullets(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

/** The Library Resource a catalog technology becomes; the notes keep the research text in its original language. */
export function toResourceInput(technology: CatalogTechnology): CreateResourceInput {
  const sections: string[] = [
    `Ne işe yarar: ${technology.whatFor}`,
    `Nerede kullanılır: ${technology.whereUsed}`,
    `Yaygın kullanım: ${technology.commonUse}`,
  ];
  if (technology.strengths.length > 0) sections.push(`Güçlü yönler:\n${bullets(technology.strengths)}`);
  if (technology.tradeoffs.length > 0) sections.push(`Ödünleşimler:\n${bullets(technology.tradeoffs)}`);
  if (technology.readiness) {
    const r = technology.readiness;
    sections.push([
      `AI ile geliştirme (editör değerlendirmesi, 1-5): uygunluk ${r.aiBuildability}/5, doküman ${r.docsQuality}/5, topluluk ${r.communitySupport}/5, token verimliliği ${r.tokenEfficiency}/5.`,
      r.aiPitfalls.length > 0 ? `Sık AI hataları:\n${bullets(r.aiPitfalls)}` : "",
      `Değerlendirme: ${r.verdict}`,
    ].filter(Boolean).join("\n"));
  }
  if (technology.velocity) {
    const v = technology.velocity;
    sections.push([
      `Hız (tahmin): prototip ${v.timeToPrototype}, üretime hazır ${v.timeToProductionReady}.`,
      v.productionGaps.length > 0 ? `Üretim boşlukları:\n${bullets(v.productionGaps)}` : "",
    ].filter(Boolean).join("\n"));
  }
  sections.push(`Lisans: ${technology.license} · Fiyatlandırma: ${technology.pricing}. Kaynak: DevContext teknoloji kataloğu ${catalogVersion} (${technology.slug}).`);
  const tags = [...new Set([...technology.tags, technology.domain].map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0 && tag.length <= 60))].slice(0, 30);
  return {
    name: technology.name,
    type: technology.type,
    description: technology.summary.slice(0, 2_000),
    sourceUrl: technology.docsUrl,
    docsUrl: technology.docsUrl,
    ...(technology.repoUrl ? { repoUrl: technology.repoUrl } : {}),
    ...(technology.installCommand ? { installCommand: technology.installCommand.slice(0, 1_000) } : {}),
    tags,
    notes: sections.join("\n\n").slice(0, 10_000),
    metadata: {
      catalogSlug: technology.slug,
      catalogVersion,
      catalogDomain: technology.domain,
      catalogCategory: technology.category,
      license: technology.license,
      pricing: technology.pricing,
      popularity: technology.popularity,
      maturity: technology.maturity,
      learningCurve: technology.learningCurve,
      aiBuildability: technology.aiBuildability,
    },
  };
}

function catalogSlugOf(resource: Resource) {
  const slug = resource.metadata.catalogSlug;
  return typeof slug === "string" ? slug : null;
}

export function createCatalogService(resources: ResourceService, profiles: ProfileService): CatalogService {
  async function addTechnology(ownerUserId: string, slug: string): Promise<CatalogLibraryAddResult> {
    const technology = getTechnology(slug);
    if (!technology) throw notFoundError("technology");
    const links = await resources.listCatalogLinks(ownerUserId);
    const active = links.find((link) => link.catalogSlug === slug && !link.archived);
    if (active) return { resource: await resources.get(ownerUserId, active.resourceId), created: false };
    const archived = links.find((link) => link.catalogSlug === slug);
    if (archived) return { resource: (await resources.restore(ownerUserId, archived.resourceId)).resource, created: false };
    return { resource: (await resources.create(ownerUserId, toResourceInput(technology))).resource, created: true };
  }

  async function addStack(ownerUserId: string, slug: string): Promise<CatalogStackLibraryResult> {
    const items = technologiesForStack(slug);
    if (!items) throw notFoundError("stack");
    const result: CatalogStackLibraryResult = { created: [], existing: [], skipped: unknownStackReferences(slug) };
    // Sequential on purpose: each step sees the links the previous one created.
    for (const item of items) {
      const added = await addTechnology(ownerUserId, item.slug);
      (added.created ? result.created : result.existing).push(added.resource);
    }
    return result;
  }

  return {
    overview: getOverview,
    listTechnologies(query) {
      const all = listTechnologies(query);
      return { technologies: all.slice(query.offset, query.offset + query.limit), total: all.length };
    },
    getTechnology(slug) {
      const technology = getTechnology(slug);
      if (!technology) throw notFoundError("technology");
      return technology;
    },
    listStacks,
    getStack(slug) {
      const stack = getStack(slug);
      if (!stack) throw notFoundError("stack");
      return stack;
    },
    async libraryLinks(ownerUserId) {
      const links = await resources.listCatalogLinks(ownerUserId);
      return Object.fromEntries(links.filter((link) => !link.archived).map((link) => [link.catalogSlug, link.resourceId]));
    },
    addTechnology,
    addStack,
    async createStackProfile(ownerUserId, slug) {
      const stack = getStack(slug);
      if (!stack) throw notFoundError("stack");
      const library = await addStack(ownerUserId, slug);
      const existing = (await profiles.list(ownerUserId, profileListQuerySchema.parse({ q: stack.name, type: "stack", limit: 100 }))).profiles
        .find((profile) => profile.name === stack.name);
      if (existing) return { profile: await profiles.get(ownerUserId, existing.id), created: false, decisions: [], library };
      const byCatalogSlug = new Map<string, Resource>();
      for (const resource of [...library.created, ...library.existing]) {
        const catalogSlug = catalogSlugOf(resource);
        if (catalogSlug) byCatalogSlug.set(catalogSlug, resource);
      }
      const profile = await profiles.create(ownerUserId, { name: stack.name, type: "stack", description: stack.summary.slice(0, 2_000) });
      const decisions: CatalogPresetDecision[] = [];
      for (const preset of presetDecisionsForStack(slug) ?? []) {
        const resource = byCatalogSlug.get(preset.technologySlug);
        if (!resource) continue;
        await profiles.upsertDecision(ownerUserId, profile.id, preset.slot, {
          mode: "PREFERRED",
          resourceId: resource.id,
          priority: 0,
          constraints: {},
          rationale: `From the "${stack.name}" preset in the technology catalog.`,
          conditions: {},
        });
        decisions.push({ slot: preset.slot, resourceId: resource.id, name: resource.name, technologySlug: preset.technologySlug });
      }
      return { profile: await profiles.get(ownerUserId, profile.id), created: true, decisions, library };
    },
  };
}
