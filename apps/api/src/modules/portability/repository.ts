import type { ImportSummary } from "@devcontext/contracts";
import {
  and,
  compatibilityRules,
  eq,
  globalDecisions,
  importRequests,
  inArray,
  profileDecisions,
  profiles,
  projectDecisions,
  projectProfiles,
  projectResources,
  projects,
  recipeDecisions,
  recipeProfiles,
  recipes,
  resourceTags,
  resources,
  tags,
  type Database,
  type RepositoryDatabase,
} from "@devcontext/db";
import type { ImportPlan, PlannedDecision, PortabilityRepository, WorkspaceRows } from "./service.js";

type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const current = map.get(key(row)) ?? [];
    current.push(row);
    map.set(key(row), current);
  }
  return map;
}

async function insertTags(executor: Executor, ownerUserId: string, resourceId: string, names: string[]) {
  if (names.length === 0) return;
  await executor.insert(tags).values(names.map((name) => ({ ownerUserId, name }))).onConflictDoNothing({ target: [tags.ownerUserId, tags.name] });
  const rows = await executor.select({ id: tags.id }).from(tags).where(and(eq(tags.ownerUserId, ownerUserId), inArray(tags.name, names)));
  if (rows.length > 0) await executor.insert(resourceTags).values(rows.map(({ id }) => ({ resourceId, tagId: id }))).onConflictDoNothing();
}

function decisionRows<T extends Record<string, string>>(parent: T, decisions: PlannedDecision[]) {
  return decisions.map((decision) => ({
    ...parent,
    slot: decision.slot,
    mode: decision.mode,
    resourceId: decision.resourceId,
    priority: decision.priority,
    constraints: decision.constraints,
    rationale: decision.rationale,
    conditions: decision.conditions,
  }));
}

export function createPortabilityRepository(database: RepositoryDatabase): PortabilityRepository {
  return {
    async loadWorkspace(ownerUserId): Promise<WorkspaceRows> {
      const [resourceRows, tagRows, globalRows, profileRows, profileDecisionRows, recipeRows, recipeProfileRows, recipeDecisionRows, projectRows, projectResourceRows, projectProfileRows, projectDecisionRows, ruleRows] = await Promise.all([
        database.db.select().from(resources).where(eq(resources.ownerUserId, ownerUserId)).orderBy(resources.createdAt, resources.id),
        database.db.select({ resourceId: resourceTags.resourceId, name: tags.name }).from(resourceTags).innerJoin(tags, eq(resourceTags.tagId, tags.id)).where(eq(tags.ownerUserId, ownerUserId)).orderBy(tags.name),
        database.db.select().from(globalDecisions).where(eq(globalDecisions.ownerUserId, ownerUserId)),
        database.db.select().from(profiles).where(eq(profiles.ownerUserId, ownerUserId)).orderBy(profiles.createdAt, profiles.id),
        database.db.select({ decision: profileDecisions }).from(profileDecisions).innerJoin(profiles, and(eq(profileDecisions.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId))).orderBy(profileDecisions.slot),
        database.db.select().from(recipes).where(eq(recipes.ownerUserId, ownerUserId)).orderBy(recipes.createdAt, recipes.id),
        database.db.select({ recipeId: recipeProfiles.recipeId, profileId: recipeProfiles.profileId, priority: recipeProfiles.priority }).from(recipeProfiles).innerJoin(recipes, and(eq(recipeProfiles.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId))),
        database.db.select({ decision: recipeDecisions }).from(recipeDecisions).innerJoin(recipes, and(eq(recipeDecisions.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId))).orderBy(recipeDecisions.slot),
        database.db.select().from(projects).where(eq(projects.ownerUserId, ownerUserId)).orderBy(projects.createdAt, projects.id),
        database.db.select({ projectId: projectResources.projectId, resourceId: projectResources.resourceId }).from(projectResources).innerJoin(projects, and(eq(projectResources.projectId, projects.id), eq(projects.ownerUserId, ownerUserId))).orderBy(projectResources.createdAt),
        database.db.select({ projectId: projectProfiles.projectId, profileId: projectProfiles.profileId, priority: projectProfiles.priority }).from(projectProfiles).innerJoin(projects, and(eq(projectProfiles.projectId, projects.id), eq(projects.ownerUserId, ownerUserId))),
        database.db.select({ decision: projectDecisions }).from(projectDecisions).innerJoin(projects, and(eq(projectDecisions.projectId, projects.id), eq(projects.ownerUserId, ownerUserId))).orderBy(projectDecisions.slot),
        database.db.select().from(compatibilityRules).where(eq(compatibilityRules.ownerUserId, ownerUserId)).orderBy(compatibilityRules.createdAt),
      ]);
      const tagsByResource = groupBy(tagRows, (row) => row.resourceId);
      const preferenceByResource = new Map(globalRows.flatMap((row) => row.resourceId && row.mode !== "AI_DECIDE" ? [[row.resourceId, { slot: row.slot, mode: row.mode }] as const] : []));
      const profileDecisionsById = groupBy(profileDecisionRows.map((row) => row.decision), (row) => row.profileId);
      const recipeProfilesById = groupBy(recipeProfileRows, (row) => row.recipeId);
      const recipeDecisionsById = groupBy(recipeDecisionRows.map((row) => row.decision), (row) => row.recipeId);
      const projectResourcesById = groupBy(projectResourceRows, (row) => row.projectId);
      const projectProfilesById = groupBy(projectProfileRows, (row) => row.projectId);
      const projectDecisionsById = groupBy(projectDecisionRows.map((row) => row.decision), (row) => row.projectId);
      const toDecision = (row: { slot: string; mode: PlannedDecision["mode"]; resourceId: string | null; priority: number; constraints: Record<string, unknown>; rationale: string | null; conditions: Record<string, unknown> }) => ({
        slot: row.slot, mode: row.mode, resourceId: row.resourceId, priority: row.priority, constraints: row.constraints, rationale: row.rationale, conditions: row.conditions,
      });
      return {
        resources: resourceRows.map((row) => ({
          id: row.id, name: row.name, type: row.type, description: row.description, sourceUrl: row.sourceUrl, docsUrl: row.docsUrl, repoUrl: row.repoUrl,
          installCommand: row.installCommand, notes: row.notes, metadata: row.metadata, favorite: row.favorite, archived: row.archivedAt !== null,
          tags: (tagsByResource.get(row.id) ?? []).map((tag) => tag.name),
          preference: preferenceByResource.get(row.id) ?? null,
        })),
        profiles: profileRows.map((row) => ({
          id: row.id, name: row.name, type: row.type, description: row.description, archived: row.archivedAt !== null,
          decisions: (profileDecisionsById.get(row.id) ?? []).map(toDecision),
        })),
        recipes: recipeRows.map((row) => ({
          id: row.id, name: row.name, description: row.description, archived: row.archivedAt !== null,
          profiles: (recipeProfilesById.get(row.id) ?? []).map((item) => ({ profileId: item.profileId, priority: item.priority })),
          decisions: (recipeDecisionsById.get(row.id) ?? []).map(toDecision),
        })),
        projects: projectRows.map((row) => ({
          id: row.id, name: row.name, description: row.description, productType: row.productType, stage: row.stage, status: row.status,
          platforms: row.platforms, priorities: row.priorities, rules: row.rules, recipeId: row.recipeId,
          profiles: (projectProfilesById.get(row.id) ?? []).map((item) => ({ profileId: item.profileId, priority: item.priority })),
          resourceIds: (projectResourcesById.get(row.id) ?? []).map((item) => item.resourceId),
          decisions: (projectDecisionsById.get(row.id) ?? []).map(toDecision),
        })),
        compatibilityRules: ruleRows.map((row) => ({ id: row.id, kind: row.kind, leftResourceId: row.leftResourceId, rightResourceId: row.rightResourceId, note: row.note })),
        globalDecisions: globalRows.map((row) => ({ slot: row.slot, resourceId: row.resourceId, mode: row.mode })),
      };
    },

    async findImport(ownerUserId, requestId) {
      const [row] = await database.db
        .select({ summary: importRequests.summary })
        .from(importRequests)
        .where(and(eq(importRequests.ownerUserId, ownerUserId), eq(importRequests.requestId, requestId)))
        .limit(1);
      return row ? (row.summary as ImportSummary) : null;
    },

    applyImport(ownerUserId, plan: ImportPlan, requestId) {
      return database.db.transaction(async (transaction) => {
        if (requestId) {
          // The request row is the idempotency lock: a concurrent replay conflicts here and mutates nothing.
          const inserted = await transaction
            .insert(importRequests)
            .values({ ownerUserId, requestId, strategy: plan.summary.strategy, summary: plan.summary })
            .onConflictDoNothing({ target: [importRequests.ownerUserId, importRequests.requestId] })
            .returning({ id: importRequests.id });
          if (inserted.length === 0) return { created: false };
        }
        const now = new Date();

        for (const item of plan.resources) {
          if (item.action === "skip") continue;
          const values = {
            name: item.name,
            type: item.input.type,
            description: item.input.description,
            sourceUrl: item.input.sourceUrl,
            docsUrl: item.input.docsUrl,
            repoUrl: item.input.repoUrl,
            installCommand: item.input.installCommand,
            notes: item.input.notes,
            metadata: item.input.metadata,
            favorite: item.input.favorite,
            archivedAt: item.input.archived ? now : null,
          };
          if (item.action === "replace") {
            await transaction.update(resources).set({ ...values, updatedAt: now }).where(and(eq(resources.ownerUserId, ownerUserId), eq(resources.id, item.id)));
            await transaction.delete(resourceTags).where(eq(resourceTags.resourceId, item.id));
            await transaction.delete(globalDecisions).where(and(eq(globalDecisions.ownerUserId, ownerUserId), eq(globalDecisions.resourceId, item.id)));
          } else {
            await transaction.insert(resources).values({ id: item.id, ownerUserId, slug: item.slug, ...values });
          }
          await insertTags(transaction, ownerUserId, item.id, item.input.tags);
          if (item.preference) {
            await transaction
              .insert(globalDecisions)
              .values({ ownerUserId, resourceId: item.id, slot: item.preference.slot, mode: item.preference.mode })
              .onConflictDoUpdate({ target: [globalDecisions.ownerUserId, globalDecisions.slot], set: { resourceId: item.id, mode: item.preference.mode, updatedAt: now } });
          }
        }

        for (const item of plan.profiles) {
          if (item.action === "skip") continue;
          const values = { name: item.name, type: item.input.type, description: item.input.description, archivedAt: item.input.archived ? now : null };
          if (item.action === "replace") {
            await transaction.update(profiles).set({ ...values, updatedAt: now }).where(and(eq(profiles.ownerUserId, ownerUserId), eq(profiles.id, item.id)));
            await transaction.delete(profileDecisions).where(eq(profileDecisions.profileId, item.id));
          } else {
            await transaction.insert(profiles).values({ id: item.id, ownerUserId, slug: item.slug, ...values });
          }
          if (item.decisions.length > 0) await transaction.insert(profileDecisions).values(decisionRows({ profileId: item.id }, item.decisions));
        }

        for (const item of plan.recipes) {
          if (item.action === "skip") continue;
          const values = { name: item.name, description: item.input.description, archivedAt: item.input.archived ? now : null };
          if (item.action === "replace") {
            await transaction.update(recipes).set({ ...values, updatedAt: now }).where(and(eq(recipes.ownerUserId, ownerUserId), eq(recipes.id, item.id)));
            await transaction.delete(recipeProfiles).where(eq(recipeProfiles.recipeId, item.id));
            await transaction.delete(recipeDecisions).where(eq(recipeDecisions.recipeId, item.id));
          } else {
            await transaction.insert(recipes).values({ id: item.id, ownerUserId, slug: item.slug, ...values });
          }
          if (item.profiles.length > 0) await transaction.insert(recipeProfiles).values(item.profiles.map((attachment) => ({ recipeId: item.id, profileId: attachment.profileId, priority: attachment.priority }))).onConflictDoNothing();
          if (item.decisions.length > 0) await transaction.insert(recipeDecisions).values(decisionRows({ recipeId: item.id }, item.decisions));
        }

        for (const item of plan.projects) {
          if (item.action === "skip") continue;
          const values = {
            name: item.name,
            description: item.input.description,
            productType: item.input.productType,
            stage: item.input.stage,
            status: item.input.status,
            platforms: item.input.platforms,
            priorities: item.input.priorities,
            rules: item.input.rules,
            recipeId: item.recipeId,
          };
          if (item.action === "replace") {
            await transaction.update(projects).set({ ...values, updatedAt: now }).where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, item.id)));
            await transaction.delete(projectResources).where(eq(projectResources.projectId, item.id));
            await transaction.delete(projectProfiles).where(eq(projectProfiles.projectId, item.id));
            await transaction.delete(projectDecisions).where(eq(projectDecisions.projectId, item.id));
          } else {
            await transaction.insert(projects).values({ id: item.id, ownerUserId, slug: item.slug, ...values });
          }
          if (item.resourceIds.length > 0) await transaction.insert(projectResources).values(item.resourceIds.map((resourceId) => ({ projectId: item.id, resourceId }))).onConflictDoNothing();
          if (item.profiles.length > 0) await transaction.insert(projectProfiles).values(item.profiles.map((attachment) => ({ projectId: item.id, profileId: attachment.profileId, priority: attachment.priority }))).onConflictDoNothing();
          if (item.decisions.length > 0) await transaction.insert(projectDecisions).values(decisionRows({ projectId: item.id }, item.decisions));
        }

        for (const item of plan.compatibilityRules) {
          if (item.action === "skip") continue;
          await transaction
            .insert(compatibilityRules)
            .values({ ownerUserId, kind: item.kind, leftResourceId: item.leftResourceId, rightResourceId: item.rightResourceId, note: item.note })
            .onConflictDoNothing();
        }
        return { created: true };
      });
    },
  };
}
