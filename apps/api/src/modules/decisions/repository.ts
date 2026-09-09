import type { DecisionOrigin, DecisionRecord, DecisionScope } from "@devcontext/contracts";
import {
  and,
  eq,
  globalDecisions,
  inArray,
  isNull,
  profileDecisions,
  profiles,
  projectDecisions,
  projectProfiles,
  projects,
  recipeDecisions,
  recipeProfiles,
  recipes,
  resources,
  type RepositoryDatabase, type Database,
} from "@devcontext/db";
import {
  resourceUnavailableError,
  type BatchDecisionUpsert,
  type DecisionRepository,
  type DecisionValues,
} from "./service.js";

type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

export const resourceColumns = {
  resourceId: resources.id,
  resourceName: resources.name,
  resourceSlug: resources.slug,
  resourceType: resources.type,
  resourceSourceUrl: resources.sourceUrl,
  resourceArchivedAt: resources.archivedAt,
};

export type JoinedDecisionRow = {
  id: string;
  slot: string;
  mode: DecisionRecord["mode"];
  priority: number;
  constraints: Record<string, unknown>;
  rationale: string | null;
  conditions: Record<string, unknown>;
  updatedAt: Date;
  resourceId: string | null;
  resourceName: string | null;
  resourceSlug: string | null;
  resourceType: (typeof resources.$inferSelect)["type"] | null;
  resourceSourceUrl: string | null;
  resourceArchivedAt: Date | null;
};

export function toDecisionRecord(scope: DecisionScope, row: JoinedDecisionRow, origin: DecisionOrigin | null = null): DecisionRecord {
  return {
    id: row.id,
    scope,
    origin,
    slot: row.slot,
    mode: row.mode,
    resource: row.resourceId && row.resourceName && row.resourceSlug && row.resourceType
      ? {
          id: row.resourceId,
          name: row.resourceName,
          slug: row.resourceSlug,
          type: row.resourceType,
          sourceUrl: row.resourceSourceUrl,
          archivedAt: row.resourceArchivedAt?.toISOString() ?? null,
        }
      : null,
    priority: row.priority,
    constraints: row.constraints,
    rationale: row.rationale,
    conditions: row.conditions,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The same Profile may be attached directly and through the Recipe; keep the higher-ranked attachment. */
export function dedupeProfileDecisions(records: DecisionRecord[]): DecisionRecord[] {
  const byId = new Map<string, DecisionRecord>();
  for (const record of records) {
    const current = byId.get(record.id);
    if (!current || (record.origin?.priority ?? 0) > (current.origin?.priority ?? 0)) byId.set(record.id, record);
  }
  return [...byId.values()];
}

async function ownsProject(executor: Executor, ownerUserId: string, projectId: string) {
  const [row] = await executor
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
    .limit(1);
  return Boolean(row);
}

/** Every requested Resource must be active and owned; the first offending position is reported. */
export async function assertResourcesActive(executor: Executor, ownerUserId: string, requested: Array<string | null>) {
  const ids = [...new Set(requested.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const active = await executor
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.ownerUserId, ownerUserId), inArray(resources.id, ids), isNull(resources.archivedAt)));
  const allowed = new Set(active.map((row) => row.id));
  const offending = requested.findIndex((id) => id && !allowed.has(id));
  if (offending >= 0) throw resourceUnavailableError(requested.length === 1 ? undefined : offending);
}

function projectDecisionQuery(executor: Executor, ownerUserId: string, projectId: string) {
  // The Resource join is owner-scoped as well, so a decision can never surface
  // another user's Resource even if a row were tampered with.
  return executor
    .select({
      id: projectDecisions.id,
      slot: projectDecisions.slot,
      mode: projectDecisions.mode,
      priority: projectDecisions.priority,
      constraints: projectDecisions.constraints,
      rationale: projectDecisions.rationale,
      conditions: projectDecisions.conditions,
      updatedAt: projectDecisions.updatedAt,
      ...resourceColumns,
    })
    .from(projectDecisions)
    .innerJoin(projects, and(eq(projectDecisions.projectId, projects.id), eq(projects.ownerUserId, ownerUserId)))
    .leftJoin(resources, and(eq(projectDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
    .where(eq(projectDecisions.projectId, projectId))
    .orderBy(projectDecisions.slot);
}

const profileDecisionColumns = {
  id: profileDecisions.id,
  slot: profileDecisions.slot,
  mode: profileDecisions.mode,
  priority: profileDecisions.priority,
  constraints: profileDecisions.constraints,
  rationale: profileDecisions.rationale,
  conditions: profileDecisions.conditions,
  updatedAt: profileDecisions.updatedAt,
  profileId: profiles.id,
  profileName: profiles.name,
};

export function createDecisionRepository(database: RepositoryDatabase): DecisionRepository {
  return {
    projectExists(ownerUserId, projectId) {
      return ownsProject(database.db, ownerUserId, projectId);
    },

    async listProjectDecisions(ownerUserId, projectId) {
      const rows = await projectDecisionQuery(database.db, ownerUserId, projectId);
      return rows.map((row) => toDecisionRecord("project", row));
    },

    async listRecipeDecisions(ownerUserId, projectId) {
      const rows = await database.db
        .select({
          id: recipeDecisions.id,
          slot: recipeDecisions.slot,
          mode: recipeDecisions.mode,
          priority: recipeDecisions.priority,
          constraints: recipeDecisions.constraints,
          rationale: recipeDecisions.rationale,
          conditions: recipeDecisions.conditions,
          updatedAt: recipeDecisions.updatedAt,
          recipeId: recipes.id,
          recipeName: recipes.name,
          ...resourceColumns,
        })
        .from(projects)
        .innerJoin(recipes, and(eq(projects.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId)))
        .innerJoin(recipeDecisions, eq(recipeDecisions.recipeId, recipes.id))
        .leftJoin(resources, and(eq(recipeDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
        .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, ownerUserId)))
        .orderBy(recipeDecisions.slot);
      return rows.map((row) => toDecisionRecord("recipe", row, { id: row.recipeId, name: row.recipeName, priority: 0 }));
    },

    async listProfileDecisions(ownerUserId, projectId) {
      const [direct, viaRecipe] = await Promise.all([
        database.db
          .select({ ...profileDecisionColumns, attachmentPriority: projectProfiles.priority, ...resourceColumns })
          .from(projectProfiles)
          .innerJoin(projects, and(eq(projectProfiles.projectId, projects.id), eq(projects.ownerUserId, ownerUserId)))
          .innerJoin(profiles, and(eq(projectProfiles.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId)))
          .innerJoin(profileDecisions, eq(profileDecisions.profileId, profiles.id))
          .leftJoin(resources, and(eq(profileDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
          .where(eq(projectProfiles.projectId, projectId))
          .orderBy(profileDecisions.slot, profiles.name),
        database.db
          .select({ ...profileDecisionColumns, attachmentPriority: recipeProfiles.priority, ...resourceColumns })
          .from(projects)
          .innerJoin(recipes, and(eq(projects.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId)))
          .innerJoin(recipeProfiles, eq(recipeProfiles.recipeId, recipes.id))
          .innerJoin(profiles, and(eq(recipeProfiles.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId)))
          .innerJoin(profileDecisions, eq(profileDecisions.profileId, profiles.id))
          .leftJoin(resources, and(eq(profileDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
          .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, ownerUserId)))
          .orderBy(profileDecisions.slot, profiles.name),
      ]);
      return dedupeProfileDecisions([...direct, ...viaRecipe].map((row) =>
        toDecisionRecord("profile", row, { id: row.profileId, name: row.profileName, priority: row.attachmentPriority }),
      ));
    },

    async listGlobalDecisions(ownerUserId) {
      const rows = await database.db
        .select({
          id: globalDecisions.id,
          slot: globalDecisions.slot,
          mode: globalDecisions.mode,
          priority: globalDecisions.priority,
          constraints: globalDecisions.constraints,
          rationale: globalDecisions.rationale,
          conditions: globalDecisions.conditions,
          updatedAt: globalDecisions.updatedAt,
          ...resourceColumns,
        })
        .from(globalDecisions)
        .leftJoin(resources, and(eq(globalDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
        .where(eq(globalDecisions.ownerUserId, ownerUserId))
        .orderBy(globalDecisions.slot);
      return rows.map((row) => toDecisionRecord("global", row));
    },

    upsertProjectDecision(ownerUserId, projectId, slot, values: DecisionValues) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsProject(transaction, ownerUserId, projectId))) return null;
        await assertResourcesActive(transaction, ownerUserId, [values.resourceId]);
        await transaction
          .insert(projectDecisions)
          .values({ projectId, slot, ...values })
          .onConflictDoUpdate({
            target: [projectDecisions.projectId, projectDecisions.slot],
            set: { ...values, updatedAt: new Date() },
          });
        const rows = await projectDecisionQuery(transaction, ownerUserId, projectId);
        const row = rows.find((item) => item.slot === slot);
        return row ? toDecisionRecord("project", row) : null;
      });
    },

    deleteProjectDecision(ownerUserId, projectId, slot) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsProject(transaction, ownerUserId, projectId))) return false;
        const deleted = await transaction
          .delete(projectDecisions)
          .where(and(eq(projectDecisions.projectId, projectId), eq(projectDecisions.slot, slot)))
          .returning({ id: projectDecisions.id });
        return deleted.length > 0;
      });
    },

    batchProjectDecisions(ownerUserId, projectId, upserts: BatchDecisionUpsert[], removeSlots) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsProject(transaction, ownerUserId, projectId))) return false;
        await assertResourcesActive(transaction, ownerUserId, upserts.map((item) => item.values.resourceId));
        if (removeSlots.length > 0) {
          await transaction
            .delete(projectDecisions)
            .where(and(eq(projectDecisions.projectId, projectId), inArray(projectDecisions.slot, removeSlots)));
        }
        for (const { slot, values } of upserts) {
          await transaction
            .insert(projectDecisions)
            .values({ projectId, slot, ...values })
            .onConflictDoUpdate({
              target: [projectDecisions.projectId, projectDecisions.slot],
              set: { ...values, updatedAt: new Date() },
            });
        }
        return true;
      });
    },
  };
}
