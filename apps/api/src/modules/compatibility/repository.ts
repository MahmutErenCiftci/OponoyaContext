import type { CompatibilityRule } from "@devcontext/contracts";
import { aliasedTable, and, compatibilityRules, desc, eq, inArray, isNull, or, resources, type RepositoryDatabase, type Database } from "@devcontext/db";
import { ruleResourceUnavailableError, type CompatibilityRepository } from "./service.js";

type Executor = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

const left = aliasedTable(resources, "left_resource");
const right = aliasedTable(resources, "right_resource");

function ruleQuery(executor: Executor, ownerUserId: string) {
  return executor
    .select({
      id: compatibilityRules.id,
      kind: compatibilityRules.kind,
      note: compatibilityRules.note,
      createdAt: compatibilityRules.createdAt,
      leftId: left.id,
      leftName: left.name,
      leftSlug: left.slug,
      leftType: left.type,
      leftSourceUrl: left.sourceUrl,
      leftArchivedAt: left.archivedAt,
      rightId: right.id,
      rightName: right.name,
      rightSlug: right.slug,
      rightType: right.type,
      rightSourceUrl: right.sourceUrl,
      rightArchivedAt: right.archivedAt,
    })
    .from(compatibilityRules)
    .innerJoin(left, and(eq(compatibilityRules.leftResourceId, left.id), eq(left.ownerUserId, ownerUserId)))
    .innerJoin(right, and(eq(compatibilityRules.rightResourceId, right.id), eq(right.ownerUserId, ownerUserId)));
}

type RuleRow = Awaited<ReturnType<ReturnType<typeof ruleQuery>["execute"]>>[number];

function toRule(row: RuleRow): CompatibilityRule {
  return {
    id: row.id,
    kind: row.kind,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    left: { id: row.leftId, name: row.leftName, slug: row.leftSlug, type: row.leftType, sourceUrl: row.leftSourceUrl, archivedAt: row.leftArchivedAt?.toISOString() ?? null },
    right: { id: row.rightId, name: row.rightName, slug: row.rightSlug, type: row.rightType, sourceUrl: row.rightSourceUrl, archivedAt: row.rightArchivedAt?.toISOString() ?? null },
  };
}

export function createCompatibilityRepository(database: RepositoryDatabase): CompatibilityRepository {
  return {
    async list(ownerUserId, resourceId, limit) {
      const conditions = [eq(compatibilityRules.ownerUserId, ownerUserId)];
      if (resourceId) conditions.push(or(eq(compatibilityRules.leftResourceId, resourceId), eq(compatibilityRules.rightResourceId, resourceId))!);
      const rows = await ruleQuery(database.db, ownerUserId)
        .where(and(...conditions))
        .orderBy(desc(compatibilityRules.createdAt))
        .limit(limit);
      return rows.map(toRule);
    },

    create(ownerUserId, input) {
      return database.db.transaction(async (transaction) => {
        const active = await transaction
          .select({ id: resources.id })
          .from(resources)
          .where(and(
            eq(resources.ownerUserId, ownerUserId),
            inArray(resources.id, [input.leftResourceId, input.rightResourceId]),
            isNull(resources.archivedAt),
          ));
        const allowed = new Set(active.map((row) => row.id));
        if (!allowed.has(input.leftResourceId)) throw ruleResourceUnavailableError("leftResourceId");
        if (!allowed.has(input.rightResourceId)) throw ruleResourceUnavailableError("rightResourceId");
        const inserted = await transaction
          .insert(compatibilityRules)
          .values({
            ownerUserId,
            kind: input.kind,
            leftResourceId: input.leftResourceId,
            rightResourceId: input.rightResourceId,
            note: input.note ?? null,
          })
          .onConflictDoNothing({ target: [compatibilityRules.ownerUserId, compatibilityRules.leftResourceId, compatibilityRules.rightResourceId, compatibilityRules.kind] })
          .returning({ id: compatibilityRules.id });
        const created = inserted.length > 0;
        const [row] = await ruleQuery(transaction, ownerUserId)
          .where(and(
            eq(compatibilityRules.ownerUserId, ownerUserId),
            eq(compatibilityRules.leftResourceId, input.leftResourceId),
            eq(compatibilityRules.rightResourceId, input.rightResourceId),
            eq(compatibilityRules.kind, input.kind),
          ))
          .limit(1);
        return { rule: toRule(row!), created };
      });
    },

    async remove(ownerUserId, ruleId) {
      const deleted = await database.db
        .delete(compatibilityRules)
        .where(and(eq(compatibilityRules.ownerUserId, ownerUserId), eq(compatibilityRules.id, ruleId)))
        .returning({ id: compatibilityRules.id });
      return deleted.length > 0;
    },
  };
}
