import type { GlobalPreferenceMode, SampleCounts } from "@devcontext/contracts";
import { and, compatibilityRules, eq, globalDecisions, inArray, or, profiles, projects, recipes, resources, workspaceSamples, type RepositoryDatabase } from "@devcontext/db";
import { createPortabilityRepository } from "../portability/repository.js";

export type SampleRecord = { key: string; version: string; entityType: string; entityId: string };

export type SampleEntityIds = { resources: string[]; profiles: string[]; recipes: string[]; projects: string[]; compatibilityRules: string[] };

export interface SampleRepository {
  list(ownerUserId: string): Promise<SampleRecord[]>;
  record(ownerUserId: string, version: string, key: string, entityType: string, entityId: string): Promise<void>;
  setPreferenceIfEmpty(ownerUserId: string, resourceId: string, preference: { slot: string; mode: GlobalPreferenceMode }): Promise<void>;
  /** Hard-deletes the recorded sample entities (owner-scoped) and forgets the records; returns what was removed. */
  remove(ownerUserId: string, ids: SampleEntityIds): Promise<SampleCounts>;
}

export function createSampleRepository(database: RepositoryDatabase): SampleRepository {
  return {
    async setPreferenceIfEmpty(ownerUserId, resourceId, preference) {
      await database.db.insert(globalDecisions).values({ ownerUserId, resourceId, ...preference })
        .onConflictDoNothing({ target: [globalDecisions.ownerUserId, globalDecisions.slot] });
    },
    async list(ownerUserId) {
      const rows = await database.db.select().from(workspaceSamples).where(eq(workspaceSamples.ownerUserId, ownerUserId));
      return rows.map((row) => ({ key: row.key, version: row.version, entityType: row.entityType, entityId: row.entityId }));
    },

    async record(ownerUserId, version, key, entityType, entityId) {
      await database.db.insert(workspaceSamples).values({ ownerUserId, version, key, entityType, entityId }).onConflictDoNothing();
    },

    remove(ownerUserId, ids) {
      return database.db.transaction(async (transaction) => {
        // Lock referenced sample rows before inspecting incoming links. Concurrent
        // FK inserts must wait, then either see the surviving row or fail safely.
        for (const [table, entityIds] of [[resources, ids.resources], [profiles, ids.profiles], [recipes, ids.recipes], [projects, ids.projects]] as const) {
          if (entityIds.length) await transaction.select({ id: table.id }).from(table).where(and(eq(table.ownerUserId, ownerUserId), inArray(table.id, entityIds))).for("update");
        }
        const workspace = await createPortabilityRepository({ db: transaction }).loadWorkspace(ownerUserId);
        const resourceIds = new Set(ids.resources);
        const profileIds = new Set(ids.profiles);
        const recipeIds = new Set(ids.recipes);
        const projectIds = new Set(ids.projects);
        const ruleIds = new Set(ids.compatibilityRules);
        const usesResources = (decisions: Array<{ resourceId: string | null }>) => decisions.some((decision) => decision.resourceId !== null && resourceIds.has(decision.resourceId));
        const usesProfiles = (attachments: Array<{ profileId: string }>) => attachments.some((item) => profileIds.has(item.profileId));
        const ownProjects = workspace.projects.filter((project) => !projectIds.has(project.id));
        const used = ownProjects.some((project) =>
          (project.recipeId !== null && recipeIds.has(project.recipeId)) || usesProfiles(project.profiles)
          || project.resourceIds.some((id) => resourceIds.has(id)) || usesResources(project.decisions))
          || workspace.profiles.some((profile) => !profileIds.has(profile.id) && usesResources(profile.decisions))
          || workspace.recipes.some((recipe) => !recipeIds.has(recipe.id) && (usesProfiles(recipe.profiles) || usesResources(recipe.decisions)))
          || workspace.compatibilityRules.some((rule) => !ruleIds.has(rule.id) && (resourceIds.has(rule.leftResourceId) || resourceIds.has(rule.rightResourceId)))
          || (ownProjects.length > 0 && usesResources(workspace.globalDecisions));
        if (used) throw Object.assign(new Error("Samples are in use"), {
          statusCode: 409,
          publicMessage: "Sample data is used by your projects, profiles, recipes or compatibility rules. Remove those references (including inherited Library preferences) before removing samples. Nothing was deleted.",
          details: [{ path: ["samples"], code: "samples_in_use" }],
        });
        const counts: SampleCounts = { resources: 0, profiles: 0, recipes: 0, projects: 0, compatibilityRules: 0 };
        if (ids.projects.length > 0) {
          counts.projects = (await transaction.delete(projects).where(and(eq(projects.ownerUserId, ownerUserId), inArray(projects.id, ids.projects))).returning({ id: projects.id })).length;
        }
        if (ids.recipes.length > 0) {
          counts.recipes = (await transaction.delete(recipes).where(and(eq(recipes.ownerUserId, ownerUserId), inArray(recipes.id, ids.recipes))).returning({ id: recipes.id })).length;
        }
        if (ids.profiles.length > 0) {
          counts.profiles = (await transaction.delete(profiles).where(and(eq(profiles.ownerUserId, ownerUserId), inArray(profiles.id, ids.profiles))).returning({ id: profiles.id })).length;
        }
        if (ids.resources.length > 0) {
          const rules = await transaction
            .select({ id: compatibilityRules.id })
            .from(compatibilityRules)
            .where(and(
              eq(compatibilityRules.ownerUserId, ownerUserId),
              or(inArray(compatibilityRules.leftResourceId, ids.resources), inArray(compatibilityRules.rightResourceId, ids.resources))!,
            ));
          counts.compatibilityRules = rules.length;
          counts.resources = (await transaction.delete(resources).where(and(eq(resources.ownerUserId, ownerUserId), inArray(resources.id, ids.resources))).returning({ id: resources.id })).length;
        }
        await transaction.delete(workspaceSamples).where(eq(workspaceSamples.ownerUserId, ownerUserId));
        return counts;
      });
    },
  };
}
