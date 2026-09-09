import type { PlanDefinition, PlanId, PlanLimitKey } from "@devcontext/contracts";

/**
 * The single source of plan limits and features. Free must complete the full
 * value loop (Library → Project → Compile → Export); Pro raises limits and
 * unlocks the remaining individual features. Team features are out of scope.
 */
export const plans: Record<PlanId, Omit<PlanDefinition, "priceLabel">> = {
  free: {
    id: "free",
    name: "Free",
    description: "Save your stack once and compile it into context for your coding agents.",
    limits: { projects: 3, resources: 50, profiles: 2, recipes: 1 },
    features: { exportTargets: ["generic", "agents", "claude"], bundle: false, diff: false, historyLimit: 3 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Large limits, every export adapter, the zipped bundle, full version history and diff.",
    limits: { projects: 500, resources: 5000, profiles: 100, recipes: 100 },
    features: { exportTargets: ["generic", "agents", "claude", "cursor", "copilot"], bundle: true, diff: true, historyLimit: 50 },
  },
};

export const planOrder: PlanId[] = ["free", "pro"];

export const limitLabels: Record<PlanLimitKey, string> = {
  projects: "active projects",
  resources: "active Library resources",
  profiles: "profiles",
  recipes: "recipes",
};

export function planDefinitions(proPriceLabel: string | null): PlanDefinition[] {
  return planOrder.map((id) => ({ ...plans[id], priceLabel: id === "pro" ? proPriceLabel : null }));
}
