import type { CompatibilityRule, CreateCompatibilityRuleInput } from "@devcontext/contracts";

export interface CompatibilityRepository {
  list(ownerUserId: string, resourceId: string | undefined, limit: number): Promise<CompatibilityRule[]>;
  /**
   * Inserts the rule unless an identical one exists, in which case the existing
   * rule is returned with `created: false`. Both Resources must be active and
   * owned; otherwise `resourceUnavailableError` names the offending side.
   */
  create(ownerUserId: string, input: CreateCompatibilityRuleInput): Promise<{ rule: CompatibilityRule; created: boolean }>;
  remove(ownerUserId: string, ruleId: string): Promise<boolean>;
}

function notFoundError() {
  return Object.assign(new Error("Rule not found"), { statusCode: 404 });
}

/** Missing, foreign and archived Resources are reported identically per side. */
export function ruleResourceUnavailableError(side: "leftResourceId" | "rightResourceId") {
  return Object.assign(new Error("Rule references an unavailable resource"), {
    statusCode: 400,
    details: [{ path: [side], code: "resource_unavailable" }],
  });
}

export interface CompatibilityService {
  list(ownerUserId: string, resourceId: string | undefined, limit: number): Promise<CompatibilityRule[]>;
  create(ownerUserId: string, input: CreateCompatibilityRuleInput): Promise<{ rule: CompatibilityRule; created: boolean }>;
  remove(ownerUserId: string, ruleId: string): Promise<void>;
}

export function createCompatibilityService(repository: CompatibilityRepository): CompatibilityService {
  return {
    list(ownerUserId, resourceId, limit) {
      return repository.list(ownerUserId, resourceId, limit);
    },
    create(ownerUserId, input) {
      return repository.create(ownerUserId, { ...input, note: input.note?.trim() || undefined });
    },
    async remove(ownerUserId, ruleId) {
      if (!(await repository.remove(ownerUserId, ruleId))) throw notFoundError();
    },
  };
}
