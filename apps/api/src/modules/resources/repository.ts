import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "@devcontext/db";
import type { Resource } from "@devcontext/contracts";
import {
  globalDecisions,
  resources,
  resourceTags,
  tags,
  type RepositoryDatabase,
} from "@devcontext/db";
import type { ResourceRepository } from "./service.js";

type ResourceRow = typeof resources.$inferSelect;

function toResource(
  row: ResourceRow,
  tagNames: string[],
  preference: Resource["preference"],
): Resource {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
    sourceUrl: row.sourceUrl,
    docsUrl: row.docsUrl,
    repoUrl: row.repoUrl,
    installCommand: row.installCommand,
    notes: row.notes,
    metadata: row.metadata,
    tags: tagNames,
    preference,
    favorite: row.favorite,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createResourceRepository(database: RepositoryDatabase): ResourceRepository {
  async function decorate(ownerUserId: string, rows: ResourceRow[]): Promise<Resource[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [tagRows, preferenceRows] = await Promise.all([
      database.db
        .select({ resourceId: resourceTags.resourceId, name: tags.name })
        .from(resourceTags)
        .innerJoin(tags, eq(resourceTags.tagId, tags.id))
        .where(and(inArray(resourceTags.resourceId, ids), eq(tags.ownerUserId, ownerUserId)))
        .orderBy(tags.name),
      database.db
        .select({
          id: globalDecisions.id,
          resourceId: globalDecisions.resourceId,
          slot: globalDecisions.slot,
          mode: globalDecisions.mode,
        })
        .from(globalDecisions)
        .where(and(eq(globalDecisions.ownerUserId, ownerUserId), inArray(globalDecisions.resourceId, ids))),
    ]);
    const tagsByResource = new Map<string, string[]>();
    for (const item of tagRows) {
      const current = tagsByResource.get(item.resourceId) ?? [];
      current.push(item.name);
      tagsByResource.set(item.resourceId, current);
    }
    const preferencesByResource = new Map<string, Resource["preference"]>();
    for (const item of preferenceRows) {
      if (!item.resourceId || item.mode === "AI_DECIDE") continue;
      preferencesByResource.set(item.resourceId, { id: item.id, slot: item.slot, mode: item.mode });
    }
    return rows.map((row) => toResource(
      row,
      tagsByResource.get(row.id) ?? [],
      preferencesByResource.get(row.id) ?? null,
    ));
  }

  async function getById(ownerUserId: string, resourceId: string) {
    const [row] = await database.db
      .select()
      .from(resources)
      .where(and(eq(resources.ownerUserId, ownerUserId), eq(resources.id, resourceId)))
      .limit(1);
    if (!row) return null;
    return (await decorate(ownerUserId, [row]))[0] ?? null;
  }

  return {
    async list(ownerUserId, query) {
      const conditions = [eq(resources.ownerUserId, ownerUserId)];
      if (query.archived === "active") conditions.push(isNull(resources.archivedAt));
      if (query.archived === "archived") conditions.push(isNotNull(resources.archivedAt));
      if (query.type) conditions.push(eq(resources.type, query.type));
      if (query.favorite === "true") conditions.push(eq(resources.favorite, true));
      if (query.favorite === "false") conditions.push(eq(resources.favorite, false));
      if (query.q) {
        const pattern = `%${query.q}%`;
        conditions.push(or(
          ilike(resources.name, pattern),
          ilike(resources.description, pattern),
          ilike(resources.notes, pattern),
        )!);
      }
      if (query.tag) {
        const matchingIds = database.db
          .select({ id: resourceTags.resourceId })
          .from(resourceTags)
          .innerJoin(tags, eq(resourceTags.tagId, tags.id))
          .where(and(eq(tags.ownerUserId, ownerUserId), eq(tags.name, query.tag.toLowerCase())));
        conditions.push(inArray(resources.id, matchingIds));
      }
      if (query.preference) {
        const matchingIds = database.db
          .select({ id: globalDecisions.resourceId })
          .from(globalDecisions)
          .where(and(
            eq(globalDecisions.ownerUserId, ownerUserId),
            eq(globalDecisions.mode, query.preference),
            isNotNull(globalDecisions.resourceId),
          ));
        conditions.push(inArray(resources.id, matchingIds));
      }
      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        database.db
          .select()
          .from(resources)
          .where(where)
          .orderBy(desc(resources.favorite), desc(resources.updatedAt), resources.name)
          .limit(query.limit)
          .offset(query.offset),
        database.db.select({ value: count() }).from(resources).where(where),
      ]);
      return { resources: await decorate(ownerUserId, rows), total: totalRows[0]?.value ?? 0 };
    },

    findById: getById,

    async create(ownerUserId, resourceId, slug, input) {
      await database.db.transaction(async (transaction) => {
        await transaction.insert(resources).values({
          id: resourceId,
          ownerUserId,
          slug,
          name: input.name,
          type: input.type,
          description: input.description ?? null,
          sourceUrl: input.sourceUrl ?? null,
          docsUrl: input.docsUrl ?? null,
          repoUrl: input.repoUrl ?? null,
          installCommand: input.installCommand ?? null,
          notes: input.notes ?? null,
          metadata: input.metadata,
        });
        if (input.tags.length > 0) {
          await transaction.insert(tags).values(input.tags.map((name) => ({ ownerUserId, name })))
            .onConflictDoNothing({ target: [tags.ownerUserId, tags.name] });
          const tagRows = await transaction.select({ id: tags.id }).from(tags)
            .where(and(eq(tags.ownerUserId, ownerUserId), inArray(tags.name, input.tags)));
          if (tagRows.length > 0) {
            await transaction.insert(resourceTags).values(tagRows.map(({ id }) => ({
              resourceId,
              tagId: id,
            }))).onConflictDoNothing();
          }
        }
        if (input.preference) {
          await transaction.insert(globalDecisions).values({
            ownerUserId,
            resourceId,
            slot: input.preference.slot,
            mode: input.preference.mode,
          }).onConflictDoUpdate({
            target: [globalDecisions.ownerUserId, globalDecisions.slot],
            set: { resourceId, mode: input.preference.mode, updatedAt: new Date() },
          });
        }
      });
      return (await getById(ownerUserId, resourceId))!;
    },

    async update(ownerUserId, resourceId, input) {
      const existing = await getById(ownerUserId, resourceId);
      if (!existing) return null;
      await database.db.transaction(async (transaction) => {
        const values: Partial<typeof resources.$inferInsert> = { updatedAt: new Date() };
        if (input.name !== undefined) values.name = input.name;
        if (input.type !== undefined) values.type = input.type;
        if (input.description !== undefined) values.description = input.description;
        if (input.sourceUrl !== undefined) values.sourceUrl = input.sourceUrl;
        if (input.docsUrl !== undefined) values.docsUrl = input.docsUrl;
        if (input.repoUrl !== undefined) values.repoUrl = input.repoUrl;
        if (input.installCommand !== undefined) values.installCommand = input.installCommand;
        if (input.notes !== undefined) values.notes = input.notes;
        if (input.metadata !== undefined) values.metadata = input.metadata;
        if (input.favorite !== undefined) values.favorite = input.favorite;
        await transaction.update(resources).set(values)
          .where(and(eq(resources.ownerUserId, ownerUserId), eq(resources.id, resourceId)));

        if (input.tags !== undefined) {
          await transaction.delete(resourceTags).where(eq(resourceTags.resourceId, resourceId));
          if (input.tags.length > 0) {
            await transaction.insert(tags).values(input.tags.map((name) => ({ ownerUserId, name })))
              .onConflictDoNothing({ target: [tags.ownerUserId, tags.name] });
            const tagRows = await transaction.select({ id: tags.id }).from(tags)
              .where(and(eq(tags.ownerUserId, ownerUserId), inArray(tags.name, input.tags)));
            if (tagRows.length > 0) {
              await transaction.insert(resourceTags).values(tagRows.map(({ id }) => ({
                resourceId,
                tagId: id,
              }))).onConflictDoNothing();
            }
          }
        }

        if (input.preference !== undefined) {
          await transaction.delete(globalDecisions).where(and(
            eq(globalDecisions.ownerUserId, ownerUserId),
            eq(globalDecisions.resourceId, resourceId),
          ));
          if (input.preference) {
            await transaction.insert(globalDecisions).values({
              ownerUserId,
              resourceId,
              slot: input.preference.slot,
              mode: input.preference.mode,
            }).onConflictDoUpdate({
              target: [globalDecisions.ownerUserId, globalDecisions.slot],
              set: { resourceId, mode: input.preference.mode, updatedAt: new Date() },
            });
          }
        }
      });
      return getById(ownerUserId, resourceId);
    },

    async archive(ownerUserId, resourceId) {
      const existing = await getById(ownerUserId, resourceId);
      if (!existing) return null;
      await database.db.transaction(async (transaction) => {
        await transaction.delete(globalDecisions).where(and(
          eq(globalDecisions.ownerUserId, ownerUserId),
          eq(globalDecisions.resourceId, resourceId),
        ));
        await transaction.update(resources).set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(resources.ownerUserId, ownerUserId), eq(resources.id, resourceId)));
      });
      return getById(ownerUserId, resourceId);
    },

    async restore(ownerUserId, resourceId) {
      const [row] = await database.db.update(resources)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(and(eq(resources.ownerUserId, ownerUserId), eq(resources.id, resourceId)))
        .returning({ id: resources.id });
      if (!row) return null;
      return getById(ownerUserId, resourceId);
    },

    async listCatalogLinks(ownerUserId) {
      const rows = await database.db
        .select({ id: resources.id, metadata: resources.metadata, archivedAt: resources.archivedAt })
        .from(resources)
        .where(and(eq(resources.ownerUserId, ownerUserId), sql`${resources.metadata} ->> 'catalogSlug' is not null`))
        .orderBy(resources.createdAt);
      return rows.flatMap((row) => {
        const catalogSlug = row.metadata.catalogSlug;
        return typeof catalogSlug === "string" ? [{ catalogSlug, resourceId: row.id, archived: row.archivedAt !== null }] : [];
      });
    },
    async listDuplicateCandidates(ownerUserId, excludeResourceId) {
      return database.db
        .select({ id: resources.id, name: resources.name, type: resources.type, sourceUrl: resources.sourceUrl })
        .from(resources)
        .where(and(
          eq(resources.ownerUserId, ownerUserId),
          ne(resources.id, excludeResourceId),
          isNull(resources.archivedAt),
        ));
    },
  };
}
