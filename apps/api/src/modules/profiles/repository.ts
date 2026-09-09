import type { Profile, ProfileSummary } from "@devcontext/contracts";
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
  profileDecisions,
  profiles,
  projectDecisions,
  projectProfiles,
  projects,
  resources,
  type RepositoryDatabase, type Database,
} from "@devcontext/db";
import { assertResourcesActive, resourceColumns, toDecisionRecord } from "../decisions/repository.js";
import type { DecisionValues } from "../decisions/service.js";
import { idempotencyKeyConflictError, type ProfileRepository } from "./service.js";

type ProfileRow = typeof profiles.$inferSelect;
type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

function toSummary(row: ProfileRow, decisionCount: number, projectCount: number): ProfileSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
    decisionCount,
    projectCount,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countsFor(executor: Executor, ids: string[]) {
  if (ids.length === 0) return { decisions: new Map<string, number>(), projects: new Map<string, number>() };
  const [decisionRows, projectRows] = await Promise.all([
    executor
      .select({ profileId: profileDecisions.profileId, value: count() })
      .from(profileDecisions)
      .where(inArray(profileDecisions.profileId, ids))
      .groupBy(profileDecisions.profileId),
    executor
      .select({ profileId: projectProfiles.profileId, value: count() })
      .from(projectProfiles)
      .where(inArray(projectProfiles.profileId, ids))
      .groupBy(projectProfiles.profileId),
  ]);
  return {
    decisions: new Map(decisionRows.map((row) => [row.profileId, row.value])),
    projects: new Map(projectRows.map((row) => [row.profileId, row.value])),
  };
}

function decisionQuery(executor: Executor, ownerUserId: string, profileId: string) {
  return executor
    .select({
      id: profileDecisions.id,
      slot: profileDecisions.slot,
      mode: profileDecisions.mode,
      priority: profileDecisions.priority,
      constraints: profileDecisions.constraints,
      rationale: profileDecisions.rationale,
      conditions: profileDecisions.conditions,
      updatedAt: profileDecisions.updatedAt,
      ...resourceColumns,
    })
    .from(profileDecisions)
    .innerJoin(profiles, and(eq(profileDecisions.profileId, profiles.id), eq(profiles.ownerUserId, ownerUserId)))
    .leftJoin(resources, and(eq(profileDecisions.resourceId, resources.id), eq(resources.ownerUserId, ownerUserId)))
    .where(eq(profileDecisions.profileId, profileId))
    .orderBy(profileDecisions.slot);
}

async function getById(executor: Executor, ownerUserId: string, profileId: string): Promise<Profile | null> {
  const [row] = await executor
    .select()
    .from(profiles)
    .where(and(eq(profiles.ownerUserId, ownerUserId), eq(profiles.id, profileId)))
    .limit(1);
  if (!row) return null;
  const [decisionRows, counts] = await Promise.all([decisionQuery(executor, ownerUserId, profileId), countsFor(executor, [row.id])]);
  const origin = { id: row.id, name: row.name, priority: 0 };
  return {
    ...toSummary(row, counts.decisions.get(row.id) ?? 0, counts.projects.get(row.id) ?? 0),
    decisions: decisionRows.map((decision) => toDecisionRecord("profile", decision, origin)),
  };
}

async function ownsProfile(executor: Executor, ownerUserId: string, profileId: string) {
  const [row] = await executor
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.ownerUserId, ownerUserId), eq(profiles.id, profileId)))
    .limit(1);
  return Boolean(row);
}

export function createProfileRepository(database: RepositoryDatabase): ProfileRepository {
  return {
    async list(ownerUserId, query) {
      const conditions = [eq(profiles.ownerUserId, ownerUserId)];
      if (query.archived === "active") conditions.push(isNull(profiles.archivedAt));
      if (query.archived === "archived") conditions.push(isNotNull(profiles.archivedAt));
      if (query.type) conditions.push(eq(profiles.type, query.type));
      if (query.q) {
        const pattern = `%${query.q}%`;
        conditions.push(or(ilike(profiles.name, pattern), ilike(profiles.description, pattern))!);
      }
      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        database.db.select().from(profiles).where(where).orderBy(desc(profiles.updatedAt), profiles.name).limit(query.limit).offset(query.offset),
        database.db.select({ value: count() }).from(profiles).where(where),
      ]);
      const counts = await countsFor(database.db, rows.map((row) => row.id));
      return {
        profiles: rows.map((row) => toSummary(row, counts.decisions.get(row.id) ?? 0, counts.projects.get(row.id) ?? 0)),
        total: totalRows[0]?.value ?? 0,
      };
    },

    findById(ownerUserId, profileId) {
      return getById(database.db, ownerUserId, profileId);
    },

    async create(ownerUserId, profileId, slug, input) {
      await database.db.insert(profiles).values({
        id: profileId,
        ownerUserId,
        slug,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
      });
      return (await getById(database.db, ownerUserId, profileId))!;
    },

    async update(ownerUserId, profileId, input) {
      const values: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) values.name = input.name;
      if (input.type !== undefined) values.type = input.type;
      if (input.description !== undefined) values.description = input.description;
      const [row] = await database.db
        .update(profiles)
        .set(values)
        .where(and(eq(profiles.ownerUserId, ownerUserId), eq(profiles.id, profileId)))
        .returning({ id: profiles.id });
      if (!row) return null;
      return getById(database.db, ownerUserId, profileId);
    },

    async setArchived(ownerUserId, profileId, archived) {
      const [row] = await database.db
        .update(profiles)
        .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
        .where(and(eq(profiles.ownerUserId, ownerUserId), eq(profiles.id, profileId)))
        .returning({ id: profiles.id });
      if (!row) return null;
      return getById(database.db, ownerUserId, profileId);
    },

    upsertDecision(ownerUserId, profileId, slot, values: DecisionValues) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsProfile(transaction, ownerUserId, profileId))) return null;
        await assertResourcesActive(transaction, ownerUserId, [values.resourceId]);
        await transaction
          .insert(profileDecisions)
          .values({ profileId, slot, ...values })
          .onConflictDoUpdate({
            target: [profileDecisions.profileId, profileDecisions.slot],
            set: { ...values, updatedAt: new Date() },
          });
        await transaction.update(profiles).set({ updatedAt: new Date() }).where(eq(profiles.id, profileId));
        const profile = await getById(transaction, ownerUserId, profileId);
        return profile?.decisions.find((decision) => decision.slot === slot) ?? null;
      });
    },

    createFromProject(ownerUserId, projectId, profileId, slug, input) {
      return database.db.transaction(async (transaction) => {
        const [project] = await transaction
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId)))
          .limit(1);
        if (!project) return null;
        // A replayed key repeats the id and the id-derived slug, so a concurrent
        // replay can trip the slug index before the id index is checked; any
        // conflict therefore means "already created", not an error.
        const inserted = await transaction
          .insert(profiles)
          .values({ id: profileId, ownerUserId, slug, name: input.name, type: input.type, description: input.description ?? null })
          .onConflictDoNothing()
          .returning({ id: profiles.id });
        if (inserted.length === 0) {
          const existing = await getById(transaction, ownerUserId, profileId);
          if (!existing) throw idempotencyKeyConflictError();
          return { profile: existing, created: false };
        }
        const decisions = await transaction.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId));
        if (decisions.length > 0) {
          await transaction.insert(profileDecisions).values(decisions.map((row) => ({
            profileId,
            slot: row.slot,
            mode: row.mode,
            resourceId: row.resourceId,
            priority: row.priority,
            constraints: row.constraints,
            rationale: row.rationale,
            conditions: row.conditions,
          }))).onConflictDoNothing();
        }
        const profile = await getById(transaction, ownerUserId, profileId);
        return { profile: profile!, created: true };
      });
    },

    deleteDecision(ownerUserId, profileId, slot) {
      return database.db.transaction(async (transaction) => {
        if (!(await ownsProfile(transaction, ownerUserId, profileId))) return null;
        const deleted = await transaction
          .delete(profileDecisions)
          .where(and(eq(profileDecisions.profileId, profileId), eq(profileDecisions.slot, slot)))
          .returning({ id: profileDecisions.id });
        if (deleted.length > 0) await transaction.update(profiles).set({ updatedAt: new Date() }).where(eq(profiles.id, profileId));
        return deleted.length > 0;
      });
    },
  };
}
