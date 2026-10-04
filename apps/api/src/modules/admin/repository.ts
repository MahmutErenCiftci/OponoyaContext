import { feedbackStatusSchema, type AdminOverview } from "@devcontext/contracts";
import {
  accountDeletions,
  and,
  auditEvents,
  contextVersions,
  count,
  countDistinct,
  desc,
  eq,
  exportEvents,
  feedback,
  gte,
  inArray,
  profiles,
  projects,
  readAll,
  recipes,
  resources,
  sessions,
  sql,
  subscriptions,
  users,
  workspaceSamples,
  type RepositoryDatabase,
  type SQL,
} from "@devcontext/db";

/** Daily buckets follow the web app's display zone (`displayTimeZone` in apps/web/lib/resource-labels.ts). */
export const adminTimeZone = "Europe/Istanbul";
const zoneLiteral = sql.raw(`'${adminTimeZone}'`);
const dayMs = 86_400_000;
const chartDays = 30;
const recentUserLimit = 25;

export interface AdminRepository {
  /** Counts across every account; only the operator route calls this. */
  overview(now?: Date): Promise<AdminOverview>;
}

/** "YYYY-MM-DD" of an instant in the admin time zone. */
function zonedDate(instant: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: adminTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** The last `chartDays` calendar days ending today (admin time zone), oldest first. */
function chartDates(now: Date) {
  const today = Date.parse(`${zonedDate(now)}T00:00:00Z`);
  return Array.from({ length: chartDays }, (_, index) => new Date(today - (chartDays - 1 - index) * dayMs).toISOString().slice(0, 10));
}

/**
 * Correlated subqueries name every column through an alias: Drizzle renders
 * interpolated columns unqualified inside a single-table select, so a bare
 * `${users.id}` inside `select … from sessions` would silently mean
 * `sessions.id`. `outerUserId` is the qualified `"users"."id"` of the outer row.
 */
const column = (target: { name: string }) => sql.identifier(target.name);
const outerUserId = sql`${users}.${column(users.id)}`;

/** Leaves out rows the sample set installed, so funnel steps count the user's own work. */
function notSample(target: SQL | typeof resources.id | typeof projects.id, entityType: "resource" | "project") {
  return sql`${target} not in (select ws.${column(workspaceSamples.entityId)} from ${workspaceSamples} ws where ws.${column(workspaceSamples.entityType)} = ${entityType})`;
}

/** Signed in, used a session (Better Auth refreshes it daily) or recorded an audited change since `since`. */
function activeSince(since: Date) {
  const iso = since.toISOString();
  return sql`exists (select 1 from ${sessions} s where s.${column(sessions.userId)} = ${outerUserId} and s.${column(sessions.updatedAt)} >= ${iso})
    or exists (select 1 from ${auditEvents} a where a.${column(auditEvents.actorUserId)} = ${outerUserId} and a.${column(auditEvents.createdAt)} >= ${iso})`;
}

function countWhere(condition: SQL) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
}

export function createAdminRepository(database: RepositoryDatabase): AdminRepository {
  const { db } = database;

  return {
    async overview(now = new Date()) {
      const ago = (days: number) => new Date(now.getTime() - days * dayMs);
      const signupDay = sql<string>`to_char(${users.createdAt} at time zone ${zoneLiteral}, 'YYYY-MM-DD')`;
      const repeatOwners = db
        .select({ ownerUserId: projects.ownerUserId })
        .from(projects)
        .where(notSample(projects.id, "project"))
        .groupBy(projects.ownerUserId)
        .having(sql`count(*) >= 2`)
        .as("repeat_owners");

      const [
        userRows, dailyRows, deletedRows,
        resourceOwners, projectOwners, compileOwners, exportOwners, repeatRows,
        projectRows, resourceRows, profileRows, recipeRows, versionRows, exportRows,
        sampleRows, proRows, recentRows, feedbackRows,
      ] = await readAll(db, [
        () => db.select({
          total: count(),
          last24h: countWhere(sql`${users.createdAt} >= ${ago(1).toISOString()}`),
          last7d: countWhere(sql`${users.createdAt} >= ${ago(7).toISOString()}`),
          last30d: countWhere(sql`${users.createdAt} >= ${ago(30).toISOString()}`),
          active7d: countWhere(activeSince(ago(7))),
          active30d: countWhere(activeSince(ago(30))),
        }).from(users),
        // One day of slack: the oldest bucket starts at local midnight, up to a day before `now - 30d`.
        () => db.select({ day: signupDay, value: count() }).from(users).where(gte(users.createdAt, ago(chartDays + 1))).groupBy(signupDay),
        () => db.select({ value: count() }).from(accountDeletions).where(eq(accountDeletions.status, "completed")),
        () => db.select({ value: countDistinct(resources.ownerUserId) }).from(resources).where(notSample(resources.id, "resource")),
        () => db.select({ value: countDistinct(projects.ownerUserId) }).from(projects).where(notSample(projects.id, "project")),
        () => db.select({ value: countDistinct(projects.ownerUserId) }).from(contextVersions).innerJoin(projects, eq(contextVersions.projectId, projects.id)),
        () => db.select({ value: countDistinct(projects.ownerUserId) }).from(exportEvents).innerJoin(projects, eq(exportEvents.projectId, projects.id)),
        () => db.select({ value: count() }).from(repeatOwners),
        () => db.select({ value: count() }).from(projects),
        () => db.select({ value: count() }).from(resources),
        () => db.select({ value: count() }).from(profiles),
        () => db.select({ value: count() }).from(recipes),
        () => db.select({ value: count() }).from(contextVersions),
        () => db.select({ value: count() }).from(exportEvents),
        () => db.select({ value: countDistinct(workspaceSamples.ownerUserId) }).from(workspaceSamples),
        () => db.select({ value: count() }).from(subscriptions).where(and(eq(subscriptions.plan, "pro"), inArray(subscriptions.status, ["active", "trialing"]))),
        () => db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          // Rendered as ISO text in SQL so the value never depends on a driver's timestamp parsing.
          lastSeenAt: sql<string | null>`(select to_char(max(s.${column(sessions.updatedAt)}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from ${sessions} s where s.${column(sessions.userId)} = ${outerUserId})`,
          projects: sql<number>`(select count(*) from ${projects} p where p.${column(projects.ownerUserId)} = ${outerUserId} and ${notSample(sql`p.${column(projects.id)}`, "project")})`.mapWith(Number),
        }).from(users).orderBy(desc(users.createdAt), desc(users.id)).limit(recentUserLimit),
        () => db.select({ status: feedback.status, value: count() }).from(feedback).groupBy(feedback.status),
      ]);

      const summary = userRows[0];
      const perDay = new Map(dailyRows.map((row) => [row.day, row.value]));
      const perStatus = new Map(feedbackRows.map((row) => [row.status, row.value]));
      return {
        generatedAt: now.toISOString(),
        timeZone: adminTimeZone,
        users: {
          total: summary?.total ?? 0,
          last24h: summary?.last24h ?? 0,
          last7d: summary?.last7d ?? 0,
          last30d: summary?.last30d ?? 0,
          active7d: summary?.active7d ?? 0,
          active30d: summary?.active30d ?? 0,
          deleted: deletedRows[0]?.value ?? 0,
        },
        signupsByDay: chartDates(now).map((date) => ({ date, count: perDay.get(date) ?? 0 })),
        funnel: {
          signedUp: summary?.total ?? 0,
          addedResource: resourceOwners[0]?.value ?? 0,
          createdProject: projectOwners[0]?.value ?? 0,
          compiledContext: compileOwners[0]?.value ?? 0,
          exportedContext: exportOwners[0]?.value ?? 0,
          secondProject: repeatRows[0]?.value ?? 0,
        },
        totals: {
          projects: projectRows[0]?.value ?? 0,
          resources: resourceRows[0]?.value ?? 0,
          profiles: profileRows[0]?.value ?? 0,
          recipes: recipeRows[0]?.value ?? 0,
          contextVersions: versionRows[0]?.value ?? 0,
          exports: exportRows[0]?.value ?? 0,
          sampleInstalls: sampleRows[0]?.value ?? 0,
          proSubscriptions: proRows[0]?.value ?? 0,
        },
        feedback: Object.fromEntries(feedbackStatusSchema.options.map((status) => [status, perStatus.get(status) ?? 0])) as AdminOverview["feedback"],
        recentUsers: recentRows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          createdAt: row.createdAt.toISOString(),
          lastSeenAt: row.lastSeenAt,
          projects: row.projects,
        })),
      };
    },
  };
}
