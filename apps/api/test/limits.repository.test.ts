import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { portableLimits } from "@devcontext/contracts";
import { compatibilityRules, profileDecisions, profiles, projectDecisions, projects, recipeDecisions, recipes, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createCompatibilityRepository } from "../src/modules/compatibility/repository.js";
import { createCompatibilityService } from "../src/modules/compatibility/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService } from "../src/modules/decisions/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService } from "../src/modules/profiles/service.js";
import { createRecipeRepository } from "../src/modules/recipes/repository.js";
import { createRecipeService } from "../src/modules/recipes/service.js";

const owner = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000030";
const profileId = "00000000-0000-4000-8000-000000000040";
const recipeId = "00000000-0000-4000-8000-000000000050";
const left = "00000000-0000-4000-8000-000000000010";
const right = "00000000-0000-4000-8000-000000000011";
const limit = portableLimits.decisionsPerEntity;
const delegated = { mode: "AI_DECIDE" as const, resourceId: null, priority: 0, constraints: {}, rationale: null, conditions: {} };
const slots = Array.from({ length: limit }, (_, index) => `custom.slot_${index}`);
const row = (slot: string) => ({ slot, mode: "AI_DECIDE" as const, resourceId: null });

let database: Pick<Database, "db" | "close">;

beforeAll(async () => {
  database = await createTestDatabase();
  await database.db.insert(users).values({ id: owner, email: "a@example.test", name: "Owner A" });
  await database.db.insert(resources).values([
    { id: left, ownerUserId: owner, name: "Left", slug: "left", type: "framework" },
    { id: right, ownerUserId: owner, name: "Right", slug: "right", type: "framework" },
  ]);
  await database.db.insert(projects).values({ id: projectId, ownerUserId: owner, name: "Atlas", slug: "atlas" });
  await database.db.insert(profiles).values({ id: profileId, ownerUserId: owner, name: "Stack", slug: "stack", type: "stack" });
  await database.db.insert(recipes).values({ id: recipeId, ownerUserId: owner, name: "Recipe", slug: "recipe" });
  await database.db.insert(projectDecisions).values(slots.map((slot) => ({ projectId, ...row(slot) })));
  await database.db.insert(profileDecisions).values(slots.map((slot) => ({ profileId, ...row(slot) })));
  await database.db.insert(recipeDecisions).values(slots.map((slot) => ({ recipeId, ...row(slot) })));
}, 60_000);

afterAll(async () => {
  await database.close();
});

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return (error as { details?: Array<{ code: string }> }).details?.[0]?.code ?? "unknown";
  }
}

describe("per-entity bounds shared with the portable format", () => {
  it("keeps Project decisions at the limit but lets existing slots change", async () => {
    const decisions = createDecisionService(createDecisionRepository(database));
    expect(await code(decisions.upsert(owner, projectId, "custom.one_more", delegated))).toBe("decision_limit");
    expect(await code(decisions.upsert(owner, projectId, slots[0]!, { ...delegated, rationale: "still allowed" }))).toBeNull();
    // A batch that removes as many slots as it adds stays within the bound.
    expect(await code(decisions.batch(owner, projectId, { decisions: [{ slot: "custom.one_more", ...delegated }], removeSlots: [] }))).toBe("decision_limit");
    expect(await code(decisions.batch(owner, projectId, { decisions: [{ slot: "custom.one_more", ...delegated }], removeSlots: [slots[1]!] }))).toBeNull();
  });

  it("applies the same bound to Profiles and Recipes", async () => {
    const profileService = createProfileService(createProfileRepository(database));
    const recipeService = createRecipeService(createRecipeRepository(database));
    expect(await code(profileService.upsertDecision(owner, profileId, "custom.one_more", delegated))).toBe("decision_limit");
    expect(await code(profileService.upsertDecision(owner, profileId, slots[0]!, delegated))).toBeNull();
    expect(await code(recipeService.upsertDecision(owner, recipeId, "custom.one_more", delegated))).toBe("decision_limit");
    expect(await code(recipeService.upsertDecision(owner, recipeId, slots[0]!, delegated))).toBeNull();
  });

  it("bounds compatibility rules per owner and still answers an identical rule", async () => {
    const service = createCompatibilityService(createCompatibilityRepository(database));
    const first = await service.create(owner, { kind: "conflicts", leftResourceId: left, rightResourceId: right });
    expect(first.created).toBe(true);
    // Fill up to the bound with distinct rows (the same pair with synthetic kinds is not allowed, so vary the resources).
    const extra = Array.from({ length: portableLimits.compatibilityRules - 1 }, (_, index) => `00000000-0000-4000-8001-${String(index).padStart(12, "0")}`);
    await database.db.insert(resources).values(extra.map((id, index) => ({ id, ownerUserId: owner, name: `R${index}`, slug: `r-${index}`, type: "framework" as const })));
    await database.db.insert(compatibilityRules).values(extra.map((id) => ({ ownerUserId: owner, kind: "requires" as const, leftResourceId: left, rightResourceId: id })));
    expect(await code(service.create(owner, { kind: "requires", leftResourceId: right, rightResourceId: left }))).toBe("rule_limit");
    const again = await service.create(owner, { kind: "conflicts", leftResourceId: left, rightResourceId: right });
    expect(again).toMatchObject({ created: false, rule: { id: first.rule.id } });
  });
});
