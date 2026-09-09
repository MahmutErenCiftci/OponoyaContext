import type {
  BillingUsage,
  Entitlement,
  ExportTarget,
  PlanFeatureKey,
  PlanId,
  PlanLimitKey,
  SubscriptionStatus,
} from "@devcontext/contracts";
import { limitLabels, plans } from "./plans.js";

/** Persisted billing state for one user; `null` means no record yet (Free). */
export type SubscriptionRecord = {
  ownerUserId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  lastEventAt: Date | null;
};

const day = 24 * 60 * 60 * 1000;
/** A period may end before the renewal event arrives; keep Pro for this long while waiting. */
export const renewalGraceMs = 3 * day;
/** A failed renewal keeps Pro for this long so the user can fix the payment method. */
export const pastDueGraceMs = 7 * day;

function later(a: Date | null, b: Date | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Deterministic plan resolution. It never grants more than the provider
 * confirmed: an expired period without a renewal event falls back to Free
 * after a short grace, cancellations keep Pro until the paid period ends, and
 * failed payments get a bounded grace period with a visible warning.
 */
export function resolveEntitlement(record: SubscriptionRecord | null, now: Date): Entitlement {
  const free = (reason: Entitlement["reason"]): Entitlement => ({ plan: "free", reason, effectiveUntil: null, paymentProblem: false, cancelAtPeriodEnd: false });
  if (!record || record.plan !== "pro") return free("no_subscription");
  const periodEnd = record.currentPeriodEnd;
  const pro = (reason: Entitlement["reason"], until: Date | null, paymentProblem = false): Entitlement => ({
    plan: "pro", reason, effectiveUntil: until?.toISOString() ?? null, paymentProblem, cancelAtPeriodEnd: record.cancelAtPeriodEnd,
  });
  switch (record.status) {
    case "active":
    case "trialing": {
      if (record.cancelAtPeriodEnd) {
        if (periodEnd && periodEnd <= now) return free("period_ended");
        return pro("cancel_at_period_end", periodEnd);
      }
      if (!periodEnd) return pro(record.status === "trialing" ? "trialing" : "active", null);
      if (periodEnd > now) return pro(record.status === "trialing" ? "trialing" : "active", periodEnd);
      const graceUntil = new Date(periodEnd.getTime() + renewalGraceMs);
      return graceUntil > now ? pro("renewal_pending", graceUntil) : free("period_ended");
    }
    case "past_due": {
      const base = later(periodEnd, record.lastEventAt) ?? now;
      const graceUntil = new Date(base.getTime() + pastDueGraceMs);
      return graceUntil > now ? pro("past_due_grace", graceUntil, true) : free("payment_failed");
    }
    case "canceled": {
      if (periodEnd && periodEnd > now) return pro("cancel_at_period_end", periodEnd);
      return free("canceled");
    }
    case "incomplete":
      return free("incomplete");
    case "incomplete_expired":
    case "unpaid":
      return free("payment_failed");
    case "expired":
      return free("period_ended");
    case "none":
    default:
      return free("no_subscription");
  }
}

export interface SubscriptionReader {
  find(ownerUserId: string): Promise<SubscriptionRecord | null>;
}

export interface UsageRepository {
  /** Active counts per limited entity; archived rows do not count. */
  counts(ownerUserId: string): Promise<Record<PlanLimitKey, number>>;
}

/** 403 with a machine-readable detail; the message names the limit and the way out. */
export function planLimitError(key: PlanLimitKey, limit: number, plan: PlanId) {
  const upgrade = plan === "free" ? " Archive one, or upgrade to Pro on the Plan page." : " Archive one to make room.";
  return Object.assign(new Error(`Plan limit reached for ${key}`), {
    statusCode: 403,
    details: [{ path: [key], code: "plan_limit" }],
    publicMessage: `Your ${plans[plan].name} plan allows ${limit} ${limitLabels[key]}.${upgrade}`,
  });
}

export function planFeatureError(feature: string) {
  return Object.assign(new Error(`Plan feature unavailable: ${feature}`), {
    statusCode: 403,
    details: [{ path: [feature], code: "plan_feature" }],
    publicMessage: `${feature} is a Pro feature. Upgrade on the Plan page to use it.`,
  });
}

const featureLabels: Record<PlanFeatureKey, string> = { bundle: "The zipped context bundle", diff: "Version diff" };
const targetLabels: Record<ExportTarget, string> = { generic: "The master prompt export", agents: "The AGENTS.md export", claude: "The CLAUDE.md export", cursor: "The Cursor export", copilot: "The Copilot export" };

export interface EntitlementService {
  entitlement(ownerUserId: string): Promise<Entitlement>;
  usage(ownerUserId: string): Promise<BillingUsage>;
  /** Throws `plan_limit` when creating `count` more active entities would exceed the plan. */
  assertCanCreate(ownerUserId: string, key: PlanLimitKey, count?: number): Promise<void>;
  assertExportTarget(ownerUserId: string, target: ExportTarget): Promise<void>;
  assertFeature(ownerUserId: string, feature: PlanFeatureKey): Promise<void>;
  historyLimit(ownerUserId: string): Promise<number>;
}

export function createEntitlementService(subscriptions: SubscriptionReader, usage: UsageRepository, now: () => Date = () => new Date()): EntitlementService {
  async function planOf(ownerUserId: string) {
    return resolveEntitlement(await subscriptions.find(ownerUserId), now()).plan;
  }
  return {
    async entitlement(ownerUserId) {
      return resolveEntitlement(await subscriptions.find(ownerUserId), now());
    },
    async usage(ownerUserId) {
      const [plan, counts] = await Promise.all([planOf(ownerUserId), usage.counts(ownerUserId)]);
      const limits = plans[plan].limits;
      const meter = (key: PlanLimitKey) => ({ used: counts[key], limit: limits[key], remaining: Math.max(0, limits[key] - counts[key]) });
      return { projects: meter("projects"), resources: meter("resources"), profiles: meter("profiles"), recipes: meter("recipes") };
    },
    async assertCanCreate(ownerUserId, key, count = 1) {
      if (count <= 0) return;
      const [plan, counts] = await Promise.all([planOf(ownerUserId), usage.counts(ownerUserId)]);
      const limit = plans[plan].limits[key];
      if (counts[key] + count > limit) throw planLimitError(key, limit, plan);
    },
    async assertExportTarget(ownerUserId, target) {
      const plan = await planOf(ownerUserId);
      if (!plans[plan].features.exportTargets.includes(target)) throw planFeatureError(targetLabels[target]);
    },
    async assertFeature(ownerUserId, feature) {
      const plan = await planOf(ownerUserId);
      if (!plans[plan].features[feature]) throw planFeatureError(featureLabels[feature]);
    },
    async historyLimit(ownerUserId) {
      return plans[await planOf(ownerUserId)].features.historyLimit;
    },
  };
}
