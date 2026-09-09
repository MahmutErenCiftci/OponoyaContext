import { eq, workspaceSettings, type RepositoryDatabase } from "@devcontext/db";
import { createCompatibilityRepository } from "../compatibility/repository.js";
import { createCompatibilityService } from "../compatibility/service.js";
import { createDecisionRepository } from "../decisions/repository.js";
import { createDecisionService } from "../decisions/service.js";
import { createProfileRepository } from "../profiles/repository.js";
import { createProfileService } from "../profiles/service.js";
import { createProjectRepository } from "../projects/repository.js";
import { createProjectService } from "../projects/service.js";
import { createRecipeRepository } from "../recipes/repository.js";
import { createRecipeService } from "../recipes/service.js";
import { createResourceRepository } from "../resources/repository.js";
import { createResourceService } from "../resources/service.js";
import { createWorkspaceRepository } from "../workspace/repository.js";
import { createSampleRepository } from "./repository.js";
import type { SampleTransaction } from "./service.js";

/** One owner lock and transaction cover entity creation, decisions, tracking and settings. */
export function createSampleTransaction(database: RepositoryDatabase): SampleTransaction {
  return (ownerUserId, work) => database.db.transaction(async (transaction) => {
    await transaction.insert(workspaceSettings).values({ ownerUserId }).onConflictDoNothing();
    await transaction.select().from(workspaceSettings).where(eq(workspaceSettings.ownerUserId, ownerUserId)).for("update");
    const scoped = { db: transaction };
    return work({
      samples: createSampleRepository(scoped),
      workspace: createWorkspaceRepository(scoped),
      resources: createResourceService(createResourceRepository(scoped)),
      profiles: createProfileService(createProfileRepository(scoped)),
      recipes: createRecipeService(createRecipeRepository(scoped)),
      projects: createProjectService(createProjectRepository(scoped)),
      decisions: createDecisionService(createDecisionRepository(scoped)),
      compatibility: createCompatibilityService(createCompatibilityRepository(scoped)),
    });
  });
}
