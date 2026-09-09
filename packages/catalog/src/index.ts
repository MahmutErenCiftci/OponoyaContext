import { z } from "zod";
import {
  catalogDomainSchema,
  catalogLevelSchema,
  catalogMaturitySchema,
  catalogPopularitySchema,
  catalogPricingSchema,
  catalogScoreSchema,
  catalogStackLayerSchema,
  catalogTeamSizeSchema,
  catalogTimeToMvpSchema,
  resourceTypeSchema,
  type CatalogDomain,
  type CatalogOverview,
  type CatalogReadiness,
  type CatalogReference,
  type CatalogStack,
  type CatalogStackLayer,
  type CatalogStackSummary,
  type CatalogTechnology,
  type CatalogTechnologyListQuery,
  type CatalogTechnologySummary,
  type CatalogVelocity,
} from "@devcontext/contracts";
import { catalogSource } from "./generated/data.js";

/**
 * Read-only technology catalog compiled from data/catalog. Everything is
 * validated once at module load, so a malformed data file fails the build and
 * the tests rather than a request. Scores are editor assessments; consumers
 * must present them with that label.
 */

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case slug");
const text = z.string().trim().min(1);

const rawTechnologySchema = z.object({
  slug: slugSchema,
  name: text,
  type: resourceTypeSchema,
  category: text,
  summary: text,
  whatFor: text,
  whereUsed: text,
  commonUse: text,
  strengths: z.array(text),
  tradeoffs: z.array(text),
  popularity: catalogPopularitySchema,
  maturity: catalogMaturitySchema,
  learningCurve: catalogLevelSchema,
  license: text,
  pricing: catalogPricingSchema,
  docsUrl: z.url(),
  // Optional in the research files; normalised to null so consumers see one shape.
  repoUrl: z.url().nullable().optional().transform((value) => value ?? null),
  installCommand: text.nullable().optional().transform((value) => value ?? null),
  alternatives: z.array(text),
  pairsWith: z.array(text),
  tags: z.array(text),
});
const rawTechnologyFileSchema = z.object({
  domain: catalogDomainSchema,
  note: z.string().optional(),
  items: z.array(rawTechnologySchema),
});
const rawStackSchema = z.object({
  slug: slugSchema,
  name: text,
  summary: text,
  layers: z.partialRecord(catalogStackLayerSchema, z.array(z.string())),
  bestFor: z.array(text),
  notFor: z.array(text),
  performance: text,
  scalability: text,
  cost: text,
  teamSize: catalogTeamSizeSchema,
  learningCurve: catalogLevelSchema,
  timeToMvp: catalogTimeToMvpSchema,
  aiFriendliness: text,
  usedBy: z.array(text),
  tags: z.array(text),
});
const rawStacksFileSchema = z.object({ domain: z.string(), items: z.array(rawStackSchema) });
const rawReadinessSchema = z.object({
  slug: slugSchema,
  docsQuality: catalogScoreSchema,
  adoption: text,
  communitySupport: catalogScoreSchema,
  // Null for AI tools themselves (an agent is not "built with" an agent).
  aiBuildability: catalogScoreSchema.nullable(),
  tokenEfficiency: catalogScoreSchema.nullable(),
  trainingDataDensity: text.nullable(),
  bestModels: z.array(text).nullable().transform((value) => value ?? []),
  aiPitfalls: z.array(text),
  verdict: text,
});
const rawReadinessFileSchema = z.object({
  domain: z.string(),
  methodology: z.object({
    updatedAt: z.string(),
    measured: z.array(z.string()),
    estimated: z.array(z.string()),
    warning: z.string(),
    scoreScale: z.record(z.string(), z.string()),
    fieldMeanings: z.record(z.string(), z.string()),
    liveMetricsPlan: z.record(z.string(), z.string()),
  }),
  globalFindings: z.record(z.string(), z.unknown()),
  items: z.array(rawReadinessSchema),
});
const rawVelocityStackSchema = z.object({
  slug: slugSchema,
  timeToPrototype: text,
  timeToMvp: text,
  timeToProductionReady: text,
  prototypeSpeed: catalogScoreSchema,
  productionReadiness: catalogScoreSchema,
  productionGaps: z.array(text),
  opsBurden: text,
  hiddenCosts: z.array(text),
  verdict: text,
});
const rawVelocityTechnologySchema = z.object({
  slug: slugSchema,
  timeToPrototype: text,
  timeToProductionReady: text,
  prototypeSpeed: catalogScoreSchema,
  productionReadiness: catalogScoreSchema,
  productionGaps: z.array(text),
  verdict: text,
});
const rawVelocityFileSchema = z.object({
  domain: z.string(),
  methodology: z.object({
    updatedAt: z.string(),
    status: z.string(),
    baseline: z.string(),
    definitions: z.record(z.string(), z.string()),
    criticalWarning: z.string(),
  }),
  stacks: z.array(rawVelocityStackSchema),
  technologies: z.array(rawVelocityTechnologySchema),
});

type RawTechnology = z.infer<typeof rawTechnologySchema> & { domain: CatalogDomain };
type RawStack = z.infer<typeof rawStackSchema>;

export const catalogDomainOrder: CatalogDomain[] = [
  "frontend",
  "backend",
  "database",
  "ai",
  "devops-and-services",
  "mobile-and-desktop",
  "data-engineering",
  "security",
  "turkey",
];

export const catalogDomainLabels: Record<CatalogDomain, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Data & storage",
  ai: "AI & agents",
  "devops-and-services": "DevOps & services",
  "mobile-and-desktop": "Mobile & desktop",
  "data-engineering": "Data engineering",
  security: "Security",
  turkey: "Türkiye",
};

export const stackLayerOrder: CatalogStackLayer[] = ["language", "frontend", "backend", "database", "infra"];

const files = z.record(z.string(), z.unknown()).parse(JSON.parse(catalogSource));
const technologyFiles = Object.entries(files)
  .filter(([name]) => name.startsWith("technologies."))
  .map(([, value]) => rawTechnologyFileSchema.parse(value));
const stacksFile = rawStacksFileSchema.parse(files["stacks"]);
const readinessFile = rawReadinessFileSchema.parse(files["ai-readiness"]);
const velocityFile = rawVelocityFileSchema.parse(files["velocity"]);

const domainNotes = new Map<CatalogDomain, string>();
const technologies: RawTechnology[] = [];
for (const domain of catalogDomainOrder) {
  for (const file of technologyFiles.filter((item) => item.domain === domain)) {
    if (file.note) domainNotes.set(domain, file.note);
    for (const item of file.items) technologies.push({ ...item, domain });
  }
}
const technologyBySlug = new Map(technologies.map((item) => [item.slug, item]));
if (technologyBySlug.size !== technologies.length) throw new Error("Catalog technology slugs must be unique");

const stacks: RawStack[] = stacksFile.items;
const stackBySlug = new Map(stacks.map((item) => [item.slug, item]));
if (stackBySlug.size !== stacks.length) throw new Error("Catalog stack slugs must be unique");

const readinessBySlug = new Map(readinessFile.items.map((item) => [item.slug, item]));
const stackVelocityBySlug = new Map(velocityFile.stacks.map((item) => [item.slug, item]));
const technologyVelocityBySlug = new Map(velocityFile.technologies.map((item) => [item.slug, item]));
for (const slug of [...readinessBySlug.keys(), ...technologyVelocityBySlug.keys()]) {
  if (!technologyBySlug.has(slug)) throw new Error(`Catalog assessment references unknown technology "${slug}"`);
}
for (const slug of stackVelocityBySlug.keys()) {
  if (!stackBySlug.has(slug)) throw new Error(`Catalog velocity references unknown stack "${slug}"`);
}

/** Version of the catalog data set (the assessment date). */
export const catalogVersion = readinessFile.methodology.updatedAt;

function fold(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function layerSlugs(stack: RawStack, layer: CatalogStackLayer): string[] {
  return (stack.layers[layer] ?? []).filter((slug) => slug !== "-" && slug.trim() !== "");
}

function knownStackSlugs(stack: RawStack): string[] {
  const seen = new Set<string>();
  for (const layer of stackLayerOrder) {
    for (const slug of layerSlugs(stack, layer)) if (technologyBySlug.has(slug)) seen.add(slug);
  }
  return [...seen];
}

const stacksByTechnology = new Map<string, RawStack[]>();
for (const stack of stacks) {
  for (const slug of knownStackSlugs(stack)) {
    const list = stacksByTechnology.get(slug) ?? [];
    list.push(stack);
    stacksByTechnology.set(slug, list);
  }
}

export function toReference(slug: string): CatalogReference {
  const known = technologyBySlug.get(slug);
  return { slug, name: known?.name ?? null, known: known !== undefined };
}

function toReadiness(slug: string): CatalogReadiness | null {
  const item = readinessBySlug.get(slug);
  if (!item) return null;
  return {
    docsQuality: item.docsQuality,
    adoption: item.adoption,
    communitySupport: item.communitySupport,
    aiBuildability: item.aiBuildability,
    tokenEfficiency: item.tokenEfficiency,
    trainingDataDensity: item.trainingDataDensity,
    bestModels: item.bestModels,
    aiPitfalls: item.aiPitfalls,
    verdict: item.verdict,
  };
}

function toTechnologyVelocity(slug: string): CatalogVelocity | null {
  const item = technologyVelocityBySlug.get(slug);
  if (!item) return null;
  return {
    timeToPrototype: item.timeToPrototype,
    timeToMvp: null,
    timeToProductionReady: item.timeToProductionReady,
    prototypeSpeed: item.prototypeSpeed,
    productionReadiness: item.productionReadiness,
    productionGaps: item.productionGaps,
    opsBurden: null,
    hiddenCosts: [],
    verdict: item.verdict,
  };
}

function toStackVelocity(slug: string): CatalogVelocity | null {
  const item = stackVelocityBySlug.get(slug);
  if (!item) return null;
  return {
    timeToPrototype: item.timeToPrototype,
    timeToMvp: item.timeToMvp,
    timeToProductionReady: item.timeToProductionReady,
    prototypeSpeed: item.prototypeSpeed,
    productionReadiness: item.productionReadiness,
    productionGaps: item.productionGaps,
    opsBurden: item.opsBurden,
    hiddenCosts: item.hiddenCosts,
    verdict: item.verdict,
  };
}

function toSummary(item: RawTechnology): CatalogTechnologySummary {
  return {
    slug: item.slug,
    name: item.name,
    type: item.type,
    domain: item.domain,
    category: item.category,
    summary: item.summary,
    popularity: item.popularity,
    maturity: item.maturity,
    learningCurve: item.learningCurve,
    pricing: item.pricing,
    license: item.license,
    tags: item.tags,
    aiBuildability: readinessBySlug.get(item.slug)?.aiBuildability ?? null,
  };
}

function toTechnology(item: RawTechnology): CatalogTechnology {
  return {
    ...toSummary(item),
    whatFor: item.whatFor,
    whereUsed: item.whereUsed,
    commonUse: item.commonUse,
    strengths: item.strengths,
    tradeoffs: item.tradeoffs,
    docsUrl: item.docsUrl,
    repoUrl: item.repoUrl,
    installCommand: item.installCommand,
    alternatives: item.alternatives.map(toReference),
    pairsWith: item.pairsWith.map(toReference),
    readiness: toReadiness(item.slug),
    velocity: toTechnologyVelocity(item.slug),
    stacks: (stacksByTechnology.get(item.slug) ?? []).map((stack) => ({ slug: stack.slug, name: stack.name })),
  };
}

function toStackSummary(stack: RawStack): CatalogStackSummary {
  const velocity = stackVelocityBySlug.get(stack.slug);
  return {
    slug: stack.slug,
    name: stack.name,
    summary: stack.summary,
    teamSize: stack.teamSize,
    learningCurve: stack.learningCurve,
    timeToMvp: stack.timeToMvp,
    tags: stack.tags,
    technologyCount: knownStackSlugs(stack).length,
    prototypeSpeed: velocity?.prototypeSpeed ?? null,
    productionReadiness: velocity?.productionReadiness ?? null,
    highlights: knownStackSlugs(stack).slice(0, 6).map(toReference),
  };
}

function toStack(stack: RawStack): CatalogStack {
  return {
    ...toStackSummary(stack),
    layers: stackLayerOrder
      .filter((layer) => layerSlugs(stack, layer).length > 0)
      .map((layer) => ({ layer, technologies: layerSlugs(stack, layer).map(toReference) })),
    bestFor: stack.bestFor,
    notFor: stack.notFor,
    performance: stack.performance,
    scalability: stack.scalability,
    cost: stack.cost,
    aiFriendliness: stack.aiFriendliness,
    usedBy: stack.usedBy,
    velocity: toStackVelocity(stack.slug),
  };
}

function matchesQuery(item: RawTechnology, query: string) {
  const haystack = fold([item.name, item.slug, item.summary, item.category, item.whatFor, item.tags.join(" ")].join(" "));
  return query.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/** Technologies in curated order (domain, then file order), optionally filtered. */
export function listTechnologies(query: Partial<Pick<CatalogTechnologyListQuery, "domain" | "type" | "q" | "tag">> = {}): CatalogTechnologySummary[] {
  const needle = query.q ? fold(query.q.trim()) : "";
  const tag = query.tag ? fold(query.tag) : "";
  return technologies
    .filter((item) => !query.domain || item.domain === query.domain)
    .filter((item) => !query.type || item.type === query.type)
    .filter((item) => !tag || item.tags.some((value) => fold(value) === tag))
    .filter((item) => !needle || matchesQuery(item, needle))
    .map(toSummary);
}

export function getTechnology(slug: string): CatalogTechnology | null {
  const item = technologyBySlug.get(slug);
  return item ? toTechnology(item) : null;
}

export function listStacks(): CatalogStackSummary[] {
  return stacks.map(toStackSummary);
}

export function getStack(slug: string): CatalogStack | null {
  const stack = stackBySlug.get(slug);
  return stack ? toStack(stack) : null;
}

/** Known technologies of a stack, unique, in layer order; null for an unknown stack. */
export function technologiesForStack(slug: string): CatalogTechnology[] | null {
  const stack = stackBySlug.get(slug);
  if (!stack) return null;
  return knownStackSlugs(stack).map((item) => toTechnology(technologyBySlug.get(item)!));
}

/** Layer slugs a stack lists that the catalog does not describe yet. */
export function unknownStackReferences(slug: string): string[] {
  const stack = stackBySlug.get(slug);
  if (!stack) return [];
  const seen = new Set<string>();
  for (const layer of stackLayerOrder) {
    for (const item of layerSlugs(stack, layer)) if (!technologyBySlug.has(item)) seen.add(item);
  }
  return [...seen];
}

/** Slugs referenced by `alternatives`/`pairsWith` that have no catalog entry: the expansion queue. */
export function pendingReferences(): Array<{ slug: string; referencedBy: string[] }> {
  const pending = new Map<string, Set<string>>();
  for (const item of technologies) {
    for (const ref of [...item.alternatives, ...item.pairsWith]) {
      if (technologyBySlug.has(ref)) continue;
      const set = pending.get(ref) ?? new Set<string>();
      set.add(item.slug);
      pending.set(ref, set);
    }
  }
  return [...pending.entries()]
    .map(([slug, referencedBy]) => ({ slug, referencedBy: [...referencedBy].sort() }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getOverview(): CatalogOverview {
  return {
    version: catalogVersion,
    technologyCount: technologies.length,
    stackCount: stacks.length,
    readinessCount: readinessBySlug.size,
    velocityCount: stackVelocityBySlug.size + technologyVelocityBySlug.size,
    pendingReferenceCount: pendingReferences().length,
    domains: catalogDomainOrder.map((domain) => ({
      id: domain,
      label: catalogDomainLabels[domain],
      count: technologies.filter((item) => item.domain === domain).length,
      note: domainNotes.get(domain) ?? null,
    })),
    methodology: {
      measured: readinessFile.methodology.measured,
      estimated: readinessFile.methodology.estimated,
      warning: readinessFile.methodology.warning,
      scoreScale: readinessFile.methodology.scoreScale,
      fieldMeanings: readinessFile.methodology.fieldMeanings,
      velocityStatus: velocityFile.methodology.status,
      velocityBaseline: velocityFile.methodology.baseline,
      velocityWarning: velocityFile.methodology.criticalWarning,
    },
  };
}

export type PresetDecision = { slot: string; technologySlug: string; layer: CatalogStackLayer };

/**
 * Decision slots a technology can fill when a stack preset becomes a Profile.
 * Languages can fill both language slots; everything else fills the first
 * free slot in the returned order. Technologies with no slot (styling,
 * state management, CI, payments…) still go to the Library.
 */
export function slotsForTechnology(item: Pick<CatalogTechnology, "slug" | "type" | "category">, layer: CatalogStackLayer): string[] {
  const { type, category, slug } = item;
  if (type === "language" || category === "language") {
    if (slug === "typescript" || slug === "javascript") return ["frontend.language", "backend.language"];
    return layer === "frontend" ? ["frontend.language"] : ["backend.language"];
  }
  if (type === "ai_coding_tool") return ["ai.coding.primary"];
  if (type === "ai_builder") return ["ai.builder.primary"];
  if (type === "mcp") return ["ai.mcp.default"];
  if (type === "prompt") return ["ai.prompt.default"];
  if (type === "auth") return ["auth.provider"];
  if (type === "orm") return ["database.query_layer"];
  if (type === "cache") return ["database.cache"];
  if (type === "queue") return ["backend.queue"];
  if (type === "storage") return ["storage.object"];
  if (type === "monitoring" || category.startsWith("observability/")) return ["infra.monitoring.primary"];
  if (type === "deployment" || category.startsWith("hosting/") || category.startsWith("cloud/")) return ["infra.deployment.primary"];
  if (category.startsWith("email/")) return ["email.provider"];
  if (type === "database" || category.startsWith("baas/")) return ["database.primary"];
  if (type === "icon_library") return ["frontend.icons"];
  if (type === "animation") return ["frontend.animation.default"];
  if (type === "design_system") return ["frontend.design_system"];
  if (type === "theme") return ["frontend.theme.default"];
  if (category.startsWith("backend/api")) return ["backend.api_style"];
  if (type === "architecture") return ["backend.architecture"];
  if (category.startsWith("styling")) return [];
  if (type === "ui_library" || category.startsWith("ui/")) return ["frontend.ui.base"];
  if (type === "framework") return layer === "backend" || category.startsWith("backend/") ? ["backend.framework"] : ["frontend.framework"];
  if (type === "cli") return ["tooling.cli"];
  return [];
}

/** PREFERRED decisions a stack preset contributes, one technology per slot; null for an unknown stack. */
export function presetDecisionsForStack(slug: string): PresetDecision[] | null {
  const stack = stackBySlug.get(slug);
  if (!stack) return null;
  const taken = new Set<string>();
  const decisions: PresetDecision[] = [];
  for (const layer of stackLayerOrder) {
    for (const technologySlug of layerSlugs(stack, layer)) {
      const item = technologyBySlug.get(technologySlug);
      if (!item) continue;
      const candidates = slotsForTechnology(item, layer);
      const language = item.type === "language" || item.category === "language";
      for (const slot of candidates) {
        if (taken.has(slot)) continue;
        taken.add(slot);
        decisions.push({ slot, technologySlug, layer });
        if (!language) break;
      }
    }
  }
  return decisions;
}
