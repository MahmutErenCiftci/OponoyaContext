import {
  accountDeletions,
  compatibilityRules,
  contextVersions,
  count,
  desc,
  eq,
  exportEvents,
  globalDecisions,
  importRequests,
  auditEvents,
  profileDecisions,
  profiles,
  projectDecisions,
  projects,
  recipeDecisions,
  recipes,
  resources,
  sessions,
  sql,
  tags,
  users,
  type RepositoryDatabase,
} from "@devcontext/db";

export type DeletionRow = typeof accountDeletions.$inferSelect;

/** Row counts shown on the privacy page: every table that holds something the user created or caused. */
export type StoredCounts = {
  resources: number;
  tags: number;
  profiles: number;
  recipes: number;
  projects: number;
  decisions: number;
  compatibilityRules: number;
  contextVersions: number;
  exports: number;
  auditEvents: number;
  importRequests: number;
  sessions: number;
};

export type ContextVersionRow = {
  projectId: string;
  projectName: string;
  version: number;
  compilerVersion: string;
  contentHash: string;
  createdAt: Date;
  canonical: Record<string, unknown>;
};

export type ExportRow = { projectId: string; target: string; createdAt: Date };

export type CompletedBilling = {
  provider: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  plan: string;
  status: string;
  revokedAt: Date | null;
};

export interface AccountRepository {
  createdAt(userId: string): Promise<Date | null>;
  counts(userId: string): Promise<StoredCounts>;
  contextVersions(userId: string): Promise<ContextVersionRow[]>;
  exports(userId: string): Promise<ExportRow[]>;
  deletion(userId: string): Promise<DeletionRow | null>;
  /** Creates the ledger row or records one more attempt on the existing one. */
  beginAttempt(userId: string, requestId: string): Promise<DeletionRow>;
  /** The external step failed; the row keeps the content-free code so the UI can explain and offer a retry. */
  markExternalPending(userId: string, code: string): Promise<DeletionRow>;
  /** The user row is gone; what remains is the minimal billing record. */
  markCompleted(userId: string, billing: CompletedBilling): Promise<DeletionRow>;
}

export function createAccountRepository(database: RepositoryDatabase): AccountRepository {
  const db = database.db;

  async function countOf(query: Promise<Array<{ value: number }>>) {
    const [row] = await query;
    return row?.value ?? 0;
  }

  return {
    async createdAt(userId) {
      const [row] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
      return row?.createdAt ?? null;
    },

    async counts(userId) {
      const [
        resourceCount, tagCount, profileCount, recipeCount, projectCount,
        globalCount, profileDecisionCount, recipeDecisionCount, projectDecisionCount,
        ruleCount, versionCount, exportCount, auditCount, importCount, sessionCount,
      ] = await Promise.all([
        countOf(db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(tags).where(eq(tags.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(profiles).where(eq(profiles.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(recipes).where(eq(recipes.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(projects).where(eq(projects.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(globalDecisions).where(eq(globalDecisions.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(profileDecisions).innerJoin(profiles, eq(profileDecisions.profileId, profiles.id)).where(eq(profiles.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(recipeDecisions).innerJoin(recipes, eq(recipeDecisions.recipeId, recipes.id)).where(eq(recipes.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(projectDecisions).innerJoin(projects, eq(projectDecisions.projectId, projects.id)).where(eq(projects.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(compatibilityRules).where(eq(compatibilityRules.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(contextVersions).innerJoin(projects, eq(contextVersions.projectId, projects.id)).where(eq(projects.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(exportEvents).innerJoin(projects, eq(exportEvents.projectId, projects.id)).where(eq(projects.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(auditEvents).where(eq(auditEvents.actorUserId, userId))),
        countOf(db.select({ value: count() }).from(importRequests).where(eq(importRequests.ownerUserId, userId))),
        countOf(db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId))),
      ]);
      return {
        resources: resourceCount,
        tags: tagCount,
        profiles: profileCount,
        recipes: recipeCount,
        projects: projectCount,
        decisions: globalCount + profileDecisionCount + recipeDecisionCount + projectDecisionCount,
        compatibilityRules: ruleCount,
        contextVersions: versionCount,
        exports: exportCount,
        auditEvents: auditCount,
        importRequests: importCount,
        sessions: sessionCount,
      };
    },

    async contextVersions(userId) {
      const rows = await db
        .select({
          projectId: contextVersions.projectId,
          projectName: projects.name,
          version: contextVersions.version,
          compilerVersion: contextVersions.compilerVersion,
          contentHash: contextVersions.contentHash,
          createdAt: contextVersions.createdAt,
          canonical: contextVersions.canonical,
        })
        .from(contextVersions)
        .innerJoin(projects, eq(contextVersions.projectId, projects.id))
        .where(eq(projects.ownerUserId, userId))
        .orderBy(projects.name, contextVersions.version);
      return rows;
    },

    async exports(userId) {
      return db
        .select({ projectId: exportEvents.projectId, target: exportEvents.target, createdAt: exportEvents.createdAt })
        .from(exportEvents)
        .innerJoin(projects, eq(exportEvents.projectId, projects.id))
        .where(eq(projects.ownerUserId, userId))
        .orderBy(desc(exportEvents.createdAt));
    },

    async deletion(userId) {
      const [row] = await db.select().from(accountDeletions).where(eq(accountDeletions.userId, userId)).limit(1);
      return row ?? null;
    },

    async beginAttempt(userId, requestId) {
      const now = new Date();
      const [row] = await db
        .insert(accountDeletions)
        .values({ userId, status: "requested", attempts: 1, lastAttemptAt: now, requestId })
        .onConflictDoUpdate({
          target: accountDeletions.userId,
          set: { status: "requested", attempts: sql`${accountDeletions.attempts} + 1`, lastAttemptAt: now, lastError: null, requestId },
        })
        .returning();
      return row!;
    },

    async markExternalPending(userId, code) {
      const [row] = await db
        .update(accountDeletions)
        .set({ status: "pending_external", lastError: code })
        .where(eq(accountDeletions.userId, userId))
        .returning();
      return row!;
    },

    async markCompleted(userId, billing) {
      const [row] = await db
        .update(accountDeletions)
        .set({
          status: "completed",
          lastError: null,
          completedAt: new Date(),
          billingProvider: billing.provider,
          billingCustomerId: billing.customerId,
          billingSubscriptionId: billing.subscriptionId,
          billingPlan: billing.plan,
          billingStatus: billing.status,
          billingRevokedAt: billing.revokedAt,
        })
        .where(eq(accountDeletions.userId, userId))
        .returning();
      return row!;
    },
  };
}
