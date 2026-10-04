import { getTechnology, listTechnologies, slotsForTechnology } from "@devcontext/catalog";
import {
  resourceListQuerySchema,
  type CatalogPopularity,
  type CatalogSlotSuggestions,
  type CatalogStackLayer,
  type CatalogTechnologySummary,
  type SlotSuggestion,
  type SlotSuggestionReason,
} from "@devcontext/contracts";
import { and, countDistinct, eq, isNotNull, isNull, projectDecisions, projectResources, projects, resources, sql, type RepositoryDatabase } from "@devcontext/db";
import type { ResourceService } from "../resources/service.js";
import { catalogSlugByName, foldName } from "./service.js";

/**
 * Wizard picks per decision slot, without AI (an AI ranking can replace
 * `rankSlotSuggestions` after V2; the contract stays). Candidates are the
 * catalog technologies `slotsForTechnology` maps to the slot; the score adds:
 *
 * - used before: the user had it in the Library and archived it (+6)
 * - popular on Oponoya: how many users keep it, log-scaled (+2·log2(1+n)), counted only from three users up
 * - pairs with the Library: catalog `pairsWith` links to what the user owns (+1.5 each, two at most)
 * - catalog popularity: very common 4 … niche 1
 *
 * Technologies already in the Library are never suggested; they are listed
 * first in the wizard instead, ordered by how many projects used them.
 */
export const slotSuggestionLimit = 8;
/** "Popular on Oponoya" is only claimed once a few people keep the technology. */
const popularHereThreshold = 3;
const popularityPoints: Record<CatalogPopularity, number> = { "very-high": 4, high: 3, medium: 2, niche: 1 };

type Candidate = { summary: CatalogTechnologySummary; pairsWith: string[]; order: number };

/** The stack layer a technology belongs to when it is not part of a stack preset. */
function layerOf(item: CatalogTechnologySummary): CatalogStackLayer {
  if (item.domain === "frontend" || item.domain === "mobile-and-desktop") return "frontend";
  if (item.domain === "database") return "database";
  if (item.domain === "devops-and-services") return "infra";
  return "backend";
}

/** Categories that `slotsForTechnology` maps to a slot but that are add-ons or tooling, not a choice for it. */
const notAChoiceFor: Record<string, string[]> = {
  "database.primary": ["database/vector-extension", "search-engine"],
  "infra.deployment.primary": ["ci-cd", "iac"],
  "ai.coding.primary": ["ai/agent-framework", "ai/local-inference"],
  "frontend.framework": ["game/engine"],
};

/**
 * Suggestions are stricter than stack presets: ML and data-engineering tools
 * (PyTorch, Spark, Snowflake) only fill AI slots, never an app's framework or
 * database, and the add-on categories above are left out.
 */
function fitsSlot(summary: CatalogTechnologySummary, slot: string) {
  if ((summary.domain === "ai" || summary.domain === "data-engineering") && !slot.startsWith("ai.")) return false;
  return !(notAChoiceFor[slot] ?? []).some((category) => summary.category === category || summary.category.startsWith(`${category}/`));
}

let pairIndex: Map<string, Set<string>> | null = null;
/**
 * Catalog pairings in both directions: the research lists "Next.js pairs with
 * TypeScript" on one side only, but the fit holds both ways.
 */
function pairsOf(slug: string): ReadonlySet<string> {
  if (!pairIndex) {
    const index = new Map<string, Set<string>>();
    const link = (from: string, to: string) => index.set(from, (index.get(from) ?? new Set()).add(to));
    for (const summary of listTechnologies()) {
      for (const item of getTechnology(summary.slug)?.pairsWith ?? []) {
        if (!item.known || item.slug === summary.slug) continue;
        link(summary.slug, item.slug);
        link(item.slug, summary.slug);
      }
    }
    pairIndex = index;
  }
  return pairIndex.get(slug) ?? new Set();
}

let candidateIndex: Map<string, Candidate[]> | null = null;
/** Slot → catalog technologies that can fill it; built once, the catalog is static. */
function candidatesBySlot() {
  if (candidateIndex) return candidateIndex;
  const index = new Map<string, Candidate[]>();
  listTechnologies().forEach((summary, order) => {
    const pairsWith = [...pairsOf(summary.slug)].sort();
    for (const slot of slotsForTechnology(summary, layerOf(summary)).filter((slot) => fitsSlot(summary, slot))) {
      index.set(slot, [...(index.get(slot) ?? []), { summary, pairsWith, order }]);
    }
  });
  candidateIndex = index;
  return index;
}

export type SlotSuggestionInput = {
  /** Catalog slugs already in the Library (excluded). */
  active: ReadonlySet<string>;
  /** Catalog slugs the user archived from the Library. */
  previous: ReadonlySet<string>;
  /** Catalog slug → number of users who keep it in their Library. */
  adoption: ReadonlyMap<string, number>;
};

/** Pure ranking, unit-tested on its own. */
export function rankSlotSuggestions({ active, previous, adoption }: SlotSuggestionInput): Record<string, SlotSuggestion[]> {
  const pairedBy = new Map<string, number>();
  for (const slug of active) {
    for (const other of pairsOf(slug)) pairedBy.set(other, (pairedBy.get(other) ?? 0) + 1);
  }
  const result: Record<string, SlotSuggestion[]> = {};
  for (const [slot, candidates] of candidatesBySlot()) {
    result[slot] = candidates
      .filter(({ summary }) => !active.has(summary.slug))
      .map(({ summary, pairsWith, order }) => {
        // Below the threshold adoption counts as zero, so neither the reason nor the score hints that one or two other people keep it.
        const counted = adoption.get(summary.slug) ?? 0;
        const users = counted >= popularHereThreshold ? counted : 0;
        const pairs = Math.min(pairedBy.get(summary.slug) ?? 0, 2);
        const reasons: SlotSuggestionReason[] = [];
        if (previous.has(summary.slug)) reasons.push("used_before");
        if (users > 0) reasons.push("popular_here");
        if (pairs > 0) reasons.push("pairs_with");
        if (summary.popularity === "very-high" || summary.popularity === "high") reasons.push("widely_used");
        const score = popularityPoints[summary.popularity] + 2 * Math.log2(1 + users) + 1.5 * pairs + (previous.has(summary.slug) ? 6 : 0);
        return { suggestion: { slug: summary.slug, name: summary.name, type: summary.type, score: Math.round(score * 100) / 100, reasons, pairsWith }, order };
      })
      .sort((a, b) => b.suggestion.score - a.suggestion.score || a.order - b.order)
      .slice(0, slotSuggestionLimit)
      .map(({ suggestion }) => suggestion);
  }
  return result;
}

export interface CatalogUsageRepository {
  /** Catalog slug → number of users keeping it in their active Library: an aggregate across accounts, counts only. */
  adoption(): Promise<Map<string, number>>;
  /** Resource id → number of the owner's projects that attach it or decide it. */
  projectUsage(ownerUserId: string): Promise<Record<string, number>>;
}

/** Adoption changes slowly; one aggregate query per instance every few minutes is plenty. */
const adoptionTtlMs = 10 * 60_000;

export function createCatalogUsageRepository(database: RepositoryDatabase): CatalogUsageRepository {
  const { db } = database;
  let cached: { at: number; value: Map<string, number> } | null = null;

  return {
    async adoption() {
      if (cached && Date.now() - cached.at < adoptionTtlMs) return cached.value;
      const slug = sql<string>`${resources.metadata} ->> 'catalogSlug'`;
      const rows = await db
        .select({ slug, users: countDistinct(resources.ownerUserId) })
        .from(resources)
        .where(and(isNull(resources.archivedAt), sql`${resources.metadata} ->> 'catalogSlug' is not null`))
        .groupBy(slug);
      const value = new Map(rows.map((row) => [row.slug, row.users]));
      cached = { at: Date.now(), value };
      return value;
    },

    async projectUsage(ownerUserId) {
      const [attached, decided] = await Promise.all([
        db.select({ resourceId: projectResources.resourceId, projectId: projectResources.projectId })
          .from(projectResources)
          .innerJoin(projects, eq(projectResources.projectId, projects.id))
          .where(eq(projects.ownerUserId, ownerUserId)),
        db.select({ resourceId: projectDecisions.resourceId, projectId: projectDecisions.projectId })
          .from(projectDecisions)
          .innerJoin(projects, eq(projectDecisions.projectId, projects.id))
          .where(and(eq(projects.ownerUserId, ownerUserId), isNotNull(projectDecisions.resourceId))),
      ]);
      const byResource = new Map<string, Set<string>>();
      for (const row of [...attached, ...decided]) {
        if (!row.resourceId) continue;
        const set = byResource.get(row.resourceId) ?? new Set<string>();
        set.add(row.projectId);
        byResource.set(row.resourceId, set);
      }
      return Object.fromEntries([...byResource.entries()].map(([resourceId, set]) => [resourceId, set.size]));
    },
  };
}

export interface SlotSuggestionService {
  forOwner(ownerUserId: string): Promise<CatalogSlotSuggestions>;
}

export function createSlotSuggestionService(resourceService: ResourceService, usage: CatalogUsageRepository): SlotSuggestionService {
  return {
    async forOwner(ownerUserId) {
      const [links, library, adoption, projectUsage] = await Promise.all([
        resourceService.listCatalogLinks(ownerUserId),
        resourceService.list(ownerUserId, resourceListQuerySchema.parse({ limit: 100 })),
        usage.adoption(),
        usage.projectUsage(ownerUserId),
      ]);
      const active = new Set(links.filter((link) => !link.archived).map((link) => link.catalogSlug));
      // Resources saved by hand or from samples count as owned when their name is a catalog technology's name.
      for (const resource of library.resources) {
        const slug = catalogSlugByName().get(foldName(resource.name));
        if (slug) active.add(slug);
      }
      const previous = new Set(links.filter((link) => link.archived && !active.has(link.catalogSlug)).map((link) => link.catalogSlug));
      return { slots: rankSlotSuggestions({ active, previous, adoption }), usage: projectUsage };
    },
  };
}
