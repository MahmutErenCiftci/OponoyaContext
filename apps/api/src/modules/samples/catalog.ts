import type { DecisionMode, GlobalPreferenceMode, ProfileType, ProjectStage, ResourceType } from "@devcontext/contracts";

/**
 * Optional first-run sample set. Bump `sampleSetVersion` when the catalog
 * changes; installation is keyed per entity so re-running it only adds what is
 * missing, and removal deletes exactly the recorded entities. Every name starts
 * with "Sample ·" so users can tell the set apart from their own data.
 */
export const sampleSetVersion = "1";

export const samplePrefix = "Sample ·";

export type SampleResource = {
  key: string;
  name: string;
  type: ResourceType;
  description: string;
  sourceUrl?: string;
  docsUrl?: string;
  installCommand?: string;
  tags: string[];
  notes?: string;
  preference?: { slot: string; mode: GlobalPreferenceMode };
};

export type SampleDecision = {
  slot: string;
  mode: DecisionMode;
  resourceKey: string | null;
  rationale?: string;
  constraints?: Record<string, unknown>;
};

export type SampleProfile = { key: string; name: string; type: ProfileType; description: string; decisions: SampleDecision[] };

export const sampleResources: SampleResource[] = [
  {
    key: "resource:next", name: `${samplePrefix} Next.js`, type: "framework", sourceUrl: "https://nextjs.org", docsUrl: "https://nextjs.org/docs",
    description: "React framework with server components and file-based routing.", tags: ["frontend", "react"],
    preference: { slot: "frontend.framework", mode: "PREFERRED" },
  },
  {
    key: "resource:postgres", name: `${samplePrefix} PostgreSQL`, type: "database", sourceUrl: "https://www.postgresql.org", docsUrl: "https://www.postgresql.org/docs/",
    description: "Relational system of record with JSONB for flexible metadata.", tags: ["data"],
    preference: { slot: "database.primary", mode: "PREFERRED" },
  },
  {
    key: "resource:drizzle", name: `${samplePrefix} Drizzle ORM`, type: "orm", sourceUrl: "https://orm.drizzle.team", installCommand: "pnpm add drizzle-orm",
    description: "TypeScript query builder that keeps SQL visible.", tags: ["data", "typescript"],
    preference: { slot: "database.query_layer", mode: "PREFERRED" },
  },
  {
    key: "resource:better-auth", name: `${samplePrefix} Better Auth`, type: "auth", sourceUrl: "https://www.better-auth.com", installCommand: "pnpm add better-auth",
    description: "Email/password and social authentication with session cookies.", tags: ["auth"],
    preference: { slot: "auth.provider", mode: "PREFERRED" },
  },
  {
    key: "resource:shadcn", name: `${samplePrefix} shadcn/ui`, type: "ui_library", sourceUrl: "https://ui.shadcn.com", installCommand: "pnpm dlx shadcn@latest init",
    description: "Copy-in component library on Radix primitives and Tailwind.", tags: ["frontend", "ui"],
    preference: { slot: "frontend.ui.base", mode: "PREFERRED" },
  },
  {
    key: "resource:claude-code", name: `${samplePrefix} Claude Code`, type: "ai_coding_tool", sourceUrl: "https://claude.com/product/claude-code",
    description: "Terminal coding agent that reads CLAUDE.md for project context.", tags: ["ai"],
    preference: { slot: "ai.coding.primary", mode: "PREFERRED" },
  },
  {
    key: "resource:redis", name: `${samplePrefix} Redis`, type: "cache", sourceUrl: "https://redis.io",
    description: "In-memory cache; kept out of MVPs until a measured need exists.", tags: ["data", "infra"],
  },
  {
    key: "resource:boring-rule", name: `${samplePrefix} Prefer boring technology`, type: "rule",
    description: "Choose the proven option unless a requirement demands otherwise.", tags: ["rules"],
    notes: "Reach for the mature, well-documented option first. Novelty must earn its place with a concrete requirement.",
  },
];

export const sampleCompatibilityRules: Array<{ key: string; kind: "conflicts" | "requires"; leftKey: string; rightKey: string; note: string }> = [
  { key: "rule:drizzle-postgres", kind: "requires", leftKey: "resource:drizzle", rightKey: "resource:postgres", note: "This Drizzle setup targets PostgreSQL." },
];

export const sampleProfiles: SampleProfile[] = [
  {
    key: "profile:stack", name: `${samplePrefix} Fast SaaS stack`, type: "stack",
    description: "Next.js on PostgreSQL with Drizzle and Better Auth.",
    decisions: [
      { slot: "frontend.framework", mode: "LOCKED", resourceKey: "resource:next", rationale: "One frontend framework across every SaaS." },
      { slot: "database.primary", mode: "LOCKED", resourceKey: "resource:postgres" },
      { slot: "database.query_layer", mode: "PREFERRED", resourceKey: "resource:drizzle" },
      { slot: "auth.provider", mode: "PREFERRED", resourceKey: "resource:better-auth" },
    ],
  },
  {
    key: "profile:design", name: `${samplePrefix} Design defaults`, type: "design",
    description: "shadcn/ui as the base component system.",
    decisions: [
      { slot: "frontend.ui.base", mode: "LOCKED", resourceKey: "resource:shadcn", rationale: "Consistent primitives; customize, do not fork." },
    ],
  },
];

export const sampleRecipe = {
  key: "recipe:saas-mvp",
  name: `${samplePrefix} SaaS MVP`,
  description: "Stack and design profiles plus MVP-stage delegation: the backend framework is left to the agent, Redis is off.",
  profiles: [
    { profileKey: "profile:stack", priority: 10 },
    { profileKey: "profile:design", priority: 0 },
  ],
  decisions: [
    { slot: "ai.coding.primary", mode: "PREFERRED", resourceKey: "resource:claude-code" },
    { slot: "backend.framework", mode: "AI_DECIDE", resourceKey: null, constraints: { allowed: ["Fastify", "Hono"], notes: "Keep the API boring and typed." } },
    { slot: "database.cache", mode: "DISABLED", resourceKey: "resource:redis", rationale: "One data store per MVP." },
  ] satisfies SampleDecision[],
};

export const sampleProject = {
  key: "project:atlas",
  name: `${samplePrefix} Atlas Finance`,
  description: "Personal finance SaaS used to show how a Recipe, Profiles and Project overrides combine into one context.",
  productType: "SaaS",
  stage: "mvp" as ProjectStage,
  platforms: ["web"],
  priorities: ["Fast MVP", "Type safety"],
  rules: ["Validate every API input with Zod.", "No new infrastructure without a measured need."],
  resourceKeys: ["resource:boring-rule"],
  decisions: [
    { slot: "backend.architecture", mode: "AI_DECIDE", resourceKey: null, constraints: { notes: "Modular monolith unless load proves otherwise." } },
  ] satisfies SampleDecision[],
};
