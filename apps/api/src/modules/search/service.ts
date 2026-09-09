import type { SearchResult } from "@devcontext/contracts";

export interface SearchRepository {
  search(ownerUserId: string, query: string, limit: number): Promise<SearchResult[]>;
}

export interface SearchService {
  search(ownerUserId: string, query: string, limit: number): Promise<{ query: string; results: SearchResult[] }>;
}

const kindOrder: Record<SearchResult["kind"], number> = { resource: 0, project: 1, profile: 2, recipe: 3 };

/**
 * Ranks exact, prefix and substring name matches before description-only hits,
 * active before archived, then Resources → Projects → Profiles → Recipes, then
 * most recently updated.
 */
export function rankResults(query: string, results: SearchResult[]): SearchResult[] {
  const needle = query.trim().toLowerCase();
  const score = (result: SearchResult) => {
    const name = result.name.toLowerCase();
    let value = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : 3;
    if (result.archived) value += 4;
    return value;
  };
  return [...results].sort((a, b) =>
    score(a) - score(b)
    || kindOrder[a.kind] - kindOrder[b.kind]
    || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0),
  );
}

export function createSearchService(repository: SearchRepository): SearchService {
  return {
    async search(ownerUserId, query, limit) {
      const trimmed = query.trim();
      return { query: trimmed, results: rankResults(trimmed, await repository.search(ownerUserId, trimmed, limit)) };
    },
  };
}
