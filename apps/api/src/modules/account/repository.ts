import {
  accountDeletions,
  aiSuggestions,
  compatibilityRules,
  contextVersions,
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
  type Table,
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
  aiSuggestions: number;
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

  return {
    async createdAt(userId) {
      const [row] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
      return row?.createdAt ?? null;
    },

    /**
     * One statement of counts: one connection and one consistent snapshot
     * instead of fifteen parallel queries. Column references are written as
     * aliased identifiers because Drizzle renders interpolated columns
     * unqualified inside a single-table select, which PostgreSQL rejects as
     * ambiguous (`id`, `owner_user_id`) in the joined subqueries.
     */
    async counts(userId) {
      const column = (name: { name: string }) => sql.identifier(name.name);
      const owned = (table: Table, owner: { name: string }) =>
        sql<number>`(select count(*) from ${table} t where t.${column(owner)} = ${userId})`.mapWith(Number);
      const viaParent = (table: Table, parentKey: { name: string }, parent: Table, parentOwner: { name: string }) =>
        sql<number>`(select count(*) from ${table} c inner join ${parent} p on p.id = c.${column(parentKey)} where p.${column(parentOwner)} = ${userId})`.mapWith(Number);
      const [row] = await db.select({
        resources: owned(resources, resources.ownerUserId),
        tags: owned(tags, tags.ownerUserId),
        profiles: owned(profiles, profiles.ownerUserId),
        recipes: owned(recipes, recipes.ownerUserId),
        projects: owned(projects, projects.ownerUserId),
        globalDecisions: owned(globalDecisions, globalDecisions.ownerUserId),
        profileDecisions: viaParent(profileDecisions, profileDecisions.profileId, profiles, profiles.ownerUserId),
        recipeDecisions: viaParent(recipeDecisions, recipeDecisions.recipeId, recipes, recipes.ownerUserId),
        projectDecisions: viaParent(projectDecisions, projectDecisions.projectId, projects, projects.ownerUserId),
        compatibilityRules: owned(compatibilityRules, compatibilityRules.ownerUserId),
        contextVersions: viaParent(contextVersions, contextVersions.projectId, projects, projects.ownerUserId),
        exports: viaParent(exportEvents, exportEvents.projectId, projects, projects.ownerUserId),
        auditEvents: owned(auditEvents, auditEvents.actorUserId),
        importRequests: owned(importRequests, importRequests.ownerUserId),
        aiSuggestions: owned(aiSuggestions, aiSuggestions.ownerUserId),
        sessions: owned(sessions, sessions.userId),
      }).from(users).where(eq(users.id, userId)).limit(1);
      return {
        resources: row?.resources ?? 0,
        tags: row?.tags ?? 0,
        profiles: row?.profiles ?? 0,
        recipes: row?.recipes ?? 0,
        projects: row?.projects ?? 0,
        decisions: (row?.globalDecisions ?? 0) + (row?.profileDecisions ?? 0) + (row?.recipeDecisions ?? 0) + (row?.projectDecisions ?? 0),
        compatibilityRules: row?.compatibilityRules ?? 0,
        contextVersions: row?.contextVersions ?? 0,
        exports: row?.exports ?? 0,
        auditEvents: row?.auditEvents ?? 0,
        importRequests: row?.importRequests ?? 0,
        aiSuggestions: row?.aiSuggestions ?? 0,
        sessions: row?.sessions ?? 0,
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
