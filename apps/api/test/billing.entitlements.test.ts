import { describe, expect, it } from "vitest";
import { pastDueGraceMs, renewalGraceMs, resolveEntitlement } from "../src/modules/billing/entitlements.js";
import { plans } from "../src/modules/billing/plans.js";
import { signWebhook, signatureHeader, verifyWebhookSignature } from "../src/modules/billing/signature.js";
import { memorySubscriptions, memoryUsage, planEntitlements, proRecord } from "./support/memory-billing.js";

const owner = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-09-15T12:00:00Z");
const periodEnd = new Date("2026-10-01T00:00:00Z");

describe("entitlement resolution", () => {
  it("keeps Free for missing, incomplete and unpaid records", () => {
    expect(resolveEntitlement(null, now)).toMatchObject({ plan: "free", reason: "no_subscription", paymentProblem: false });
    expect(resolveEntitlement(proRecord(owner, { status: "incomplete" }), now).reason).toBe("incomplete");
    expect(resolveEntitlement(proRecord(owner, { status: "unpaid" }), now)).toMatchObject({ plan: "free", reason: "payment_failed" });
    expect(resolveEntitlement(proRecord(owner, { status: "incomplete_expired" }), now).plan).toBe("free");
    expect(resolveEntitlement(proRecord(owner, { status: "expired" }), now).reason).toBe("period_ended");
    expect(resolveEntitlement(proRecord(owner, { plan: "free", status: "active" }), now).plan).toBe("free");
  });

  it("grants Pro while the paid period runs and briefly while a renewal event is late", () => {
    expect(resolveEntitlement(proRecord(owner), now)).toMatchObject({ plan: "pro", reason: "active", effectiveUntil: periodEnd.toISOString(), paymentProblem: false });
    expect(resolveEntitlement(proRecord(owner, { status: "trialing" }), now).reason).toBe("trialing");
    const late = new Date(periodEnd.getTime() + renewalGraceMs - 1);
    expect(resolveEntitlement(proRecord(owner), late)).toMatchObject({ plan: "pro", reason: "renewal_pending" });
    const tooLate = new Date(periodEnd.getTime() + renewalGraceMs + 1);
    expect(resolveEntitlement(proRecord(owner), tooLate)).toMatchObject({ plan: "free", reason: "period_ended" });
    expect(resolveEntitlement(proRecord(owner, { currentPeriodEnd: null }), tooLate)).toMatchObject({ plan: "pro", reason: "active", effectiveUntil: null });
  });

  it("honours cancel-at-period-end and immediate cancellation", () => {
    const canceling = proRecord(owner, { cancelAtPeriodEnd: true, canceledAt: now });
    expect(resolveEntitlement(canceling, now)).toMatchObject({ plan: "pro", reason: "cancel_at_period_end", cancelAtPeriodEnd: true, effectiveUntil: periodEnd.toISOString() });
    expect(resolveEntitlement(canceling, new Date(periodEnd.getTime() + 1))).toMatchObject({ plan: "free", reason: "period_ended" });
    const canceled = proRecord(owner, { status: "canceled" });
    expect(resolveEntitlement(canceled, now).plan).toBe("pro");
    expect(resolveEntitlement(canceled, new Date(periodEnd.getTime() + 1))).toMatchObject({ plan: "free", reason: "canceled" });
  });

  it("gives failed payments a bounded grace period with a visible warning", () => {
    const pastDue = proRecord(owner, { status: "past_due", lastEventAt: now });
    expect(resolveEntitlement(pastDue, now)).toMatchObject({ plan: "pro", reason: "past_due_grace", paymentProblem: true });
    const afterGrace = new Date(periodEnd.getTime() + pastDueGraceMs + 1);
    expect(resolveEntitlement(pastDue, afterGrace)).toMatchObject({ plan: "free", reason: "payment_failed", paymentProblem: false });
  });
});

describe("entitlement service", () => {
  it("enforces limits at, below and above the plan and names the way out", async () => {
    const subscriptions = memorySubscriptions();
    const usage = memoryUsage({ projects: 2, resources: 49, profiles: 2, recipes: 1 });
    const service = planEntitlements(subscriptions, usage, () => now);
    await expect(service.assertCanCreate(owner, "projects")).resolves.toBeUndefined();
    await expect(service.assertCanCreate(owner, "resources")).resolves.toBeUndefined();
    await expect(service.assertCanCreate(owner, "resources", 2)).rejects.toMatchObject({ statusCode: 403, details: [{ path: ["resources"], code: "plan_limit" }], publicMessage: "Your Free plan allows 50 active Library resources. Archive one, or upgrade to Pro on the Plan page." });
    await expect(service.assertCanCreate(owner, "profiles")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.assertCanCreate(owner, "recipes")).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.assertCanCreate(owner, "recipes", 0)).resolves.toBeUndefined();
    usage.set("projects", 3);
    await expect(service.assertCanCreate(owner, "projects")).rejects.toMatchObject({ publicMessage: expect.stringContaining("3 active projects") });
    const meters = await service.usage(owner);
    expect(meters.projects).toEqual({ used: 3, limit: 3, remaining: 0 });
    expect(meters.resources).toEqual({ used: 49, limit: 50, remaining: 1 });

    subscriptions.set(proRecord(owner));
    await expect(service.assertCanCreate(owner, "projects", 10)).resolves.toBeUndefined();
    expect((await service.usage(owner)).projects.limit).toBe(plans.pro.limits.projects);
    usage.set("projects", plans.pro.limits.projects);
    await expect(service.assertCanCreate(owner, "projects")).rejects.toMatchObject({ publicMessage: expect.stringContaining("Pro plan allows 500 active projects. Archive one to make room.") });
  });

  it("gates export targets, the bundle, diff and history by plan", async () => {
    const subscriptions = memorySubscriptions();
    const service = planEntitlements(subscriptions, memoryUsage(), () => now);
    await expect(service.assertExportTarget(owner, "agents")).resolves.toBeUndefined();
    await expect(service.assertExportTarget(owner, "cursor")).rejects.toMatchObject({ statusCode: 403, details: [{ path: ["The Cursor export"], code: "plan_feature" }] });
    await expect(service.assertFeature(owner, "bundle")).rejects.toMatchObject({ publicMessage: "The zipped context bundle is a Pro feature. Upgrade on the Plan page to use it." });
    await expect(service.assertFeature(owner, "diff")).rejects.toMatchObject({ statusCode: 403 });
    expect(await service.historyLimit(owner)).toBe(3);
    subscriptions.set(proRecord(owner));
    await expect(service.assertExportTarget(owner, "copilot")).resolves.toBeUndefined();
    await expect(service.assertFeature(owner, "diff")).resolves.toBeUndefined();
    expect(await service.historyLimit(owner)).toBe(50);
    expect((await service.entitlement(owner)).plan).toBe("pro");
  });
});

describe("webhook signatures", () => {
  const secret = "billing-webhook-test-secret-with-32-characters!";
  const body = Buffer.from(JSON.stringify({ id: "evt_1" }));

  it("round-trips a signature over the raw body and rejects tampering, replay and malformed headers", () => {
    const header = signWebhook(secret, body, Math.floor(now.getTime() / 1000));
    expect(signatureHeader).toBe("x-devcontext-signature");
    expect(verifyWebhookSignature(secret, body, header, now)).toMatchObject({ ok: true });
    expect(verifyWebhookSignature(secret, Buffer.from(JSON.stringify({ id: "evt_2" })), header, now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyWebhookSignature("another-secret-that-is-long-enough-32-chars", body, header, now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyWebhookSignature(secret, body, header, new Date(now.getTime() + 10 * 60 * 1000))).toEqual({ ok: false, reason: "expired" });
    expect(verifyWebhookSignature(secret, body, undefined, now)).toEqual({ ok: false, reason: "missing" });
    expect(verifyWebhookSignature(secret, body, "t=abc,v1=zz", now)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyWebhookSignature(secret, body, header.replace(/v1=.*/, "v1=" + "0".repeat(64)), now)).toEqual({ ok: false, reason: "mismatch" });
  });
});
