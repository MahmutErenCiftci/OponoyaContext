import type { AiProviderId, AiSuggestionKind, AiSuggestionStatus, ResourceReference, ResourceType } from "@devcontext/contracts";
import {
  aiSuggestions,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  projects,
  resources,
  resourceTags,
  tags,
  workspaceSettings,
  type RepositoryDatabase,
} from "@devcontext/db";

export type AiSuggestionRow = {
  id: string;
  ownerUserId: string;
  projectId: string;
  kind: AiSuggestionKind;
  slot: string;
  status: AiSuggestionStatus;
  provider: AiProviderId;
  model: string;
  inputHash: string;
  proposal: Record<string, unknown>;
  warnings: Array<Record<string, unknown>>;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
  decidedAt: Date | null;
};

/** `createdAt` comes from the service clock so the stored time and the quota window agree. */
export type NewAiSuggestion = Omit<AiSuggestionRow, "id" | "status" | "decidedAt">;

export type CandidateRow = {
  id: string;
  name: string;
  type: ResourceType;
  description: string | null;
  favorite: boolean;
  tags: string[];
};

export type ProposalProject = {
  id: string;
  name: string;
  description: string | null;
  productType: string | null;
  stage: string;
  status: string;
  platforms: string[];
  priorities: string[];
  rules: string[];
};

export interface AiRepository {
  consent(ownerUserId: string): Promise<Date | null>;
  setConsent(ownerUserId: string, at: Date | null): Promise<Date | null>;
  /** Suggestions created since `since` (the monthly quota window). */
  countSince(ownerUserId: string, since: Date): Promise<number>;
  project(ownerUserId: string, projectId: string): Promise<ProposalProject | null>;
  /** Active Library Resources, favorites first then by name, with tags. */
  candidates(ownerUserId: string, limit: number): Promise<CandidateRow[]>;
  findPending(ownerUserId: string, projectId: string, slot: string, inputHash: string): Promise<AiSuggestionRow | null>;
  insert(row: NewAiSuggestion): Promise<AiSuggestionRow>;
  get(ownerUserId: string, suggestionId: string): Promise<AiSuggestionRow | null>;
  list(ownerUserId: string, projectId: string, status: AiSuggestionStatus | null, limit: number): Promise<AiSuggestionRow[]>;
  listAll(ownerUserId: string): Promise<AiSuggestionRow[]>;
  /** Moves a suggestion out of `from`; null when it was not in that state (a concurrent accept/reject won). */
  transition(ownerUserId: string, suggestionId: string, from: AiSuggestionStatus, to: AiSuggestionStatus, at: Date): Promise<AiSuggestionRow | null>;
  /** Owner-scoped references for display; missing or foreign ids are simply absent. */
  resourceReferences(ownerUserId: string, ids: string[]): Promise<ResourceReference[]>;
}

type Row = typeof aiSuggestions.$inferSelect;

function toRow(row: Row): AiSuggestionRow {
  return {
    ...row,
    // Text columns written only by this module after contract validation.
    kind: row.kind as AiSuggestionKind,
    status: row.status as AiSuggestionStatus,
    provider: row.provider as AiProviderId,
  };
}

export function createAiRepository(database: RepositoryDatabase): AiRepository {
  const { db } = database;
  return {
    async consent(ownerUserId) {
      const [row] = await db.select({ at: workspaceSettings.aiConsentAt }).from(workspaceSettings).where(eq(workspaceSettings.ownerUserId, ownerUserId)).limit(1);
      return row?.at ?? null;
    },

    async setConsent(ownerUserId, at) {
      await db.insert(workspaceSettings)
        .values({ ownerUserId, aiConsentAt: at })
        .onConflictDoUpdate({ target: workspaceSettings.ownerUserId, set: { aiConsentAt: at, updatedAt: new Date() } });
      return at;
    },

    async countSince(ownerUserId, since) {
      const [row] = await db.select({ value: count() }).from(aiSuggestions)
        .where(and(eq(aiSuggestions.ownerUserId, ownerUserId), gte(aiSuggestions.createdAt, since)));
      return row?.value ?? 0;
    },

    async project(ownerUserId, projectId) {
      const [row] = await db.select().from(projects).where(and(eq(projects.ownerUserId, ownerUserId), eq(projects.id, projectId))).limit(1);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        productType: row.productType,
        stage: row.stage,
        status: row.status,
        platforms: row.platforms,
        priorities: row.priorities,
        rules: row.rules,
      };
    },

    async candidates(ownerUserId, limit) {
      const rows = await db.select({
        id: resources.id, name: resources.name, type: resources.type, description: resources.description, favorite: resources.favorite,
      })
        .from(resources)
        .where(and(eq(resources.ownerUserId, ownerUserId), isNull(resources.archivedAt)))
        .orderBy(desc(resources.favorite), asc(resources.name), asc(resources.id))
        .limit(limit);
      if (rows.length === 0) return [];
      const tagRows = await db.select({ resourceId: resourceTags.resourceId, name: tags.name })
        .from(resourceTags)
        .innerJoin(tags, and(eq(resourceTags.tagId, tags.id), eq(tags.ownerUserId, ownerUserId)))
        .where(inArray(resourceTags.resourceId, rows.map((row) => row.id)))
        .orderBy(asc(tags.name));
      const byResource = new Map<string, string[]>();
      for (const tag of tagRows) byResource.set(tag.resourceId, [...(byResource.get(tag.resourceId) ?? []), tag.name]);
      return rows.map((row) => ({ ...row, tags: byResource.get(row.id) ?? [] }));
    },

    async findPending(ownerUserId, projectId, slot, inputHash) {
      const [row] = await db.select().from(aiSuggestions).where(and(
        eq(aiSuggestions.ownerUserId, ownerUserId),
        eq(aiSuggestions.projectId, projectId),
        eq(aiSuggestions.slot, slot),
        eq(aiSuggestions.inputHash, inputHash),
        eq(aiSuggestions.status, "pending"),
      )).orderBy(desc(aiSuggestions.createdAt)).limit(1);
      return row ? toRow(row) : null;
    },

    async insert(row) {
      const [inserted] = await db.insert(aiSuggestions).values(row).returning();
      return toRow(inserted!);
    },

    async get(ownerUserId, suggestionId) {
      const [row] = await db.select().from(aiSuggestions)
        .where(and(eq(aiSuggestions.ownerUserId, ownerUserId), eq(aiSuggestions.id, suggestionId))).limit(1);
      return row ? toRow(row) : null;
    },

    async list(ownerUserId, projectId, status, limit) {
      const conditions = [eq(aiSuggestions.ownerUserId, ownerUserId), eq(aiSuggestions.projectId, projectId)];
      if (status) conditions.push(eq(aiSuggestions.status, status));
      const rows = await db.select().from(aiSuggestions).where(and(...conditions))
        .orderBy(desc(aiSuggestions.createdAt), desc(aiSuggestions.id)).limit(limit);
      return rows.map(toRow);
    },

    async listAll(ownerUserId) {
      const rows = await db.select().from(aiSuggestions).where(eq(aiSuggestions.ownerUserId, ownerUserId))
        .orderBy(asc(aiSuggestions.createdAt), asc(aiSuggestions.id));
      return rows.map(toRow);
    },

    async transition(ownerUserId, suggestionId, from, to, at) {
      const [row] = await db.update(aiSuggestions)
        .set({ status: to, decidedAt: at })
        .where(and(eq(aiSuggestions.ownerUserId, ownerUserId), eq(aiSuggestions.id, suggestionId), eq(aiSuggestions.status, from)))
        .returning();
      return row ? toRow(row) : null;
    },

    async resourceReferences(ownerUserId, ids) {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return [];
      const rows = await db.select({
        id: resources.id, name: resources.name, slug: resources.slug, type: resources.type, sourceUrl: resources.sourceUrl, archivedAt: resources.archivedAt,
      }).from(resources).where(and(eq(resources.ownerUserId, ownerUserId), inArray(resources.id, unique)));
      return rows.map((row) => ({ ...row, archivedAt: row.archivedAt?.toISOString() ?? null }));
    },
  };
}
