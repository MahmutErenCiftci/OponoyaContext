import { eq, workspaceSettings, type RepositoryDatabase } from "@devcontext/db";
import { createProfileRepository } from "../profiles/repository.js";
import { createProfileService } from "../profiles/service.js";
import { createResourceRepository } from "../resources/repository.js";
import { createResourceService } from "../resources/service.js";
import type { CatalogTransaction } from "./service.js";

/**
 * One transaction per catalog write, holding the same per-owner lock as sample
 * install: adding a stack (and its Profile) is all-or-nothing, and concurrent
 * requests of one owner run one after another instead of racing on the
 * "already in your Library" check.
 */
export function createCatalogTransaction(database: RepositoryDatabase): CatalogTransaction {
  return (ownerUserId, work) => database.db.transaction(async (transaction) => {
    await transaction.insert(workspaceSettings).values({ ownerUserId }).onConflictDoNothing();
    await transaction.select({ ownerUserId: workspaceSettings.ownerUserId }).from(workspaceSettings).where(eq(workspaceSettings.ownerUserId, ownerUserId)).for("update");
    const scoped = { db: transaction };
    return work({
      resources: createResourceService(createResourceRepository(scoped)),
      profiles: createProfileService(createProfileRepository(scoped)),
    });
  });
}
