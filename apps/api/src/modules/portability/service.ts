import {
  portableDocumentSchema,
  portableLimits,
  portableFormat,
  portableVersion,
  type CompatibilityKind,
  type DecisionMode,
  type GlobalPreferenceMode,
  type ImportAction,
  type ImportCounts,
  type ImportItem,
  type ImportRequest,
  type ImportStrategy,
  type ImportSummary,
  type PortableCompatibilityRule,
  type PortableDecision,
  type PortableDocument,
  type PortableProfile,
  type PortableProject,
  type PortableRecipe,
  type PortableResource,
  type ProfileType,
  type ResourceType,
} from "@devcontext/contracts";
import { slugify } from "../../lib/slug.js";
import { normalizeResourceName, normalizeSourceUrl } from "../resources/service.js";

// ---------------------------------------------------------------------------
// Rows the repository loads for export and for planning an import.
// ---------------------------------------------------------------------------

export type ExportDecisionRow = {
  slot: string;
  mode: DecisionMode;
  resourceId: string | null;
  priority: number;
  constraints: Record<string, unknown>;
  rationale: string | null;
  conditions: Record<string, unknown>;
};

export type WorkspaceRows = {
  resources: Array<{
    id: string; name: string; type: ResourceType; description: string | null; sourceUrl: string | null; docsUrl: string | null; repoUrl: string | null;
    installCommand: string | null; notes: string | null; metadata: Record<string, unknown>; favorite: boolean; archived: boolean; tags: string[];
    preference: { slot: string; mode: GlobalPreferenceMode } | null;
  }>;
  profiles: Array<{ id: string; name: string; type: ProfileType; description: string | null; archived: boolean; decisions: ExportDecisionRow[] }>;
  recipes: Array<{ id: string; name: string; description: string | null; archived: boolean; profiles: Array<{ profileId: string; priority: number }>; decisions: ExportDecisionRow[] }>;
  projects: Array<{
    id: string; name: string; description: string | null; productType: string | null; stage: string; status: string; platforms: string[]; priorities: string[]; rules: string[];
    recipeId: string | null; profiles: Array<{ profileId: string; priority: number }>; resourceIds: string[]; decisions: ExportDecisionRow[];
  }>;
  compatibilityRules: Array<{ id: string; kind: CompatibilityKind; leftResourceId: string; rightResourceId: string; note: string | null }>;
  globalDecisions: Array<{ slot: string; resourceId: string | null; mode: DecisionMode }>;
};

// ---------------------------------------------------------------------------
// Import plan: everything the repository needs to apply the document in one
// transaction, computed and validated before any write.
// ---------------------------------------------------------------------------

export type PlannedDecision = ExportDecisionRow;
export type PlannedResource = { ref: string; action: ImportAction; id: string; slug: string; name: string; input: PortableResource; preference: { slot: string; mode: GlobalPreferenceMode } | null };
export type PlannedProfile = { ref: string; action: ImportAction; id: string; slug: string; name: string; input: PortableProfile; decisions: PlannedDecision[] };
export type PlannedRecipe = { ref: string; action: ImportAction; id: string; slug: string; name: string; input: PortableRecipe; profiles: Array<{ profileId: string; priority: number }>; decisions: PlannedDecision[] };
export type PlannedProject = { ref: string; action: ImportAction; id: string; slug: string; name: string; input: PortableProject; recipeId: string | null; profiles: Array<{ profileId: string; priority: number }>; resourceIds: string[]; decisions: PlannedDecision[] };
export type PlannedRule = { action: "create" | "skip"; kind: CompatibilityKind; leftResourceId: string; rightResourceId: string; note: string | null };

export type ImportPlan = {
  resources: PlannedResource[];
  profiles: PlannedProfile[];
  recipes: PlannedRecipe[];
  projects: PlannedProject[];
  compatibilityRules: PlannedRule[];
  summary: ImportSummary;
};

export interface PortabilityRepository {
  loadWorkspace(ownerUserId: string): Promise<WorkspaceRows>;
  findImport(ownerUserId: string, requestId: string): Promise<ImportSummary | null>;
  /** Applies the plan in one transaction; `created: false` when `requestId` was already used (nothing written). */
  applyImport(ownerUserId: string, plan: ImportPlan, requestId: string | null): Promise<{ created: boolean }>;
}

export interface PortabilityService {
  exportWorkspace(ownerUserId: string): Promise<PortableDocument>;
  /** Validates, plans and (unless `dryRun`) applies the document. Replays a stored summary for a repeated key. */
  importWorkspace(ownerUserId: string, request: ImportRequest, idempotencyKey?: string): Promise<{ summary: ImportSummary; applied: boolean; created: boolean }>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type Detail = { path: string[]; code: string };

function validationError(details: Detail[], publicMessage?: string) {
  return Object.assign(new Error("Import document is invalid"), { statusCode: 400, details, ...(publicMessage ? { publicMessage } : {}) });
}

/**
 * Parses the document and checks every internal reference before anything is
 * written. Version problems get an explicit message so users know whether to
 * update the app or the file.
 */
export function validatePortableDocument(raw: unknown): PortableDocument {
  if (typeof raw !== "object" || raw === null) {
    throw validationError([{ path: ["document"], code: "invalid_type" }], "The import file must be a DevContext JSON document.");
  }
  // Iterative walk precedes Zod refinements/JSON.stringify so deep input cannot
  // overflow their stacks. The route also bounds bytes before JSON parsing.
  const pending: Array<{ value: unknown; depth: number; leaving?: boolean }> = [{ value: raw, depth: 0 }];
  const seen = new Set<object>();
  while (pending.length) {
    const { value, depth, leaving } = pending.pop()!;
    if (value === null || typeof value !== "object") continue;
    if (leaving) { seen.delete(value); continue; }
    if (depth > portableLimits.jsonDepth || seen.has(value)) {
      throw validationError([{ path: ["document"], code: "json_depth" }], "The import file is nested too deeply or contains circular references.");
    }
    seen.add(value);
    pending.push({ value, depth, leaving: true });
    for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
  }
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > portableLimits.documentBytes) {
    throw Object.assign(new Error("Portable document too large"), { statusCode: 413, publicMessage: "Portable files are limited to 32 MiB." });
  }
  const candidate = raw as { format?: unknown; version?: unknown };
  if (candidate.format !== portableFormat) {
    throw validationError([{ path: ["document", "format"], code: "unsupported_format" }], `The file is not a DevContext export (expected format "${portableFormat}").`);
  }
  if (typeof candidate.version === "number" && candidate.version > portableVersion) {
    throw validationError(
      [{ path: ["document", "version"], code: "unsupported_version" }],
      `This file uses DevContext export version ${candidate.version}, which is newer than this app supports (version ${portableVersion}). Update the app before importing it.`,
    );
  }
  const parsed = portableDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationError(parsed.error.issues.map((issue) => ({ path: ["document", ...issue.path.map(String)], code: issue.code })), "The import file has invalid fields; nothing was imported.");
  }
  const document = parsed.data;
  const details: Detail[] = [];
  const refs = { resources: new Set<string>(), profiles: new Set<string>(), recipes: new Set<string>() };
  const collect = (kind: keyof typeof refs, list: Array<{ ref: string }>) => {
    list.forEach((item, index) => {
      if (refs[kind].has(item.ref)) details.push({ path: ["document", kind, String(index), "ref"], code: "duplicate_ref" });
      refs[kind].add(item.ref);
    });
  };
  collect("resources", document.resources);
  collect("profiles", document.profiles);
  collect("recipes", document.recipes);
  const projectRefs = new Set<string>();
  document.projects.forEach((project, index) => {
    if (projectRefs.has(project.ref)) details.push({ path: ["document", "projects", String(index), "ref"], code: "duplicate_ref" });
    projectRefs.add(project.ref);
  });
  const checkDecisions = (path: string[], decisions: PortableDecision[]) => {
    const slots = new Set<string>();
    decisions.forEach((decision, index) => {
      const at = [...path, String(index)];
      if (slots.has(decision.slot)) details.push({ path: [...at, "slot"], code: "duplicate_slot" });
      slots.add(decision.slot);
      if (decision.mode === "AI_DECIDE" && decision.resourceRef) details.push({ path: [...at, "resourceRef"], code: "resource_not_allowed" });
      // A deleted resource leaves an unresolved decision. Preserve its mode and
      // rationale on round trip; the compiler already warns about missing resources.
      if (decision.resourceRef && !refs.resources.has(decision.resourceRef)) details.push({ path: [...at, "resourceRef"], code: "unknown_ref" });
    });
  };
  document.profiles.forEach((profile, index) => checkDecisions(["document", "profiles", String(index), "decisions"], profile.decisions));
  document.recipes.forEach((recipe, index) => {
    checkDecisions(["document", "recipes", String(index), "decisions"], recipe.decisions);
    recipe.profiles.forEach((attachment, position) => {
      if (!refs.profiles.has(attachment.profileRef)) details.push({ path: ["document", "recipes", String(index), "profiles", String(position), "profileRef"], code: "unknown_ref" });
    });
  });
  document.projects.forEach((project, index) => {
    checkDecisions(["document", "projects", String(index), "decisions"], project.decisions);
    if (project.recipeRef && !refs.recipes.has(project.recipeRef)) details.push({ path: ["document", "projects", String(index), "recipeRef"], code: "unknown_ref" });
    project.profiles.forEach((attachment, position) => {
      if (!refs.profiles.has(attachment.profileRef)) details.push({ path: ["document", "projects", String(index), "profiles", String(position), "profileRef"], code: "unknown_ref" });
    });
    project.resourceRefs.forEach((ref, position) => {
      if (!refs.resources.has(ref)) details.push({ path: ["document", "projects", String(index), "resourceRefs", String(position)], code: "unknown_ref" });
    });
  });
  document.compatibilityRules.forEach((rule, index) => {
    if (!refs.resources.has(rule.leftRef)) details.push({ path: ["document", "compatibilityRules", String(index), "leftRef"], code: "unknown_ref" });
    if (!refs.resources.has(rule.rightRef)) details.push({ path: ["document", "compatibilityRules", String(index), "rightRef"], code: "unknown_ref" });
    if (rule.leftRef === rule.rightRef) details.push({ path: ["document", "compatibilityRules", String(index), "rightRef"], code: "self_reference" });
  });
  if (details.length > 0) throw validationError(details.slice(0, 100), "The import file references items it does not contain; nothing was imported.");
  return document;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function toPortableDecision(row: ExportDecisionRow): PortableDecision {
  return { slot: row.slot, mode: row.mode, resourceRef: row.resourceId, priority: row.priority, constraints: row.constraints, rationale: row.rationale, conditions: row.conditions };
}

export function buildPortableDocument(rows: WorkspaceRows, exportedAt: Date): PortableDocument {
  const resourceIds = new Set(rows.resources.map((resource) => resource.id));
  const profileIds = new Set(rows.profiles.map((profile) => profile.id));
  const recipeIds = new Set(rows.recipes.map((recipe) => recipe.id));
  const ownDecision = (decision: ExportDecisionRow) => decision.resourceId === null || resourceIds.has(decision.resourceId);
  return {
    format: portableFormat,
    version: portableVersion,
    exportedAt: exportedAt.toISOString(),
    resources: rows.resources.map((resource) => ({
      ref: resource.id, name: resource.name, type: resource.type, description: resource.description, sourceUrl: resource.sourceUrl, docsUrl: resource.docsUrl,
      repoUrl: resource.repoUrl, installCommand: resource.installCommand, notes: resource.notes, metadata: resource.metadata, tags: resource.tags,
      favorite: resource.favorite, archived: resource.archived, preference: resource.preference,
    })),
    profiles: rows.profiles.map((profile) => ({
      ref: profile.id, name: profile.name, type: profile.type, description: profile.description, archived: profile.archived,
      decisions: profile.decisions.filter(ownDecision).map(toPortableDecision),
    })),
    recipes: rows.recipes.map((recipe) => ({
      ref: recipe.id, name: recipe.name, description: recipe.description, archived: recipe.archived,
      profiles: recipe.profiles.filter((item) => profileIds.has(item.profileId)).map((item) => ({ profileRef: item.profileId, priority: item.priority })),
      decisions: recipe.decisions.filter(ownDecision).map(toPortableDecision),
    })),
    projects: rows.projects.map((project) => ({
      ref: project.id, name: project.name, description: project.description, productType: project.productType,
      stage: project.stage as PortableProject["stage"], status: project.status as PortableProject["status"],
      platforms: project.platforms, priorities: project.priorities, rules: project.rules,
      recipeRef: project.recipeId && recipeIds.has(project.recipeId) ? project.recipeId : null,
      profiles: project.profiles.filter((item) => profileIds.has(item.profileId)).map((item) => ({ profileRef: item.profileId, priority: item.priority })),
      resourceRefs: project.resourceIds.filter((id) => resourceIds.has(id)),
      decisions: project.decisions.filter(ownDecision).map(toPortableDecision),
    })),
    compatibilityRules: rows.compatibilityRules
      .filter((rule) => resourceIds.has(rule.leftResourceId) && resourceIds.has(rule.rightResourceId))
      .map((rule) => ({ kind: rule.kind, leftRef: rule.leftResourceId, rightRef: rule.rightResourceId, note: rule.note })),
  };
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

function emptyCounts(): ImportCounts {
  return { create: 0, skip: 0, replace: 0, copy: 0 };
}

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

function resourceKeys(resource: { name: string; type: ResourceType; sourceUrl: string | null }) {
  const url = normalizeSourceUrl(resource.sourceUrl);
  return { url: url ? `url:${url}` : null, name: `name:${resource.type}:${normalizeResourceName(resource.name)}` };
}

function copyName(name: string) {
  return `${name} (imported)`.slice(0, 160);
}

function newId() {
  return crypto.randomUUID();
}

function slugFor(name: string, id: string, fallback: string) {
  return `${slugify(name, fallback)}-${id.slice(0, 8)}`;
}

/**
 * Decides, per entity, whether the document creates, skips, replaces or copies
 * against the owner's existing data. Pure: the same inputs always yield the
 * same plan, which is what the dry run shows and the confirmation applies.
 */
export function planImport(existing: WorkspaceRows, document: PortableDocument, strategy: ImportStrategy): ImportPlan {
  const items: ImportItem[] = [];
  const warnings: string[] = [];
  const counts = { resources: emptyCounts(), profiles: emptyCounts(), recipes: emptyCounts(), projects: emptyCounts(), compatibilityRules: emptyCounts() };
  const resolveAction = (matched: boolean): ImportAction => (!matched ? "create" : strategy === "skip" ? "skip" : strategy === "copy" ? "copy" : "replace");
  const note = (type: ImportItem["type"], ref: string, name: string, action: ImportAction, reason: string | null) => {
    items.push({ type, ref, name, action, reason });
    counts[type === "compatibilityRule" ? "compatibilityRules" : (`${type}s` as "resources" | "profiles" | "recipes" | "projects")][action] += 1;
  };

  // Resources: match on normalized source URL or name+type among the owner's active resources.
  const existingResources = new Map<string, string>();
  for (const resource of existing.resources) {
    if (resource.archived) continue;
    const keys = resourceKeys(resource);
    if (keys.url && !existingResources.has(keys.url)) existingResources.set(keys.url, resource.id);
    if (!existingResources.has(keys.name)) existingResources.set(keys.name, resource.id);
  }
  const slotOwner = new Map(existing.globalDecisions.flatMap((decision) => decision.resourceId ? [[decision.slot, decision.resourceId] as const] : []));
  const resourceRefs = new Map<string, string>();
  const plannedResources: PlannedResource[] = [];
  const seenInDocument = new Map<string, string>();
  for (const resource of document.resources) {
    const keys = resourceKeys(resource);
    const documentTwin = (keys.url && seenInDocument.get(keys.url)) || seenInDocument.get(keys.name);
    if (documentTwin) {
      resourceRefs.set(resource.ref, resourceRefs.get(documentTwin)!);
      note("resource", resource.ref, resource.name, "skip", `duplicate of "${documentTwin}" inside the file`);
      continue;
    }
    if (keys.url) seenInDocument.set(keys.url, resource.ref);
    seenInDocument.set(keys.name, resource.ref);
    const matchedId = (keys.url && existingResources.get(keys.url)) || existingResources.get(keys.name) || null;
    const action = resolveAction(matchedId !== null);
    const id = action === "skip" || action === "replace" ? matchedId! : newId();
    const name = action === "copy" ? copyName(resource.name) : resource.name;
    let preference = resource.preference;
    if (preference && action !== "skip") {
      const holder = slotOwner.get(preference.slot);
      if (holder && holder !== id) {
        if (strategy === "replace") {
          warnings.push(`Library rule for ${preference.slot} now points to "${name}" (it previously pointed to another resource).`);
        } else {
          warnings.push(`Kept your existing Library rule for ${preference.slot}; the imported rule on "${name}" was not applied.`);
          preference = null;
        }
      }
      if (preference) slotOwner.set(preference.slot, id);
    }
    resourceRefs.set(resource.ref, id);
    plannedResources.push({ ref: resource.ref, action, id, slug: slugFor(name, id, "resource"), name, input: resource, preference: action === "skip" ? null : preference });
    note("resource", resource.ref, name, action, matchedId ? "matches an existing resource" : null);
  }

  const mapDecisions = (decisions: PortableDecision[]): PlannedDecision[] => decisions.map((decision) => ({
    slot: decision.slot,
    mode: decision.mode,
    resourceId: decision.resourceRef ? resourceRefs.get(decision.resourceRef) ?? null : null,
    priority: decision.priority,
    constraints: decision.constraints,
    rationale: decision.rationale,
    conditions: decision.conditions,
  }));

  // Profiles: match on name + type among active profiles.
  const existingProfiles = new Map(existing.profiles.filter((profile) => !profile.archived).map((profile) => [`${nameKey(profile.name)}|${profile.type}`, profile.id]));
  const profileRefs = new Map<string, string>();
  const plannedProfiles: PlannedProfile[] = [];
  for (const profile of document.profiles) {
    const matchedId = existingProfiles.get(`${nameKey(profile.name)}|${profile.type}`) ?? null;
    const action = resolveAction(matchedId !== null);
    const id = action === "skip" || action === "replace" ? matchedId! : newId();
    const name = action === "copy" ? copyName(profile.name) : profile.name;
    profileRefs.set(profile.ref, id);
    plannedProfiles.push({ ref: profile.ref, action, id, slug: slugFor(name, id, "profile"), name, input: profile, decisions: mapDecisions(profile.decisions) });
    note("profile", profile.ref, name, action, matchedId ? "matches an existing profile" : null);
  }

  // Recipes: match on name among active recipes.
  const existingRecipes = new Map(existing.recipes.filter((recipe) => !recipe.archived).map((recipe) => [nameKey(recipe.name), recipe.id]));
  const recipeRefs = new Map<string, string>();
  const plannedRecipes: PlannedRecipe[] = [];
  for (const recipe of document.recipes) {
    const matchedId = existingRecipes.get(nameKey(recipe.name)) ?? null;
    const action = resolveAction(matchedId !== null);
    const id = action === "skip" || action === "replace" ? matchedId! : newId();
    const name = action === "copy" ? copyName(recipe.name) : recipe.name;
    recipeRefs.set(recipe.ref, id);
    plannedRecipes.push({
      ref: recipe.ref, action, id, slug: slugFor(name, id, "recipe"), name, input: recipe,
      profiles: recipe.profiles.flatMap((item) => { const profileId = profileRefs.get(item.profileRef); return profileId ? [{ profileId, priority: item.priority }] : []; }),
      decisions: mapDecisions(recipe.decisions),
    });
    note("recipe", recipe.ref, name, action, matchedId ? "matches an existing recipe" : null);
  }

  // Projects: match on name among active projects.
  const existingProjects = new Map(existing.projects.filter((project) => project.status === "active").map((project) => [nameKey(project.name), project.id]));
  const plannedProjects: PlannedProject[] = [];
  for (const project of document.projects) {
    const matchedId = existingProjects.get(nameKey(project.name)) ?? null;
    const action = resolveAction(matchedId !== null);
    const id = action === "skip" || action === "replace" ? matchedId! : newId();
    const name = action === "copy" ? copyName(project.name) : project.name;
    plannedProjects.push({
      ref: project.ref, action, id, slug: slugFor(name, id, "project"), name, input: project,
      recipeId: project.recipeRef ? recipeRefs.get(project.recipeRef) ?? null : null,
      profiles: project.profiles.flatMap((item) => { const profileId = profileRefs.get(item.profileRef); return profileId ? [{ profileId, priority: item.priority }] : []; }),
      resourceIds: [...new Set(project.resourceRefs.flatMap((ref) => resourceRefs.get(ref) ?? []))],
      decisions: mapDecisions(project.decisions),
    });
    note("project", project.ref, name, action, matchedId ? "matches an existing project" : null);
  }

  // Compatibility rules are keyed by (left, right, kind); duplicates are skipped, never replaced.
  const existingRules = new Set(existing.compatibilityRules.map((rule) => `${rule.leftResourceId}|${rule.rightResourceId}|${rule.kind}`));
  const plannedRules: PlannedRule[] = [];
  document.compatibilityRules.forEach((rule: PortableCompatibilityRule, index) => {
    const leftResourceId = resourceRefs.get(rule.leftRef)!;
    const rightResourceId = resourceRefs.get(rule.rightRef)!;
    const key = `${leftResourceId}|${rightResourceId}|${rule.kind}`;
    const action = existingRules.has(key) || leftResourceId === rightResourceId ? "skip" : "create";
    existingRules.add(key);
    plannedRules.push({ action, kind: rule.kind, leftResourceId, rightResourceId, note: rule.note });
    note("compatibilityRule", `rule-${index + 1}`, `${rule.leftRef} ${rule.kind} ${rule.rightRef}`, action, action === "skip" ? "already exists" : null);
  });

  return {
    resources: plannedResources,
    profiles: plannedProfiles,
    recipes: plannedRecipes,
    projects: plannedProjects,
    compatibilityRules: plannedRules,
    summary: { strategy, dryRun: true, counts, items, warnings },
  };
}

export function createPortabilityService(repository: PortabilityRepository, now: () => Date = () => new Date()): PortabilityService {
  return {
    async exportWorkspace(ownerUserId) {
      const document = buildPortableDocument(await repository.loadWorkspace(ownerUserId), now());
      try {
        return validatePortableDocument(document);
      } catch {
        throw Object.assign(new Error("Workspace exceeds portable format"), {
          statusCode: 409,
          publicMessage: "This workspace exceeds the portable format limits or contains unsupported data. No incomplete export was created. Contact support for a full data export.",
          details: [{ path: ["workspace"], code: "export_not_portable" }],
        });
      }
    },

    async importWorkspace(ownerUserId, request, idempotencyKey) {
      if (idempotencyKey && !request.dryRun) {
        const replay = await repository.findImport(ownerUserId, idempotencyKey);
        if (replay) return { summary: replay, applied: true, created: false };
      }
      const document = validatePortableDocument(request.document);
      const existing = await repository.loadWorkspace(ownerUserId);
      const plan = planImport(existing, document, request.strategy);
      if (request.dryRun) return { summary: plan.summary, applied: false, created: false };
      const summary: ImportSummary = { ...plan.summary, dryRun: false };
      const result = await repository.applyImport(ownerUserId, { ...plan, summary }, idempotencyKey ?? null);
      if (!result.created && idempotencyKey) {
        const stored = await repository.findImport(ownerUserId, idempotencyKey);
        return { summary: stored ?? summary, applied: true, created: false };
      }
      return { summary, applied: true, created: result.created };
    },
  };
}
