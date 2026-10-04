import {
  productName,
  profileListQuerySchema,
  resourceListQuerySchema,
  type CatalogLibraryAddResult,
  type CatalogOverview,
  type CatalogPresetDecision,
  type CatalogReference,
  type CatalogStack,
  type CatalogStackLibraryResult,
  type CatalogStackProfileResult,
  type CatalogStackSummary,
  type CatalogSuggestions,
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
import type { CatalogLink, ResourceService } from "../resources/service.js";

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
  /** Read-only picks for the overview, derived from the Library's catalog technologies. */
  suggestions(ownerUserId: string): Promise<CatalogSuggestions>;
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
  sections.push(`Lisans: ${technology.license} · Fiyatlandırma: ${technology.pricing}. Kaynak: ${productName} teknoloji kataloğu ${catalogVersion} (${technology.slug}).`);
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

const suggestionLimits = { technologies: 10, stacks: 4, because: 2 };

/** "Sample · Next.js" and "nextjs" both fold to "nextjs". */
export function foldName(name: string) {
  return name.replace(/^sample\s*·\s*/i, "").normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

let nameIndex: Map<string, string> | null = null;
/** Folded catalog technology name (and slug) → slug; built once, the catalog is static. */
export function catalogSlugByName() {
  nameIndex ??= new Map(listTechnologies().flatMap((item) => [[foldName(item.name), item.slug], [foldName(item.slug), item.slug]] as const));
  return nameIndex;
}

/**
 * Deterministic overview picks. A technology that pairs with something in the
 * Library outranks an alternative to it; ties keep the catalog's curated order.
 * Stacks rank by how many of their known technologies the Library already
 * holds; an empty Library gets the first curated stacks as starters.
 */
export function suggestFromLibrary(owned: ReadonlySet<string>): CatalogSuggestions {
  const summaries = listTechnologies();
  const order = new Map(summaries.map((item, index) => [item.slug, index]));
  const candidates = new Map<string, { score: number; reason: "pairs_with" | "alternative"; because: CatalogReference[] }>();
  function consider(reference: CatalogReference, from: CatalogReference, reason: "pairs_with" | "alternative") {
    if (!reference.known || owned.has(reference.slug)) return;
    const candidate = candidates.get(reference.slug) ?? { score: 0, reason, because: [] };
    candidate.score += reason === "pairs_with" ? 2 : 1;
    if (reason === "pairs_with") candidate.reason = reason;
    if (!candidate.because.some((item) => item.slug === from.slug)) candidate.because.push(from);
    candidates.set(reference.slug, candidate);
  }
  for (const slug of owned) {
    const technology = getTechnology(slug);
    if (!technology) continue;
    const from: CatalogReference = { slug, name: technology.name, known: true };
    for (const reference of technology.pairsWith) consider(reference, from, "pairs_with");
    for (const reference of technology.alternatives) consider(reference, from, "alternative");
  }
  const bySlug = new Map(summaries.map((item) => [item.slug, item]));
  const technologies = [...candidates.entries()]
    .sort(([a, left], [b, right]) => right.score - left.score || (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .slice(0, suggestionLimits.technologies)
    .flatMap(([slug, candidate]) => {
      const technology = bySlug.get(slug);
      return technology ? [{ technology, reason: candidate.reason, because: candidate.because.slice(0, suggestionLimits.because) }] : [];
    });

  const stacks = listStacks().map((stack, index) => {
    const known = new Set(getStack(stack.slug)?.layers.flatMap((layer) => layer.technologies).filter((item) => item.known).map((item) => item.slug) ?? []);
    const matched = [...known].filter((slug) => owned.has(slug)).length;
    return { stack, matched, complete: known.size > 0 && matched === known.size, index };
  });
  const ranked = owned.size === 0
    ? stacks
    : stacks.filter((item) => item.matched > 0 && !item.complete).sort((a, b) => b.matched - a.matched || a.index - b.index);
  return {
    technologies,
    stacks: ranked.slice(0, suggestionLimits.stacks).map(({ stack, matched }) => ({ stack, matched })),
  };
}

function catalogSlugOf(resource: Resource) {
  const slug = resource.metadata.catalogSlug;
  return typeof slug === "string" ? slug : null;
}

/** Library services bound to one database transaction. */
export type CatalogScope = { resources: ResourceService; profiles: ProfileService };

/**
 * Runs `work` in one transaction that also serializes the owner's catalog
 * writes, so a stack is added completely or not at all and two concurrent
 * clicks cannot create the same technology twice.
 */
export type CatalogTransaction = <T>(ownerUserId: string, work: (scope: CatalogScope) => Promise<T>) => Promise<T>;

export function createCatalogService(resources: ResourceService, profiles: ProfileService, transaction?: CatalogTransaction): CatalogService {
  const run: CatalogTransaction = transaction ?? ((_ownerUserId, work) => work({ resources, profiles }));

  /** `links` is the owner's catalog links, updated in place so later steps in the same operation see earlier ones. */
  async function addWith(scope: CatalogScope, ownerUserId: string, slug: string, links: CatalogLink[]): Promise<CatalogLibraryAddResult> {
    const technology = getTechnology(slug);
    if (!technology) throw notFoundError("technology");
    const active = links.find((link) => link.catalogSlug === slug && !link.archived);
    if (active) return { resource: await scope.resources.get(ownerUserId, active.resourceId), created: false };
    const archived = links.find((link) => link.catalogSlug === slug);
    if (archived) {
      const restored = (await scope.resources.restore(ownerUserId, archived.resourceId)).resource;
      archived.archived = false;
      return { resource: restored, created: false };
    }
    const created = (await scope.resources.create(ownerUserId, toResourceInput(technology))).resource;
    links.push({ catalogSlug: slug, resourceId: created.id, archived: false });
    return { resource: created, created: true };
  }

  async function addStackWith(scope: CatalogScope, ownerUserId: string, slug: string): Promise<CatalogStackLibraryResult> {
    const items = technologiesForStack(slug);
    if (!items) throw notFoundError("stack");
    const result: CatalogStackLibraryResult = { created: [], existing: [], skipped: unknownStackReferences(slug) };
    // One link lookup for the whole stack; sequential because every step shares the transaction.
    const links = await scope.resources.listCatalogLinks(ownerUserId);
    for (const item of items) {
      const added = await addWith(scope, ownerUserId, item.slug, links);
      (added.created ? result.created : result.existing).push(added.resource);
    }
    return result;
  }

  async function addTechnology(ownerUserId: string, slug: string): Promise<CatalogLibraryAddResult> {
    if (!getTechnology(slug)) throw notFoundError("technology");
    return run(ownerUserId, async (scope) => addWith(scope, ownerUserId, slug, await scope.resources.listCatalogLinks(ownerUserId)));
  }

  function addStack(ownerUserId: string, slug: string): Promise<CatalogStackLibraryResult> {
    if (!technologiesForStack(slug)) throw notFoundError("stack");
    return run(ownerUserId, (scope) => addStackWith(scope, ownerUserId, slug));
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
    async suggestions(ownerUserId) {
      const [links, library] = await Promise.all([
        resources.listCatalogLinks(ownerUserId),
        resources.list(ownerUserId, resourceListQuerySchema.parse({ limit: 100 })),
      ]);
      const owned = new Set(links.filter((link) => !link.archived).map((link) => link.catalogSlug));
      // Resources saved by hand or from samples count too when their name is a catalog technology's name.
      for (const resource of library.resources) {
        const slug = catalogSlugByName().get(foldName(resource.name));
        if (slug) owned.add(slug);
      }
      return suggestFromLibrary(owned);
    },
    addTechnology,
    addStack,
    async createStackProfile(ownerUserId, slug) {
      const stack = getStack(slug);
      if (!stack) throw notFoundError("stack");
      // Library additions, the Profile and its decisions commit together: a failure leaves nothing half-built.
      return run(ownerUserId, async (scope) => {
        const library = await addStackWith(scope, ownerUserId, slug);
        const existing = (await scope.profiles.list(ownerUserId, profileListQuerySchema.parse({ q: stack.name, type: "stack", limit: 100 }))).profiles
          .find((profile) => profile.name === stack.name);
        if (existing) return { profile: await scope.profiles.get(ownerUserId, existing.id), created: false, decisions: [], library };
        const byCatalogSlug = new Map<string, Resource>();
        for (const resource of [...library.created, ...library.existing]) {
          const catalogSlug = catalogSlugOf(resource);
          if (catalogSlug) byCatalogSlug.set(catalogSlug, resource);
        }
        const profile = await scope.profiles.create(ownerUserId, { name: stack.name, type: "stack", description: stack.summary.slice(0, 2_000) });
        const decisions: CatalogPresetDecision[] = [];
        for (const preset of presetDecisionsForStack(slug) ?? []) {
          const resource = byCatalogSlug.get(preset.technologySlug);
          if (!resource) continue;
          await scope.profiles.upsertDecision(ownerUserId, profile.id, preset.slot, {
            mode: "PREFERRED",
            resourceId: resource.id,
            priority: 0,
            constraints: {},
            rationale: `From the "${stack.name}" preset in the technology catalog.`,
            conditions: {},
          });
          decisions.push({ slot: preset.slot, resourceId: resource.id, name: resource.name, technologySlug: preset.technologySlug });
        }
        return { profile: await scope.profiles.get(ownerUserId, profile.id), created: true, decisions, library };
      });
    },
  };
}
