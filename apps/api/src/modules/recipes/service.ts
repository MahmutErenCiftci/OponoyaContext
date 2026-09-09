import type {
  CreateRecipeInput,
  DecisionRecord,
  ProjectProfileAttachment,
  Recipe,
  RecipeListQuery,
  RecipeSummary,
  SaveProjectAsRecipeInput,
  UpdateRecipeInput,
  UpsertProjectDecisionInput,
} from "@devcontext/contracts";
import { slugify } from "../../lib/slug.js";
import { normalizeDecisionInput, type DecisionValues } from "../decisions/service.js";
import { normalizeProfiles } from "../projects/service.js";

export type RecipePatch = { name?: string; description?: string | null };
export type NewRecipeRecord = { name: string; description: string | null };

/**
 * A Recipe is a composition shortcut: Profiles (with priority) plus its own
 * decisions. Projects reference a Recipe; they never receive a copy of its
 * decisions, so editing the Recipe changes every Project that applies it.
 */
export interface RecipeRepository {
  list(ownerUserId: string, query: RecipeListQuery): Promise<{ recipes: RecipeSummary[]; total: number }>;
  findById(ownerUserId: string, recipeId: string): Promise<Recipe | null>;
  /** Profiles must be active and owned (`unavailableProfilesError` with positions otherwise). */
  create(ownerUserId: string, recipeId: string, slug: string, record: NewRecipeRecord, profiles: ProjectProfileAttachment[]): Promise<Recipe>;
  /** `profiles === undefined` leaves the attachment set untouched. `null` for a foreign Recipe. */
  update(ownerUserId: string, recipeId: string, patch: RecipePatch, profiles: ProjectProfileAttachment[] | undefined): Promise<Recipe | null>;
  setArchived(ownerUserId: string, recipeId: string, archived: boolean): Promise<Recipe | null>;
  upsertDecision(ownerUserId: string, recipeId: string, slot: string, values: DecisionValues): Promise<DecisionRecord | null>;
  /** `null` for a foreign Recipe, otherwise whether a decision existed. */
  deleteDecision(ownerUserId: string, recipeId: string, slot: string): Promise<boolean | null>;
  /**
   * Creates a Recipe from a Project's explicit decisions and Profile attachments
   * in one transaction. `recipeId` doubles as the idempotency key. `null` when
   * the Project is foreign.
   */
  createFromProject(ownerUserId: string, projectId: string, recipeId: string, slug: string, record: NewRecipeRecord): Promise<{ recipe: Recipe; created: boolean } | null>;
}

function notFoundError() {
  return Object.assign(new Error("Recipe not found"), { statusCode: 404 });
}

function projectNotFoundError() {
  return Object.assign(new Error("Project not found"), { statusCode: 404 });
}

export function slugifyRecipeName(name: string) {
  return slugify(name, "recipe");
}

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export interface RecipeService {
  list(ownerUserId: string, query: RecipeListQuery): Promise<{ recipes: RecipeSummary[]; total: number }>;
  get(ownerUserId: string, recipeId: string): Promise<Recipe>;
  create(ownerUserId: string, input: CreateRecipeInput): Promise<Recipe>;
  update(ownerUserId: string, recipeId: string, input: UpdateRecipeInput): Promise<Recipe>;
  setProfiles(ownerUserId: string, recipeId: string, profiles: ProjectProfileAttachment[]): Promise<Recipe>;
  archive(ownerUserId: string, recipeId: string): Promise<Recipe>;
  restore(ownerUserId: string, recipeId: string): Promise<Recipe>;
  upsertDecision(ownerUserId: string, recipeId: string, slot: string, input: UpsertProjectDecisionInput): Promise<DecisionRecord>;
  removeDecision(ownerUserId: string, recipeId: string, slot: string): Promise<void>;
  saveFromProject(ownerUserId: string, projectId: string, input: SaveProjectAsRecipeInput, idempotencyKey?: string): Promise<{ recipe: Recipe; created: boolean }>;
}

export function createRecipeService(repository: RecipeRepository): RecipeService {
  return {
    list(ownerUserId, query) {
      return repository.list(ownerUserId, query);
    },
    async get(ownerUserId, recipeId) {
      const recipe = await repository.findById(ownerUserId, recipeId);
      if (!recipe) throw notFoundError();
      return recipe;
    },
    create(ownerUserId, input) {
      const id = crypto.randomUUID();
      return repository.create(
        ownerUserId,
        id,
        `${slugifyRecipeName(input.name)}-${id.slice(0, 8)}`,
        { name: input.name, description: optionalText(input.description) },
        normalizeProfiles(input.profiles ?? []),
      );
    },
    async update(ownerUserId, recipeId, input) {
      const patch: RecipePatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = optionalText(input.description);
      const recipe = await repository.update(ownerUserId, recipeId, patch, input.profiles === undefined ? undefined : normalizeProfiles(input.profiles));
      if (!recipe) throw notFoundError();
      return recipe;
    },
    async setProfiles(ownerUserId, recipeId, profiles) {
      const recipe = await repository.update(ownerUserId, recipeId, {}, normalizeProfiles(profiles));
      if (!recipe) throw notFoundError();
      return recipe;
    },
    async archive(ownerUserId, recipeId) {
      const recipe = await repository.setArchived(ownerUserId, recipeId, true);
      if (!recipe) throw notFoundError();
      return recipe;
    },
    async restore(ownerUserId, recipeId) {
      const recipe = await repository.setArchived(ownerUserId, recipeId, false);
      if (!recipe) throw notFoundError();
      return recipe;
    },
    async upsertDecision(ownerUserId, recipeId, slot, input) {
      const record = await repository.upsertDecision(ownerUserId, recipeId, slot, normalizeDecisionInput(input));
      if (!record) throw notFoundError();
      return record;
    },
    async removeDecision(ownerUserId, recipeId, slot) {
      const result = await repository.deleteDecision(ownerUserId, recipeId, slot);
      if (result === null) throw notFoundError();
    },
    async saveFromProject(ownerUserId, projectId, input, idempotencyKey) {
      const id = idempotencyKey ?? crypto.randomUUID();
      const result = await repository.createFromProject(ownerUserId, projectId, id, `${slugifyRecipeName(input.name)}-${id.slice(0, 8)}`, {
        name: input.name,
        description: optionalText(input.description),
      });
      if (!result) throw projectNotFoundError();
      return result;
    },
  };
}
