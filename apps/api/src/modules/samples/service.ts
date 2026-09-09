import type { SampleCounts, WorkspaceSettings } from "@devcontext/contracts";
import type { CompatibilityService } from "../compatibility/service.js";
import type { DecisionService } from "../decisions/service.js";
import type { ProfileService } from "../profiles/service.js";
import type { ProjectService } from "../projects/service.js";
import type { RecipeService } from "../recipes/service.js";
import type { ResourceService } from "../resources/service.js";
import { toWorkspaceSettings } from "../workspace/routes.js";
import type { WorkspaceRepository } from "../workspace/repository.js";
import {
  sampleCompatibilityRules,
  sampleProfiles,
  sampleProject,
  sampleRecipe,
  sampleResources,
  sampleSetVersion,
  type SampleDecision,
} from "./catalog.js";
import type { SampleRepository } from "./repository.js";

export type SampleServiceDependencies = {
  samples: SampleRepository;
  workspace: WorkspaceRepository;
  resources: ResourceService;
  profiles: ProfileService;
  recipes: RecipeService;
  projects: ProjectService;
  decisions: DecisionService;
  compatibility: CompatibilityService;
};

export type SampleTransaction = <T>(ownerUserId: string, work: (deps: SampleServiceDependencies) => Promise<T>) => Promise<T>;

export interface SampleService {
  /**
   * Installs the current sample set through the regular services, recording
   * every created entity. Idempotent: entities whose key is already recorded
   * are reused, so a retry only adds what is missing.
   */
  install(ownerUserId: string): Promise<{ settings: WorkspaceSettings; created: boolean; counts: SampleCounts }>;
  /** Deletes exactly the recorded sample entities. User-created data is never touched. */
  remove(ownerUserId: string): Promise<{ settings: WorkspaceSettings; removed: SampleCounts }>;
}

function emptyCounts(): SampleCounts {
  return { resources: 0, profiles: 0, recipes: 0, projects: 0, compatibilityRules: 0 };
}

export function createSampleService(inTransaction: SampleTransaction): SampleService {
  return {
    async install(ownerUserId) {
      return inTransaction(ownerUserId, async (deps) => {
        const recorded = new Map((await deps.samples.list(ownerUserId)).map((row) => [row.key, row.entityId]));
        const counts = emptyCounts();
        const resourceIds = new Map<string, string>();
        const resourceIdFor = (key: string | null) => (key ? resourceIds.get(key) ?? null : null);
        const toDecisionInput = (decision: SampleDecision) => ({
          mode: decision.mode,
          resourceId: resourceIdFor(decision.resourceKey),
          priority: 0,
          constraints: decision.constraints ?? {},
          rationale: decision.rationale ?? null,
          conditions: {},
        });

        for (const sample of sampleResources) {
          const existing = recorded.get(sample.key);
          if (existing) {
            resourceIds.set(sample.key, existing);
            continue;
          }
          const result = await deps.resources.create(ownerUserId, {
            name: sample.name,
            type: sample.type,
            description: sample.description,
            ...(sample.sourceUrl ? { sourceUrl: sample.sourceUrl } : {}),
            ...(sample.docsUrl ? { docsUrl: sample.docsUrl } : {}),
            ...(sample.installCommand ? { installCommand: sample.installCommand } : {}),
            ...(sample.notes ? { notes: sample.notes } : {}),
            tags: sample.tags,
            metadata: { devcontextSample: sampleSetVersion },
          });
          await deps.samples.record(ownerUserId, sampleSetVersion, sample.key, "resource", result.resource.id);
          if (sample.preference) await deps.samples.setPreferenceIfEmpty(ownerUserId, result.resource.id, sample.preference);
          resourceIds.set(sample.key, result.resource.id);
          counts.resources += 1;
        }

        for (const rule of sampleCompatibilityRules) {
          if (recorded.has(rule.key)) continue;
          const left = resourceIdFor(rule.leftKey);
          const right = resourceIdFor(rule.rightKey);
          if (!left || !right) continue;
          const result = await deps.compatibility.create(ownerUserId, { kind: rule.kind, leftResourceId: left, rightResourceId: right, note: rule.note });
          await deps.samples.record(ownerUserId, sampleSetVersion, rule.key, "compatibility_rule", result.rule.id);
          if (result.created) counts.compatibilityRules += 1;
        }

        const profileIds = new Map<string, string>();
        for (const sample of sampleProfiles) {
          let id = recorded.get(sample.key);
          if (!id) {
            const profile = await deps.profiles.create(ownerUserId, { name: sample.name, type: sample.type, description: sample.description });
            await deps.samples.record(ownerUserId, sampleSetVersion, sample.key, "profile", profile.id);
            id = profile.id;
            counts.profiles += 1;
            for (const decision of sample.decisions) await deps.profiles.upsertDecision(ownerUserId, id, decision.slot, toDecisionInput(decision));
          }
          profileIds.set(sample.key, id);
        }

        let recipeId = recorded.get(sampleRecipe.key);
        if (!recipeId) {
          const recipe = await deps.recipes.create(ownerUserId, {
            name: sampleRecipe.name,
            description: sampleRecipe.description,
            profiles: sampleRecipe.profiles.flatMap((item) => {
              const profileId = profileIds.get(item.profileKey);
              return profileId ? [{ profileId, priority: item.priority }] : [];
            }),
          });
          await deps.samples.record(ownerUserId, sampleSetVersion, sampleRecipe.key, "recipe", recipe.id);
          recipeId = recipe.id;
          counts.recipes += 1;
          for (const decision of sampleRecipe.decisions) await deps.recipes.upsertDecision(ownerUserId, recipeId, decision.slot, toDecisionInput(decision));
        }

        if (!recorded.has(sampleProject.key)) {
          const result = await deps.projects.create(ownerUserId, {
            name: sampleProject.name,
            description: sampleProject.description,
            productType: sampleProject.productType,
            stage: sampleProject.stage,
            platforms: sampleProject.platforms,
            priorities: sampleProject.priorities,
            rules: sampleProject.rules,
            recipeId,
            resourceIds: sampleProject.resourceKeys.flatMap((key) => resourceIdFor(key) ?? []),
          });
          await deps.samples.record(ownerUserId, sampleSetVersion, sampleProject.key, "project", result.project.id);
          counts.projects += 1;
          if (sampleProject.decisions.length > 0) {
            await deps.decisions.batch(ownerUserId, result.project.id, {
              decisions: sampleProject.decisions.map((decision) => ({ slot: decision.slot, ...toDecisionInput(decision) })),
              removeSlots: [],
            });
          }
        }

        let settings = await deps.workspace.setSamples(ownerUserId, sampleSetVersion);
        if (settings.onboardingState === "new") settings = await deps.workspace.updateOnboarding(ownerUserId, "in_progress", "samples");
        const created = Object.values(counts).some((value) => value > 0);
        return { settings: toWorkspaceSettings(settings), created, counts };
      });
    },

    async remove(ownerUserId) {
      return inTransaction(ownerUserId, async (deps) => {
        const rows = await deps.samples.list(ownerUserId);
        const ids = {
          resources: rows.filter((row) => row.entityType === "resource").map((row) => row.entityId),
          profiles: rows.filter((row) => row.entityType === "profile").map((row) => row.entityId),
          recipes: rows.filter((row) => row.entityType === "recipe").map((row) => row.entityId),
          projects: rows.filter((row) => row.entityType === "project").map((row) => row.entityId),
          compatibilityRules: rows.filter((row) => row.entityType === "compatibility_rule").map((row) => row.entityId),
        };
        const removed = await deps.samples.remove(ownerUserId, ids);
        const settings = await deps.workspace.setSamples(ownerUserId, null);
        return { settings: toWorkspaceSettings(settings), removed };
      });
    },
  };
}
