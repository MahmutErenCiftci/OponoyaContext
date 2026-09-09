import type { OnboardingChoice, OnboardingState, WorkspaceSummary } from "@devcontext/contracts";
import {
  and,
  contextVersions,
  count,
  countDistinct,
  eq,
  exportEvents,
  isNull,
  profiles,
  projects,
  resources,
  workspaceSettings,
  type RepositoryDatabase,
} from "@devcontext/db";

export type WorkspaceSettingsRow = {
  onboardingState: OnboardingState;
  onboardingChoice: OnboardingChoice | null;
  sampleVersion: string | null;
  sampleInstalledAt: string | null;
};

export interface WorkspaceRepository {
  summary(ownerUserId: string): Promise<WorkspaceSummary>;
  /** Creates the default row on first read so every user has a settings record. */
  settings(ownerUserId: string): Promise<WorkspaceSettingsRow>;
  updateOnboarding(ownerUserId: string, state: OnboardingState, choice: OnboardingChoice | null | undefined): Promise<WorkspaceSettingsRow>;
  setSamples(ownerUserId: string, version: string | null): Promise<WorkspaceSettingsRow>;
}

function toSettingsRow(row: typeof workspaceSettings.$inferSelect): WorkspaceSettingsRow {
  return {
    // Text columns written only by this API after contract validation.
    onboardingState: row.onboardingState as OnboardingState,
    onboardingChoice: row.onboardingChoice as OnboardingChoice | null,
    sampleVersion: row.sampleVersion,
    sampleInstalledAt: row.sampleInstalledAt?.toISOString() ?? null,
  };
}

/** Owner-scoped counts for the dashboard and onboarding checklist, plus per-user settings. */
export function createWorkspaceRepository(database: RepositoryDatabase): WorkspaceRepository {
  async function ensureSettings(ownerUserId: string) {
    await database.db.insert(workspaceSettings).values({ ownerUserId }).onConflictDoNothing();
    const [row] = await database.db.select().from(workspaceSettings).where(eq(workspaceSettings.ownerUserId, ownerUserId)).limit(1);
    return toSettingsRow(row!);
  }

  return {
    settings(ownerUserId) {
      return ensureSettings(ownerUserId);
    },

    async updateOnboarding(ownerUserId, state, choice) {
      await ensureSettings(ownerUserId);
      const values: Partial<typeof workspaceSettings.$inferInsert> = { onboardingState: state, updatedAt: new Date() };
      if (choice !== undefined) values.onboardingChoice = choice;
      await database.db.update(workspaceSettings).set(values).where(eq(workspaceSettings.ownerUserId, ownerUserId));
      return ensureSettings(ownerUserId);
    },

    async setSamples(ownerUserId, version) {
      await ensureSettings(ownerUserId);
      await database.db
        .update(workspaceSettings)
        .set({ sampleVersion: version, sampleInstalledAt: version ? new Date() : null, updatedAt: new Date() })
        .where(eq(workspaceSettings.ownerUserId, ownerUserId));
      return ensureSettings(ownerUserId);
    },

    async summary(ownerUserId) {
      const [resourceRows, favoriteRows, projectRows, profileRows, versionRows, exportRows] = await Promise.all([
        database.db.select({ value: count() }).from(resources).where(and(eq(resources.ownerUserId, ownerUserId), isNull(resources.archivedAt))),
        database.db.select({ value: count() }).from(resources).where(and(eq(resources.ownerUserId, ownerUserId), isNull(resources.archivedAt), eq(resources.favorite, true))),
        database.db.select({ value: count() }).from(projects).where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.status, "active"))),
        database.db.select({ value: count() }).from(profiles).where(and(eq(profiles.ownerUserId, ownerUserId), isNull(profiles.archivedAt))),
        database.db
          .select({ versions: count(), projects: countDistinct(contextVersions.projectId) })
          .from(contextVersions)
          .innerJoin(projects, and(eq(contextVersions.projectId, projects.id), eq(projects.ownerUserId, ownerUserId))),
        database.db
          .select({ value: count() })
          .from(exportEvents)
          .innerJoin(projects, and(eq(exportEvents.projectId, projects.id), eq(projects.ownerUserId, ownerUserId))),
      ]);
      return {
        resources: resourceRows[0]?.value ?? 0,
        favorites: favoriteRows[0]?.value ?? 0,
        projects: projectRows[0]?.value ?? 0,
        profiles: profileRows[0]?.value ?? 0,
        compiledProjects: versionRows[0]?.projects ?? 0,
        contextVersions: versionRows[0]?.versions ?? 0,
        exports: exportRows[0]?.value ?? 0,
      };
    },
  };
}
