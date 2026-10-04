import type { AdminFeedback, CreateFeedbackInput, Feedback, FeedbackKind, FeedbackStatus } from "@devcontext/contracts";
import { and, desc, eq, feedback, gte, users, type RepositoryDatabase } from "@devcontext/db";

/** A second identical message from the same user inside this window is a double submit, not a new report. */
const duplicateWindowMs = 60_000;

export interface FeedbackRepository {
  /** Stores a report; `created` is false when an identical recent report was returned instead. */
  create(userId: string, input: CreateFeedbackInput): Promise<{ feedback: Feedback; created: boolean }>;
  /** The author's own reports, newest first. */
  listOwn(userId: string, limit: number): Promise<Feedback[]>;
  /** Operator view across every account, newest first. */
  listAll(query: { status: FeedbackStatus | "all"; limit: number }): Promise<AdminFeedback[]>;
  /** Null when the report does not exist. */
  setStatus(id: string, status: FeedbackStatus): Promise<Feedback | null>;
}

export function toFeedback(row: typeof feedback.$inferSelect): Feedback {
  return {
    id: row.id,
    // Text columns written only by this API after contract validation.
    kind: row.kind as FeedbackKind,
    message: row.message,
    pagePath: row.pagePath,
    status: row.status as FeedbackStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createFeedbackRepository(database: RepositoryDatabase): FeedbackRepository {
  const { db } = database;

  return {
    async create(userId, input) {
      const [recent] = await db.select().from(feedback).where(and(
        eq(feedback.userId, userId),
        eq(feedback.kind, input.kind),
        eq(feedback.message, input.message),
        gte(feedback.createdAt, new Date(Date.now() - duplicateWindowMs)),
      )).orderBy(desc(feedback.createdAt)).limit(1);
      if (recent) return { feedback: toFeedback(recent), created: false };
      const [row] = await db.insert(feedback).values({
        userId,
        kind: input.kind,
        message: input.message,
        pagePath: input.pagePath ?? null,
      }).returning();
      return { feedback: toFeedback(row!), created: true };
    },

    async listOwn(userId, limit) {
      const rows = await db.select().from(feedback).where(eq(feedback.userId, userId)).orderBy(desc(feedback.createdAt), desc(feedback.id)).limit(limit);
      return rows.map(toFeedback);
    },

    async listAll({ status, limit }) {
      const rows = await db
        .select({ entry: feedback, user: { id: users.id, name: users.name, email: users.email } })
        .from(feedback)
        .innerJoin(users, eq(feedback.userId, users.id))
        .where(status === "all" ? undefined : eq(feedback.status, status))
        .orderBy(desc(feedback.createdAt), desc(feedback.id))
        .limit(limit);
      return rows.map((row) => ({ ...toFeedback(row.entry), user: row.user }));
    },

    async setStatus(id, status) {
      const [row] = await db.update(feedback).set({ status, updatedAt: new Date() }).where(eq(feedback.id, id)).returning();
      return row ? toFeedback(row) : null;
    },
  };
}
