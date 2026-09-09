import type {
  BatchProjectDecisionsInput,
  DecisionMode,
  DecisionRecord,
  ProjectDecisionView,
  UpsertProjectDecisionInput,
} from "@devcontext/contracts";

export type DecisionValues = {
  mode: DecisionMode;
  resourceId: string | null;
  priority: number;
  constraints: Record<string, unknown>;
  rationale: string | null;
  conditions: Record<string, unknown>;
};

export type BatchDecisionUpsert = { slot: string; values: DecisionValues };

export interface DecisionRepository {
  projectExists(ownerUserId: string, projectId: string): Promise<boolean>;
  listProjectDecisions(ownerUserId: string, projectId: string): Promise<DecisionRecord[]>;
  /** Decisions of the Project's applied Recipe, with the Recipe as `origin`. */
  listRecipeDecisions(ownerUserId: string, projectId: string): Promise<DecisionRecord[]>;
  /**
   * Decisions contributed by every Profile attached to the Project directly or
   * through its Recipe, with the attachment as `origin`.
   */
  listProfileDecisions(ownerUserId: string, projectId: string): Promise<DecisionRecord[]>;
  listGlobalDecisions(ownerUserId: string): Promise<DecisionRecord[]>;
  /**
   * Inserts or replaces the Project decision for `slot` in one transaction. A
   * Resource must be active and owned by `ownerUserId`; otherwise the write is
   * rolled back with `resourceUnavailableError`. Returns `null` when the
   * Project does not belong to the owner.
   */
  upsertProjectDecision(ownerUserId: string, projectId: string, slot: string, values: DecisionValues): Promise<DecisionRecord | null>;
  /** Removes only the Project override; inherited rules are never touched. */
  deleteProjectDecision(ownerUserId: string, projectId: string, slot: string): Promise<boolean>;
  /**
   * Applies many upserts and removals in one transaction. Resource failures
   * report the position inside `upserts`. Returns `false` for a foreign Project.
   */
  batchProjectDecisions(ownerUserId: string, projectId: string, upserts: BatchDecisionUpsert[], removeSlots: string[]): Promise<boolean>;
}

function notFoundError() {
  return Object.assign(new Error("Project not found"), { statusCode: 404 });
}

function decisionError(code: string, path: string[] = ["resourceId"]) {
  return Object.assign(new Error("Decision is invalid"), {
    statusCode: 400,
    details: [{ path, code }],
  });
}

/** Missing, foreign and archived Resources are reported identically. */
export function resourceUnavailableError(index?: number) {
  return decisionError("resource_unavailable", index === undefined ? undefined : ["decisions", String(index), "resourceId"]);
}

export function resourceRequiredError(index?: number) {
  return decisionError("resource_required", index === undefined ? undefined : ["decisions", String(index), "resourceId"]);
}

export function resourceNotAllowedError(index?: number) {
  return decisionError("resource_not_allowed", index === undefined ? undefined : ["decisions", String(index), "resourceId"]);
}

/**
 * `AI_DECIDE` is a deliberate delegation and never names a Resource. Every other
 * mode describes a technology and therefore needs one.
 */
export function normalizeDecisionInput(input: UpsertProjectDecisionInput, index?: number): DecisionValues {
  if (input.mode === "AI_DECIDE" && input.resourceId) throw resourceNotAllowedError(index);
  if (input.mode !== "AI_DECIDE" && !input.resourceId) throw resourceRequiredError(index);
  return {
    mode: input.mode,
    resourceId: input.resourceId,
    priority: input.priority,
    constraints: input.constraints,
    rationale: input.rationale?.trim() || null,
    conditions: input.conditions,
  };
}

/** Higher Profile attachment priority wins, then decision priority, then newest revision, then id. */
export function rankProfileDecisions(a: DecisionRecord, b: DecisionRecord) {
  const attachment = (b.origin?.priority ?? 0) - (a.origin?.priority ?? 0);
  if (attachment !== 0) return attachment;
  const priority = b.priority - a.priority;
  if (priority !== 0) return priority;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Builds the per-slot view with precedence Project > Recipe > Profile > Global.
 * Nothing is deleted: an override shadows the layers below it, which stay
 * visible so every effective choice explains its source. Output is sorted by
 * slot.
 */
export function mergeDecisions(
  projectDecisions: DecisionRecord[],
  recipeDecisions: DecisionRecord[],
  profileDecisions: DecisionRecord[],
  globalDecisions: DecisionRecord[],
): ProjectDecisionView[] {
  const bySlot = new Map<string, { project: DecisionRecord | null; recipe: DecisionRecord | null; profiles: DecisionRecord[]; global: DecisionRecord | null }>();
  const entry = (slot: string) => {
    const current = bySlot.get(slot) ?? { project: null, recipe: null, profiles: [], global: null };
    bySlot.set(slot, current);
    return current;
  };
  for (const decision of globalDecisions) entry(decision.slot).global = decision;
  for (const decision of profileDecisions) entry(decision.slot).profiles.push(decision);
  for (const decision of recipeDecisions) entry(decision.slot).recipe = decision;
  for (const decision of projectDecisions) entry(decision.slot).project = decision;
  return [...bySlot.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([slot, { project, recipe, profiles, global }]) => {
      const sortedProfiles = [...profiles].sort(rankProfileDecisions);
      const profile = sortedProfiles[0] ?? null;
      const effective = project ?? recipe ?? profile ?? global;
      return {
        slot,
        source: project ? "project" : recipe ? "recipe" : profile ? "profile" : "global",
        effective: effective!,
        project,
        recipe,
        profile,
        profiles: sortedProfiles,
        global,
      };
    });
}

export interface DecisionService {
  list(ownerUserId: string, projectId: string): Promise<ProjectDecisionView[]>;
  listGlobal(ownerUserId: string): Promise<DecisionRecord[]>;
  upsert(ownerUserId: string, projectId: string, slot: string, input: UpsertProjectDecisionInput): Promise<ProjectDecisionView>;
  remove(ownerUserId: string, projectId: string, slot: string): Promise<ProjectDecisionView | null>;
  batch(ownerUserId: string, projectId: string, input: BatchProjectDecisionsInput): Promise<ProjectDecisionView[]>;
}

export function createDecisionService(repository: DecisionRepository): DecisionService {
  async function ensureProject(ownerUserId: string, projectId: string) {
    if (!(await repository.projectExists(ownerUserId, projectId))) throw notFoundError();
  }

  async function listViews(ownerUserId: string, projectId: string) {
    const [projectDecisions, recipeDecisions, profileDecisions, globalDecisions] = await Promise.all([
      repository.listProjectDecisions(ownerUserId, projectId),
      repository.listRecipeDecisions(ownerUserId, projectId),
      repository.listProfileDecisions(ownerUserId, projectId),
      repository.listGlobalDecisions(ownerUserId),
    ]);
    return mergeDecisions(projectDecisions, recipeDecisions, profileDecisions, globalDecisions);
  }

  async function viewFor(ownerUserId: string, projectId: string, slot: string) {
    return (await listViews(ownerUserId, projectId)).find((view) => view.slot === slot) ?? null;
  }

  return {
    async list(ownerUserId, projectId) {
      await ensureProject(ownerUserId, projectId);
      return listViews(ownerUserId, projectId);
    },
    listGlobal(ownerUserId) {
      return repository.listGlobalDecisions(ownerUserId);
    },
    async upsert(ownerUserId, projectId, slot, input) {
      await ensureProject(ownerUserId, projectId);
      const values = normalizeDecisionInput(input);
      const record = await repository.upsertProjectDecision(ownerUserId, projectId, slot, values);
      if (!record) throw notFoundError();
      return (await viewFor(ownerUserId, projectId, slot))!;
    },
    async remove(ownerUserId, projectId, slot) {
      await ensureProject(ownerUserId, projectId);
      await repository.deleteProjectDecision(ownerUserId, projectId, slot);
      return viewFor(ownerUserId, projectId, slot);
    },
    async batch(ownerUserId, projectId, input) {
      await ensureProject(ownerUserId, projectId);
      const seen = new Set<string>();
      const upserts: BatchDecisionUpsert[] = [];
      input.decisions.forEach((decision, index) => {
        if (seen.has(decision.slot)) return;
        seen.add(decision.slot);
        upserts.push({ slot: decision.slot, values: normalizeDecisionInput(decision, index) });
      });
      const removeSlots = input.removeSlots.filter((slot) => !seen.has(slot));
      const applied = await repository.batchProjectDecisions(ownerUserId, projectId, upserts, removeSlots);
      if (!applied) throw notFoundError();
      return listViews(ownerUserId, projectId);
    },
  };
}
