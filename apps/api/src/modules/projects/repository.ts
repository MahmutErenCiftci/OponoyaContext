import type { Project, ProjectProfileAttachment, ProjectStage, ProjectStatus } from "@devcontext/contracts";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  profiles,
  projectDecisions,
  projectProfiles,
  projectResources,
  projects,
  recipes,
  resources,
  sql,
  type RepositoryDatabase, type Database,
} from "@devcontext/db";
import {
  unavailableProfilesError,
  unavailableRecipeError,
  unavailableResourcesError,
  type NewProjectRecord,
  type ProjectPatch,
  type ProjectRepository,
} from "./service.js";

type ProjectRow = typeof projects.$inferSelect;
type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

function toProject(row: ProjectRow, attached: Project["resources"], attachedProfiles: Project["profiles"], recipe: Project["recipe"]): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    productType: row.productType,
    // `stage`/`status` are plain text columns; only this API writes them and it
    // validates both against the shared enums first.
    stage: row.stage as ProjectStage,
    status: row.status as ProjectStatus,
    platforms: row.platforms,
    priorities: row.priorities,
    rules: row.rules,
    recipe,
    profiles: attachedProfiles,
    resources: attached,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function decorate(executor: Executor, ownerUserId: string, rows: ProjectRow[]): Promise<Project[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const recipeIds = [...new Set(rows.flatMap((row) => row.recipeId ? [row.recipeId] : []))];
  const [attachments, profileRows, recipeRows] = await Promise.all([
    executor
      .select({
        projectId: projectResources.projectId,
        attachedAt: projectResources.createdAt,
        id: resources.id,
        name: resources.name,
        slug: resources.slug,
        type: resources.type,
        sourceUrl: resources.sourceUrl,
        archivedAt: resources.archivedAt,
      })
      .from(projectResources)
      .innerJoin(resources, eq(projectResources.resourceId, resources.id))
      .where(and(inArray(projectResources.projectId, ids), eq(resources.ownerUserId, ownerUserId)))
      .orderBy(projectResources.createdAt, resources.name),
    executor
      .select({
        projectId: projectProfiles.projectId,
        priority: projectProfiles.priority,
        id: profiles.id,
        name: profiles.name,
        slug: profiles.slug,
        type: profiles.type,
        archivedAt: profiles.archivedAt,
      })
      .from(projectProfiles)
      .innerJoin(profiles, eq(projectProfiles.profileId, profiles.id))
      .where(and(inArray(projectProfiles.projectId, ids), eq(profiles.ownerUserId, ownerUserId)))
      .orderBy(desc(projectProfiles.priority), profiles.name),
    recipeIds.length === 0
      ? Promise.resolve([])
      : executor
        .select({ id: recipes.id, name: recipes.name, slug: recipes.slug, archivedAt: recipes.archivedAt })
        .from(recipes)
        .where(and(eq(recipes.ownerUserId, ownerUserId), inArray(recipes.id, recipeIds))),
  ]);
  const byProject = new Map<string, Project["resources"]>();
  for (const item of attachments) {
    const current = byProject.get(item.projectId) ?? [];
    current.push({
      id: item.id,
      name: item.name,
      slug: item.slug,
      type: item.type,
      sourceUrl: item.sourceUrl,
      archivedAt: item.archivedAt?.toISOString() ?? null,
      attachedAt: item.attachedAt.toISOString(),
    });
    byProject.set(item.projectId, current);
  }
  const profilesByProject = new Map<string, Project["profiles"]>();
  for (const item of profileRows) {
    const current = profilesByProject.get(item.projectId) ?? [];
    current.push({
      id: item.id,
      name: item.name,
      slug: item.slug,
      type: item.type,
      priority: item.priority,
      archivedAt: item.archivedAt?.toISOString() ?? null,
    });
    profilesByProject.set(item.projectId, current);
  }
  const recipeById = new Map(recipeRows.map((row) => [row.id, { id: row.id, name: row.name, slug: row.slug, archivedAt: row.archivedAt?.toISOString() ?? null }]));
  return rows.map((row) => toProject(
    row,
    byProject.get(row.id) ?? [],
    profilesByProject.get(row.id) ?? [],
    row.recipeId ? recipeById.get(row.recipeId) ?? null : null,
  ));
}

async function getById(executor: Executor, ownerUserId: string, projectId: string) {
  const [row] = await executor
    .select()
    .from(projects)
    .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
    .limit(1);
  if (!row) return null;
  return (await decorate(executor, ownerUserId, [row]))[0] ?? null;
}

/**
 * Rejects any requested ID that is not an active Resource of the owner unless it
 * is already attached (`retained`). Positions, not IDs, are reported.
 */
async function assertAttachable(executor: Executor, ownerUserId: string, requested: string[], retained: Set<string>) {
  const candidates = requested.filter((id) => !retained.has(id));
  if (candidates.length === 0) return;
  const active = await executor
    .select({ id: resources.id })
    .from(resources)
    .where(and(
      eq(resources.ownerUserId, ownerUserId),
      inArray(resources.id, candidates),
      isNull(resources.archivedAt),
    ));
  const allowed = new Set(active.map((row) => row.id));
  const rejected = requested.flatMap((id, index) => retained.has(id) || allowed.has(id) ? [] : [index]);
  if (rejected.length > 0) throw unavailableResourcesError(rejected);
}

async function assertProfilesAttachable(executor: Executor, ownerUserId: string, requested: ProjectProfileAttachment[], retained: Set<string>) {
  const candidates = requested.map((item) => item.profileId).filter((id) => !retained.has(id));
  if (candidates.length === 0) return;
  const active = await executor
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(
      eq(profiles.ownerUserId, ownerUserId),
      inArray(profiles.id, candidates),
      isNull(profiles.archivedAt),
    ));
  const allowed = new Set(active.map((row) => row.id));
  const rejected = requested.flatMap((item, index) => retained.has(item.profileId) || allowed.has(item.profileId) ? [] : [index]);
  if (rejected.length > 0) throw unavailableProfilesError(rejected);
}

/** A newly applied Recipe must be active and owned; the one already applied may stay even if archived later. */
async function assertRecipeApplicable(executor: Executor, ownerUserId: string, recipeId: string | null, retained: string | null) {
  if (!recipeId || recipeId === retained) return;
  const [row] = await executor
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.ownerUserId, ownerUserId), eq(recipes.id, recipeId), isNull(recipes.archivedAt)))
    .limit(1);
  if (!row) throw unavailableRecipeError();
}

async function replaceProfiles(executor: Executor, ownerUserId: string, projectId: string, requested: ProjectProfileAttachment[]) {
  const current = await executor
    .select({ profileId: projectProfiles.profileId })
    .from(projectProfiles)
    .where(eq(projectProfiles.projectId, projectId));
  const retained = new Set(current.map((row) => row.profileId));
  await assertProfilesAttachable(executor, ownerUserId, requested, retained);
  const next = new Set(requested.map((item) => item.profileId));
  const removed = [...retained].filter((id) => !next.has(id));
  if (removed.length > 0) {
    await executor
      .delete(projectProfiles)
      .where(and(eq(projectProfiles.projectId, projectId), inArray(projectProfiles.profileId, removed)));
  }
  if (requested.length > 0) {
    await executor
      .insert(projectProfiles)
      .values(requested.map((item) => ({ projectId, profileId: item.profileId, priority: item.priority })))
      .onConflictDoUpdate({
        target: [projectProfiles.projectId, projectProfiles.profileId],
        set: { priority: sql`excluded.priority` },
      });
  }
}

export function createProjectRepository(database: RepositoryDatabase): ProjectRepository {
  return {
    async list(ownerUserId, query) {
      const conditions = [eq(projects.ownerUserId, ownerUserId)];
      if (query.status !== "all") conditions.push(eq(projects.status, query.status));
      if (query.stage) conditions.push(eq(projects.stage, query.stage));
      if (query.q) {
        const pattern = `%${query.q}%`;
        conditions.push(or(
          ilike(projects.name, pattern),
          ilike(projects.description, pattern),
          ilike(projects.productType, pattern),
        )!);
      }
      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        database.db
          .select()
          .from(projects)
          .where(where)
          .orderBy(desc(projects.updatedAt), projects.name)
          .limit(query.limit)
          .offset(query.offset),
        database.db.select({ value: count() }).from(projects).where(where),
      ]);
      return { projects: await decorate(database.db, ownerUserId, rows), total: totalRows[0]?.value ?? 0 };
    },

    findById(ownerUserId, projectId) {
      return getById(database.db, ownerUserId, projectId);
    },

    create(ownerUserId, record: NewProjectRecord, resourceIds, attachedProfiles) {
      return database.db.transaction(async (transaction) => {
        await assertRecipeApplicable(transaction, ownerUserId, record.recipeId, null);
        const inserted = await transaction
          .insert(projects)
          .values({
            id: record.id,
            ownerUserId,
            clientRequestId: record.clientRequestId,
            recipeId: record.recipeId,
            slug: record.slug,
            name: record.name,
            description: record.description,
            productType: record.productType,
            stage: record.stage,
            platforms: record.platforms,
            priorities: record.priorities,
            rules: record.rules,
          })
          .onConflictDoNothing({ target: [projects.ownerUserId, projects.clientRequestId] })
          .returning({ id: projects.id });
        const insertedId = inserted[0]?.id;
        if (!insertedId) {
          const [existing] = await transaction
            .select()
            .from(projects)
            .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.clientRequestId, record.clientRequestId)))
            .limit(1);
          if (!existing) throw new Error("Project create conflicted without a matching request record");
          const [project] = await decorate(transaction, ownerUserId, [existing]);
          return { project: project!, created: false };
        }
        await assertAttachable(transaction, ownerUserId, resourceIds, new Set());
        if (resourceIds.length > 0) {
          await transaction
            .insert(projectResources)
            .values(resourceIds.map((resourceId) => ({ projectId: insertedId, resourceId })))
            .onConflictDoNothing();
        }
        if (attachedProfiles.length > 0) await replaceProfiles(transaction, ownerUserId, insertedId, attachedProfiles);
        const project = await getById(transaction, ownerUserId, insertedId);
        return { project: project!, created: true };
      });
    },

    update(ownerUserId, projectId, patch: ProjectPatch, resourceIds, attachedProfiles) {
      return database.db.transaction(async (transaction) => {
        const [existing] = await transaction
          .select({ id: projects.id, recipeId: projects.recipeId })
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
          .limit(1);
        if (!existing) return null;
        const values: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
        if (patch.name !== undefined) values.name = patch.name;
        if (patch.description !== undefined) values.description = patch.description;
        if (patch.productType !== undefined) values.productType = patch.productType;
        if (patch.stage !== undefined) values.stage = patch.stage;
        if (patch.platforms !== undefined) values.platforms = patch.platforms;
        if (patch.priorities !== undefined) values.priorities = patch.priorities;
        if (patch.rules !== undefined) values.rules = patch.rules;
        if (patch.recipeId !== undefined) {
          await assertRecipeApplicable(transaction, ownerUserId, patch.recipeId, existing.recipeId);
          values.recipeId = patch.recipeId;
        }
        await transaction
          .update(projects)
          .set(values)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)));

        if (resourceIds !== undefined) {
          const current = await transaction
            .select({ resourceId: projectResources.resourceId })
            .from(projectResources)
            .where(eq(projectResources.projectId, projectId));
          const retained = new Set(current.map((row) => row.resourceId));
          await assertAttachable(transaction, ownerUserId, resourceIds, retained);
          const next = new Set(resourceIds);
          const removed = [...retained].filter((id) => !next.has(id));
          const added = resourceIds.filter((id) => !retained.has(id));
          if (removed.length > 0) {
            await transaction
              .delete(projectResources)
              .where(and(eq(projectResources.projectId, projectId), inArray(projectResources.resourceId, removed)));
          }
          if (added.length > 0) {
            await transaction
              .insert(projectResources)
              .values(added.map((resourceId) => ({ projectId, resourceId })))
              .onConflictDoNothing();
          }
        }
        if (attachedProfiles !== undefined) await replaceProfiles(transaction, ownerUserId, projectId, attachedProfiles);
        return getById(transaction, ownerUserId, projectId);
      });
    },

    clone(ownerUserId, projectId, record) {
      return database.db.transaction(async (transaction) => {
        const [source] = await transaction
          .select()
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
          .limit(1);
        if (!source) return null;
        const name = (record.name ?? `Copy of ${source.name}`).slice(0, 160);
        const slug = record.name ? record.slug : `${source.slug.replace(/-[a-f0-9]{8}$/, "")}-copy-${record.id.slice(0, 8)}`.slice(0, 160);
        const inserted = await transaction
          .insert(projects)
          .values({
            id: record.id,
            ownerUserId,
            clientRequestId: record.clientRequestId,
            recipeId: source.recipeId,
            slug,
            name,
            description: source.description,
            productType: source.productType,
            stage: source.stage,
            status: "active",
            platforms: source.platforms,
            priorities: source.priorities,
            rules: source.rules,
          })
          .onConflictDoNothing({ target: [projects.ownerUserId, projects.clientRequestId] })
          .returning({ id: projects.id });
        const insertedId = inserted[0]?.id;
        if (!insertedId) {
          const [existing] = await transaction
            .select()
            .from(projects)
            .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.clientRequestId, record.clientRequestId)))
            .limit(1);
          if (!existing) throw new Error("Project clone conflicted without a matching request record");
          const [project] = await decorate(transaction, ownerUserId, [existing]);
          return { project: project!, created: false };
        }
        // Owner scoping is inherited from the source rows: every copied row already
        // belongs to this Project, so no foreign entity can be referenced.
        const [attachments, attachedProfiles, decisions] = await Promise.all([
          transaction.select({ resourceId: projectResources.resourceId }).from(projectResources).where(eq(projectResources.projectId, projectId)),
          transaction.select({ profileId: projectProfiles.profileId, priority: projectProfiles.priority }).from(projectProfiles).where(eq(projectProfiles.projectId, projectId)),
          transaction.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId)),
        ]);
        if (attachments.length > 0) {
          await transaction.insert(projectResources).values(attachments.map((row) => ({ projectId: insertedId, resourceId: row.resourceId }))).onConflictDoNothing();
        }
        if (attachedProfiles.length > 0) {
          await transaction.insert(projectProfiles).values(attachedProfiles.map((row) => ({ projectId: insertedId, profileId: row.profileId, priority: row.priority }))).onConflictDoNothing();
        }
        if (decisions.length > 0) {
          await transaction.insert(projectDecisions).values(decisions.map((row) => ({
            projectId: insertedId,
            slot: row.slot,
            mode: row.mode,
            resourceId: row.resourceId,
            priority: row.priority,
            constraints: row.constraints,
            rationale: row.rationale,
            conditions: row.conditions,
          }))).onConflictDoNothing();
        }
        const project = await getById(transaction, ownerUserId, insertedId);
        return { project: project!, created: true };
      });
    },

    async setStatus(ownerUserId, projectId, status) {
      const [row] = await database.db
        .update(projects)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
        .returning({ id: projects.id });
      if (!row) return null;
      return getById(database.db, ownerUserId, projectId);
    },
  };
}
