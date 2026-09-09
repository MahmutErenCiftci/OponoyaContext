import type { DecisionInput, Scope } from "@devcontext/context-compiler";
import {
  and,
  compatibilityRules,
  contextVersions,
  desc,
  eq,
  exportEvents,
  globalDecisions,
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
  resources,
  sql,
  type Database,
} from "@devcontext/db";
import type { ContextRepository, ContextVersionRow, ExportEventRow } from "./service.js";

type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;
type DecisionRow = typeof projectDecisions.$inferSelect | typeof globalDecisions.$inferSelect | typeof profileDecisions.$inferSelect | typeof recipeDecisions.$inferSelect;

function toDecisionInput(scope: Scope, row: DecisionRow): DecisionInput {
  return {
    id: row.id,
    scope,
    slot: row.slot,
    mode: row.mode,
    resourceId: row.resourceId,
    priority: row.priority,
    constraints: row.constraints,
    rationale: row.rationale,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A Profile attached directly and through the Recipe contributes each decision once, at its higher attachment priority. */
function dedupeBySourcePriority(inputs: DecisionInput[]): DecisionInput[] {
  const byId = new Map<string, DecisionInput>();
  for (const input of inputs) {
    const current = byId.get(input.id);
    if (!current || (input.sourcePriority ?? 0) > (current.sourcePriority ?? 0)) byId.set(input.id, input);
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

const exportColumns = {
  id: exportEvents.id,
  target: exportEvents.target,
  metadata: exportEvents.metadata,
  createdAt: exportEvents.createdAt,
  contextVersion: contextVersions.version,
  contentHash: contextVersions.contentHash,
};

function exportQuery(executor: Executor) {
  return executor
    .select(exportColumns)
    .from(exportEvents)
    .leftJoin(contextVersions, eq(exportEvents.contextVersionId, contextVersions.id));
}

export function createContextRepository(database: Pick<Database, "db">): ContextRepository {
  return {
    projectExists(ownerUserId, projectId) {
      return ownsProject(database.db, ownerUserId, projectId);
    },

    async loadCompileInput(ownerUserId, projectId) {
      const [project] = await database.db
        .select()
        .from(projects)
        .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
        .limit(1);
      if (!project) return null;
      const [attached, projectRows, globalRows, profileRows, recipeRows, recipeProfileRows, ruleRows] = await Promise.all([
        database.db.select({ resourceId: projectResources.resourceId }).from(projectResources).where(eq(projectResources.projectId, projectId)),
        database.db.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId)),
        database.db.select().from(globalDecisions).where(eq(globalDecisions.ownerUserId, ownerUserId)),
        database.db
          .select({
            decision: profileDecisions,
            profileId: profiles.id,
            profileName: profiles.name,
            attachmentPriority: projectProfiles.priority,
          })
          .from(projectProfiles)
          .innerJoin(profiles, and(eq(projectProfiles.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId)))
          .innerJoin(profileDecisions, eq(profileDecisions.profileId, profiles.id))
          .where(eq(projectProfiles.projectId, projectId)),
        database.db
          .select({ decision: recipeDecisions, recipeId: recipes.id, recipeName: recipes.name })
          .from(projects)
          .innerJoin(recipes, and(eq(projects.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId)))
          .innerJoin(recipeDecisions, eq(recipeDecisions.recipeId, recipes.id))
          .where(eq(projects.id, projectId)),
        database.db
          .select({
            decision: profileDecisions,
            profileId: profiles.id,
            profileName: profiles.name,
            attachmentPriority: recipeProfiles.priority,
          })
          .from(projects)
          .innerJoin(recipes, and(eq(projects.recipeId, recipes.id), eq(recipes.ownerUserId, ownerUserId)))
          .innerJoin(recipeProfiles, eq(recipeProfiles.recipeId, recipes.id))
          .innerJoin(profiles, and(eq(recipeProfiles.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId)))
          .innerJoin(profileDecisions, eq(profileDecisions.profileId, profiles.id))
          .where(eq(projects.id, projectId)),
        database.db.select().from(compatibilityRules).where(eq(compatibilityRules.ownerUserId, ownerUserId)),
      ]);
      const allProfileRows = [...profileRows, ...recipeProfileRows];
      const resourceIds = [...new Set([
        ...attached.map((row) => row.resourceId),
        ...projectRows.flatMap((row) => row.resourceId ? [row.resourceId] : []),
        ...globalRows.flatMap((row) => row.resourceId ? [row.resourceId] : []),
        ...allProfileRows.flatMap((row) => row.decision.resourceId ? [row.decision.resourceId] : []),
        ...recipeRows.flatMap((row) => row.decision.resourceId ? [row.decision.resourceId] : []),
        ...ruleRows.flatMap((row) => [row.leftResourceId, row.rightResourceId]),
      ])];
      const resourceRows = resourceIds.length === 0 ? [] : await database.db
        .select()
        .from(resources)
        .where(and(eq(resources.ownerUserId, ownerUserId), inArray(resources.id, resourceIds)));
      return {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          productType: project.productType,
          stage: project.stage,
          platforms: project.platforms,
          priorities: project.priorities,
          rules: project.rules,
        },
        resources: resourceRows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          slug: row.slug,
          description: row.description,
          sourceUrl: row.sourceUrl,
          docsUrl: row.docsUrl,
          repoUrl: row.repoUrl,
          installCommand: row.installCommand,
          archivedAt: row.archivedAt?.toISOString() ?? null,
        })),
        attachedResourceIds: attached.map((row) => row.resourceId),
        globalDecisions: globalRows.map((row) => toDecisionInput("global", row)),
        profileDecisions: dedupeBySourcePriority(allProfileRows.map((row) => ({
          ...toDecisionInput("profile", row.decision),
          sourceId: row.profileId,
          sourceName: row.profileName,
          sourcePriority: row.attachmentPriority,
        }))),
        recipeDecisions: recipeRows.map((row) => ({
          ...toDecisionInput("recipe", row.decision),
          sourceId: row.recipeId,
          sourceName: row.recipeName,
          sourcePriority: 0,
        })),
        projectDecisions: projectRows.map((row) => toDecisionInput("project", row)),
        compatibilityRules: ruleRows.map((row) => ({
          id: row.id,
          kind: row.kind,
          leftResourceId: row.leftResourceId,
          rightResourceId: row.rightResourceId,
          note: row.note,
        })),
      };
    },

    async latestVersion(ownerUserId, projectId) {
      if (!(await ownsProject(database.db, ownerUserId, projectId))) return null;
      const [row] = await database.db
        .select()
        .from(contextVersions)
        .where(eq(contextVersions.projectId, projectId))
        .orderBy(desc(contextVersions.version))
        .limit(1);
      return row ?? null;
    },

    async listVersions(ownerUserId, projectId, limit) {
      if (!(await ownsProject(database.db, ownerUserId, projectId))) return [];
      return database.db
        .select()
        .from(contextVersions)
        .where(eq(contextVersions.projectId, projectId))
        .orderBy(desc(contextVersions.version))
        .limit(limit);
    },

    async findVersion(ownerUserId, projectId, version) {
      if (!(await ownsProject(database.db, ownerUserId, projectId))) return null;
      const [row] = await database.db
        .select()
        .from(contextVersions)
        .where(and(eq(contextVersions.projectId, projectId), eq(contextVersions.version, version)))
        .limit(1);
      return row ?? null;
    },

    createVersionIfChanged(ownerUserId, projectId, canonical, contentHash, compilerVersion) {
      return database.db.transaction(async (transaction) => {
        // Row lock on the Project serializes concurrent compiles, so version
        // numbers stay monotonic and duplicate hashes are suppressed reliably.
        const [locked] = await transaction
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
          .for("update");
        if (!locked) return null;
        const [latest] = await transaction
          .select()
          .from(contextVersions)
          .where(eq(contextVersions.projectId, projectId))
          .orderBy(desc(contextVersions.version))
          .limit(1);
        if (latest && latest.contentHash === contentHash) return { row: latest, created: false };
        const [inserted] = await transaction
          .insert(contextVersions)
          .values({ projectId, version: (latest?.version ?? 0) + 1, compilerVersion, canonical, contentHash })
          .returning();
        return { row: inserted!, created: true };
      });
    },

    recordExport(ownerUserId, projectId, contextVersionId, target, fileName, idempotencyKey) {
      return database.db.transaction(async (transaction) => {
        const [locked] = await transaction
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
          .for("update");
        if (!locked) return null;
        if (idempotencyKey) {
          const [existing] = await exportQuery(transaction)
            .where(and(eq(exportEvents.projectId, projectId), sql`${exportEvents.metadata} ->> 'idempotencyKey' = ${idempotencyKey}`))
            .limit(1);
          if (existing) return { row: existing as ExportEventRow, created: false };
        }
        const metadata: Record<string, unknown> = { fileName };
        if (idempotencyKey) metadata.idempotencyKey = idempotencyKey;
        const [inserted] = await transaction
          .insert(exportEvents)
          .values({ projectId, contextVersionId, target, metadata })
          .returning({ id: exportEvents.id });
        const [row] = await exportQuery(transaction).where(eq(exportEvents.id, inserted!.id)).limit(1);
        return { row: row as ExportEventRow, created: true };
      });
    },

    async listExports(ownerUserId, projectId, limit) {
      if (!(await ownsProject(database.db, ownerUserId, projectId))) return [];
      const rows = await exportQuery(database.db)
        .where(eq(exportEvents.projectId, projectId))
        .orderBy(desc(exportEvents.createdAt))
        .limit(limit);
      return rows as ExportEventRow[];
    },
  };
}

export type { ContextVersionRow };
