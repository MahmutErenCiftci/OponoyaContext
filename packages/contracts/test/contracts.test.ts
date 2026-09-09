import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  createProjectSchema,
  createResourceSchema,
  currentUserResponseSchema,
  decisionSlotSchema,
  healthResponseSchema,
  idempotencyKeySchema,
  projectDecisionResponseSchema,
  projectListQuerySchema,
  projectResponseSchema,
  resourceListQuerySchema,
  updateProjectSchema,
  updateResourceSchema,
  upsertProjectDecisionSchema,
} from "../src/index.js";

describe("shared API contracts", () => {
  it("normalizes project input and rejects empty names", () => {
    expect(createProjectSchema.parse({ name: " Demo " })).toEqual({ name: "Demo", stage: "mvp", platforms: ["web"], priorities: [], rules: [] });
    expect(createProjectSchema.parse({ name: "Demo", profiles: [{ profileId: "00000000-0000-4000-8000-000000000070" }], rules: [" Prefer boring technology. "] }))
      .toMatchObject({ profiles: [{ profileId: "00000000-0000-4000-8000-000000000070", priority: 0 }], rules: ["Prefer boring technology."] });
    expect(createProjectSchema.safeParse({ name: "  " }).success).toBe(false);
  });
  it("validates Project wizard payloads and query parameters", () => {
    const created = createProjectSchema.parse({
      clientRequestId: "00000000-0000-4000-8000-000000000099",
      name: "Atlas Finance",
      stage: "production",
      platforms: [" web ", "mobile"],
      priorities: ["Fast MVP"],
      resourceIds: ["00000000-0000-4000-8000-000000000010"],
    });
    expect(created).toMatchObject({ stage: "production", platforms: ["web", "mobile"], resourceIds: ["00000000-0000-4000-8000-000000000010"] });
    expect(createProjectSchema.safeParse({ name: "Bad", stage: "someday" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "Bad", resourceIds: ["not-a-uuid"] }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "Bad", platforms: Array.from({ length: 11 }, (_, index) => `platform-${index}`) }).success).toBe(false);
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.parse({ description: null, resourceIds: [] })).toEqual({ description: null, resourceIds: [] });
    expect(projectListQuerySchema.parse({ status: "archived", limit: "5" })).toMatchObject({ status: "archived", limit: 5, offset: 0 });
    expect(projectListQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("retry-1").success).toBe(false);
    expect(projectResponseSchema.safeParse({ project: { id: "00000000-0000-4000-8000-000000000001", name: "Incomplete" } }).success).toBe(false);
  });
  it("validates Project decision payloads and slot keys", () => {
    expect(upsertProjectDecisionSchema.parse({ mode: "AI_DECIDE" })).toEqual({ mode: "AI_DECIDE", resourceId: null, priority: 0, constraints: {}, rationale: null, conditions: {} });
    expect(upsertProjectDecisionSchema.parse({ mode: "LOCKED", resourceId: "00000000-0000-4000-8000-000000000010", rationale: " Team standard " })).toMatchObject({ rationale: "Team standard" });
    expect(upsertProjectDecisionSchema.safeParse({ mode: "MAYBE" }).success).toBe(false);
    expect(upsertProjectDecisionSchema.safeParse({ mode: "LOCKED", resourceId: "not-a-uuid" }).success).toBe(false);
    expect(upsertProjectDecisionSchema.safeParse({ mode: "LOCKED", priority: 5000 }).success).toBe(false);
    expect(decisionSlotSchema.safeParse("frontend.framework").success).toBe(true);
    expect(decisionSlotSchema.safeParse("custom.date_library").success).toBe(true);
    expect(decisionSlotSchema.safeParse("Framework").success).toBe(false);
    expect(decisionSlotSchema.safeParse("frontend").success).toBe(false);
    expect(projectDecisionResponseSchema.parse({ decision: null })).toEqual({ decision: null });
  });
  it("rejects incomplete errors and unrelated health responses", () => {
    expect(apiErrorSchema.safeParse({ error: { message: "Oops" } }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ ok: true, service: "other-api" }).success).toBe(false);
  });
  it("accepts only complete current-user responses", () => {
    expect(currentUserResponseSchema.parse({
      user: { id: "00000000-0000-4000-8000-000000000001", email: "dev@example.test", name: "Dev", image: null },
    }).user.email).toBe("dev@example.test");
    expect(currentUserResponseSchema.safeParse({ user: { id: "not-an-id" } }).success).toBe(false);
  });
  it("validates safe Resource Library inputs", () => {
    expect(createResourceSchema.parse({
      name: " Next.js ",
      type: "framework",
      sourceUrl: "https://nextjs.org",
      preference: { slot: "frontend.framework", mode: "LOCKED" },
    })).toMatchObject({ name: "Next.js", tags: [], metadata: {} });
    expect(createResourceSchema.safeParse({ name: "Bad", type: "framework", sourceUrl: "file:///private" }).success).toBe(false);
    expect(createResourceSchema.safeParse({ name: "Bad", type: "framework", preference: { slot: "Framework", mode: "PREFERRED" } }).success).toBe(false);
    expect(updateResourceSchema.safeParse({}).success).toBe(false);
    expect(resourceListQuerySchema.parse({ limit: "20", archived: "all" })).toMatchObject({ limit: 20, archived: "all", offset: 0 });
  });
});
