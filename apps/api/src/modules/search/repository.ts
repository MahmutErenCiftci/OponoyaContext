import type { SearchResult } from "@devcontext/contracts";
import { and, desc, eq, ilike, or, profiles, projects, recipes, resources, type Database } from "@devcontext/db";
import type { SearchRepository } from "./service.js";

/**
 * Owner-scoped substring search over names and descriptions. Data volumes in
 * V0.3 are small; `lower(name)` expression indexes (migration 0004) cover the
 * common prefix case and `pg_trgm` is the documented upgrade path once measured.
 */
export function createSearchRepository(database: Pick<Database, "db">): SearchRepository {
  return {
    async search(ownerUserId, query, limit) {
      const pattern = `%${query.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
      const [resourceRows, projectRows, profileRows, recipeRows] = await Promise.all([
        database.db
          .select({ id: resources.id, name: resources.name, type: resources.type, description: resources.description, archivedAt: resources.archivedAt, updatedAt: resources.updatedAt })
          .from(resources)
          .where(and(eq(resources.ownerUserId, ownerUserId), or(ilike(resources.name, pattern), ilike(resources.description, pattern))!))
          .orderBy(desc(resources.favorite), desc(resources.updatedAt))
          .limit(limit),
        database.db
          .select({ id: projects.id, name: projects.name, description: projects.description, status: projects.status, stage: projects.stage, updatedAt: projects.updatedAt })
          .from(projects)
          .where(and(eq(projects.ownerUserId, ownerUserId), or(ilike(projects.name, pattern), ilike(projects.description, pattern))!))
          .orderBy(desc(projects.updatedAt))
          .limit(limit),
        database.db
          .select({ id: profiles.id, name: profiles.name, type: profiles.type, description: profiles.description, archivedAt: profiles.archivedAt, updatedAt: profiles.updatedAt })
          .from(profiles)
          .where(and(eq(profiles.ownerUserId, ownerUserId), or(ilike(profiles.name, pattern), ilike(profiles.description, pattern))!))
          .orderBy(desc(profiles.updatedAt))
          .limit(limit),
        database.db
          .select({ id: recipes.id, name: recipes.name, description: recipes.description, updatedAt: recipes.updatedAt })
          .from(recipes)
          .where(and(eq(recipes.ownerUserId, ownerUserId), or(ilike(recipes.name, pattern), ilike(recipes.description, pattern))!))
          .orderBy(desc(recipes.updatedAt))
          .limit(limit),
      ]);
      const results: SearchResult[] = [
        ...resourceRows.map((row) => ({ kind: "resource" as const, id: row.id, name: row.name, subtitle: row.type, archived: row.archivedAt !== null, updatedAt: row.updatedAt.toISOString() })),
        ...projectRows.map((row) => ({ kind: "project" as const, id: row.id, name: row.name, subtitle: row.stage, archived: row.status === "archived", updatedAt: row.updatedAt.toISOString() })),
        ...profileRows.map((row) => ({ kind: "profile" as const, id: row.id, name: row.name, subtitle: row.type, archived: row.archivedAt !== null, updatedAt: row.updatedAt.toISOString() })),
        ...recipeRows.map((row) => ({ kind: "recipe" as const, id: row.id, name: row.name, subtitle: null, archived: false, updatedAt: row.updatedAt.toISOString() })),
      ];
      return results;
    },
  };
}
