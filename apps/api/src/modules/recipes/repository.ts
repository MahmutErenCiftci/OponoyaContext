import type { ProjectProfileAttachment, Recipe, RecipeSummary } from "@devcontext/contracts";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  profiles,
  projectDecisions,
  projectProfiles,
  projects,
  recipeDecisions,
  recipeProfiles,
  recipes,
  resources,
  sql,
  type RepositoryDatabase, type Database,
} from "@devcontext/db";
import { assertResourcesActive, resourceColumns, toDecisionRecord } from "../decisions/repository.js";
import type { DecisionValues } from "../decisions/service.js";
import { idempotencyKeyConflictError } from "../profiles/service.js";
import { unavailableProfilesError } from "../projects/service.js";
import type { RecipePatch, RecipeRepository } from "./service.js";

type RecipeRow = typeof recipes.$inferSelect;
type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

function toSummary(row: RecipeRow, decisionCount: number, profileCount: number, projectCount: number): RecipeSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    decisionCount,
    profileCount,
    projectCount,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countsFor(executor: Executor, ids: string[]) {
  const empty = { decisions: new Map<string, number>(), profiles: new Map<string, number>(), projects: new Map<string, number>() };
  if (ids.length === 0) return empty;
  const [decisionRows, profileRows, projectRows] = await Promise.all([
    executor.select({ recipeId: recipeDecisions.recipeId, value: count() }).from(recipeDecisions).where(inArray(recipeDecisions.recipeId, ids)).groupBy(recipeDecisions.recipeId),
    executor.select({ recipeId: recipeProfiles.recipeId, value: count() }).from(recipeProfiles).where(inArray(recipeProfiles.recipeId, ids)).groupBy(recipeProfiles.recipeId),
    executor.select({ recipeId: projects.recipeId, value: count() }).from(projects).where(inArray(projects.recipeId, ids)).groupBy(projects.recipeId),
  ]);
  return {
    decisions: new Map(decisionRows.map((row) => [row.recipeId, row.value])),
    profiles: new Map(profileRows.map((row) => [row.recipeId, row.value])),
    projects: new Map(projectRows.flatMap((row) => row.recipeId ? [[row.recipeId, row.value] as const] : [])),
  };
}

function decisionQuery(executor: Executor, ownerUserId: string, recipeId: string) {
  return executor
    .select({
      id: recipeDecisions.id,
      slot: recipeDecisions.slot,
      mode: recipeDecisions.mode,
      priority: recipeDecisions.priority,
      constraints: recipeDecisions.constraints,
      rationale: recipeDecisions.rationale,
      conditions: recipeDecisions.conditions,
      updatedAt: recipeDecisions.updatedAt,
      ...resourceColumns,
    })
    .from(recipeDecisions)
    .innerJoin(recipes, and(eq(recipeDecisions.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId)))
    .leftJoin(resources, and(eq(recipeDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
    .where(eq(recipeDecisions.recipeId, recipeId))
    .orderBy(recipeDecisions.slot);
}

async function attachedProfiles(executor: Executor, ownerUserId: string, recipeId: string): Promise<Recipe["profiles"]> {
  const rows = await executor
    .select({
      id: profiles.id,
      name: profiles.name,
      slug: profiles.slug,
      type: profiles.type,
      priority: recipeProfiles.priority,
      archivedAt: profiles.archivedAt,
    })
    .from(recipeProfiles)
    .innerJoin(profiles, and(eq(recipeProfiles.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId)))
    .where(eq(recipeProfiles.recipeId, recipeId))
    .orderBy(desc(recipeProfiles.priority), profiles.name);
  return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, type: row.type, priority: row.priority, archivedAt: row.archivedAt?.toISOString() ?? null }));
}

async function getById(executor: Executor, ownerUserId: string, recipeId: string): Promise<Recipe | null> {
  const [row] = await executor
    .select()
    .from(recipes)
    .where(and(eq(recipes.ownerUserId, ownerUserId), eq(recipes.id, recipeId)))
    .limit(1);
  if (!row) return null;
  const [decisionRows, profileRows, counts] = await Promise.all([
    decisionQuery(executor, ownerUserId, recipeId),
    attachedProfiles(executor, ownerUserId, recipeId),
    countsFor(executor, [row.id]),
  ]);
  const origin = { id: row.id, name: row.name, priority: 0 };
  return {
    ...toSummary(row, counts.decisions.get(row.id) ?? 0, counts.profiles.get(row.id) ?? 0, counts.projects.get(row.id) ?? 0),
    profiles: profileRows,
    decisions: decisionRows.map((decision) => toDecisionRecord("recipe", decision, origin)),
  };
}

async function ownsRecipe(executor: Executor, ownerUserId: string, recipeId: string) {
  const [row] = await executor
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.ownerUserId, ownerUserId), eq(recipes.id, recipeId)))
    .limit(1);
  return Boolean(row);
}

/** Newly attached Profiles must be active and owned; already attached ones may stay even if archived later. */
async function replaceRecipeProfiles(executor: Executor, ownerUserId: string, recipeId: string, requested: ProjectProfileAttachment[]) {
  const current = await executor.select({ profileId: recipeProfiles.profileId }).from(recipeProfiles).where(eq(recipeProfiles.recipeId, recipeId));
  const retained = new Set(current.map((row) => row.profileId));
  const candidates = requested.map((item) => item.profileId).filter((id) => !retained.has(id));
  if (candidates.length > 0) {
    const active = await executor
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.ownerUserId, ownerUserId), inArray(profiles.id, candidates), isNull(profiles.archivedAt)));
    const allowed = new Set(active.map((row) => row.id));
    const rejected = requested.flatMap((item, index) => retained.has(item.profileId) || allowed.has(item.profileId) ? [] : [index]);
    if (rejected.length > 0) throw unavailableProfilesError(rejected);
  }
  const next = new Set(requested.map((item) => item.profileId));
  const removed = [...retained].filter((id) => !next.has(id));
  if (removed.length > 0) {
    await executor.delete(recipeProfiles).where(and(eq(recipeProfiles.recipeId, recipeId), inArray(recipeProfiles.profileId, removed)));
  }
  if (requested.length > 0) {
    await executor
      .insert(recipeProfiles)
      .values(requested.map((item) => ({ recipeId, profileId: item.profileId, priority: item.priority })))
      .onConflictDoUpdate({ target: [recipeProfiles.recipeId, recipeProfiles.profileId], set: { priority: sql`excluded.priority` } });
  }
}

export function createRecipeRepository(database: RepositoryDatabase): RecipeRepository {
  return {
    async list(ownerUserId, query) {
      const conditions = [eq(recipes.ownerUserId, ownerUserId)];
      if (query.archived === "active") conditions.push(isNull(recipes.archivedAt));
      if (query.archived === "archived") conditions.push(isNotNull(recipes.archivedAt));
      if (query.q) {
        const pattern = `%${query.q}%`;
        conditions.push(or(ilike(recipes.name, pattern), ilike(recipes.description, pattern))!);
      }
      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        database.db.select().from(recipes).where(where).orderBy(desc(recipes.updatedAt), recipes.name).limit(query.limit).offset(query.offset),
        database.db.select({ value: count() }).from(recipes).where(where),
      ]);
      const counts = await countsFor(database.db, rows.map((row) => row.id));
      return {
        recipes: rows.map((row) => toSummary(row, counts.decisions.get(row.id) ?? 0, counts.profiles.get(row.id) ?? 0, counts.projects.get(row.id) ?? 0)),
        total: totalRows[0]?.value ?? 0,
      };
    },

    findById(ownerUserId, recipeId) {
      return getById(database.db, ownerUserId, recipeId);
    },

    create(ownerUserId, recipeId, slug, record, attachments) {
      return database.db.transaction(async (transaction) => {
        await transaction.insert(recipes).values({ id: recipeId, ownerUserId, slug, name: record.name, description: record.description });
        if (attachments.length > 0) await replaceRecipeProfiles(transaction, ownerUserId, recipeId, attachments);
        return (await getById(transaction, ownerUserId, recipeId))!;
      });
    },

    update(ownerUserId, recipeId, patch: RecipePatch, attachments) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsRecipe(transaction, ownerUserId, recipeId))) return null;
        const values: Partial<typeof recipes.$inferInsert> = { updatedAt: new Date() };
        if (patch.name !== undefined) values.name = patch.name;
        if (patch.description !== undefined) values.description = patch.description;
        await transaction.update(recipes).set(values).where(and(eq(recipes.ownerUserId, ownerUserId), eq(recipes.id, recipeId)));
        if (attachments !== undefined) await replaceRecipeProfiles(transaction, ownerUserId, recipeId, attachments);
        return getById(transaction, ownerUserId, recipeId);
      });
    },

    async setArchived(ownerUserId, recipeId, archived) {
      const [row] = await database.db
        .update(recipes)
        .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
        .where(and(eq(recipes.ownerUserId, ownerUserId), eq(recipes.id, recipeId)))
        .returning({ id: recipes.id });
      if (!row) return null;
      return getById(database.db, ownerUserId, recipeId);
    },

    upsertDecision(ownerUserId, recipeId, slot, values: DecisionValues) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsRecipe(transaction, ownerUserId, recipeId))) return null;
        await assertResourcesActive(transaction, ownerUserId, [values.resourceId]);
        await transaction
          .insert(recipeDecisions)
          .values({ recipeId, slot, ...values })
          .onConflictDoUpdate({ target: [recipeDecisions.recipeId, recipeDecisions.slot], set: { ...values, updatedAt: new Date() } });
        await transaction.update(recipes).set({ updatedAt: new Date() }).where(eq(recipes.id, recipeId));
        const recipe = await getById(transaction, ownerUserId, recipeId);
        return recipe?.decisions.find((decision) => decision.slot === slot) ?? null;
      });
    },

    deleteDecision(ownerUserId, recipeId, slot) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsRecipe(transaction, ownerUserId, recipeId))) return null;
        const deleted = await transaction
          .delete(recipeDecisions)
          .where(and(eq(recipeDecisions.recipeId, recipeId), eq(recipeDecisions.slot, slot)))
          .returning({ id: recipeDecisions.id });
        if (deleted.length > 0) await transaction.update(recipes).set({ updatedAt: new Date() }).where(eq(recipes.id, recipeId));
        return deleted.length > 0;
      });
    },

    createFromProject(ownerUserId, projectId, recipeId, slug, record) {
      return database.db.transaction(async (transaction) => {
        const [project] = await transaction
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
          .limit(1);
        if (!project) return null;
        // Any conflict (id or the id-derived slug) means the key was already used.
        const inserted = await transaction
          .insert(recipes)
          .values({ id: recipeId, ownerUserId, slug, name: record.name, description: record.description })
          .onConflictDoNothing()
          .returning({ id: recipes.id });
        if (inserted.length === 0) {
          const existing = await getById(transaction, ownerUserId, recipeId);
          if (!existing) throw idempotencyKeyConflictError();
          return { recipe: existing, created: false };
        }
        const [attachments, decisions] = await Promise.all([
          transaction.select({ profileId: projectProfiles.profileId, priority: projectProfiles.priority }).from(projectProfiles).where(eq(projectProfiles.projectId, projectId)),
          transaction.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId)),
        ]);
        if (attachments.length > 0) {
          await transaction.insert(recipeProfiles).values(attachments.map((row) => ({ recipeId, profileId: row.profileId, priority: row.priority }))).onConflictDoNothing();
        }
        if (decisions.length > 0) {
          await transaction.insert(recipeDecisions).values(decisions.map((row) => ({
            recipeId,
            slot: row.slot,
            mode: row.mode,
            resourceId: row.resourceId,
            priority: row.priority,
            constraints: row.constraints,
            rationale: row.rationale,
            conditions: row.conditions,
          }))).onConflictDoNothing();
        }
        return { recipe: (await getById(transaction, ownerUserId, recipeId))!, created: true };
      });
    },
  };
}
