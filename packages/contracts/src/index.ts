import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("devcontext-api"),
});

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  image: z.string().nullable(),
});

export const currentUserResponseSchema = z.object({
  user: currentUserSchema,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT",
  "PAYLOAD_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "RATE_LIMITED", "BAD_REQUEST",
  "INTERNAL_ERROR", "SERVICE_UNAVAILABLE",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.array(z.object({ path: z.array(z.string()), code: z.string() })).optional(),
  }),
});

export const decisionModeSchema = z.enum([
  "LOCKED",
  "PREFERRED",
  "AI_DECIDE",
  "DISABLED",
]);

export type DecisionMode = z.infer<typeof decisionModeSchema>;

export const resourceTypeSchema = z.enum([
  "language",
  "framework",
  "runtime",
  "database",
  "orm",
  "auth",
  "storage",
  "cache",
  "queue",
  "ui_library",
  "component",
  "theme",
  "design_system",
  "animation",
  "icon_library",
  "repository",
  "boilerplate",
  "template",
  "prompt",
  "ai_coding_tool",
  "ai_builder",
  "mcp",
  "cli",
  "deployment",
  "monitoring",
  "service",
  "architecture",
  "rule",
  "reference",
]);

export type ResourceType = z.infer<typeof resourceTypeSchema>;

/** Reference URLs: HTTP(S) only and bounded so a stored link can never carry a payload-sized value. */
const httpUrlSchema = z.url().max(2_048).refine(
  (value) => ["http:", "https:"].includes(new URL(value).protocol),
  "Only HTTP and HTTPS URLs are supported",
);

export const globalPreferenceModeSchema = z.enum([
  "LOCKED",
  "PREFERRED",
  "DISABLED",
]);
export type GlobalPreferenceMode = z.infer<typeof globalPreferenceModeSchema>;

export const decisionSlotSchema = z.string().trim().min(3).max(160).regex(
  /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/,
  "Use a namespaced slot such as frontend.framework",
);

export const resourcePreferenceInputSchema = z.object({
  slot: decisionSlotSchema,
  mode: globalPreferenceModeSchema,
});

const metadataSchema = z.record(z.string().max(100), z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 20_000,
  "Metadata is too large",
);

export const createResourceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: resourceTypeSchema,
  description: z.string().trim().max(2_000).optional(),
  sourceUrl: httpUrlSchema.optional(),
  docsUrl: httpUrlSchema.optional(),
  repoUrl: httpUrlSchema.optional(),
  installCommand: z.string().trim().max(1_000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  notes: z.string().trim().max(10_000).optional(),
  metadata: metadataSchema.default({}),
  preference: resourcePreferenceInputSchema.optional(),
});

export const updateResourceSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  type: resourceTypeSchema.optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  sourceUrl: httpUrlSchema.nullable().optional(),
  docsUrl: httpUrlSchema.nullable().optional(),
  repoUrl: httpUrlSchema.nullable().optional(),
  installCommand: z.string().trim().max(1_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  metadata: metadataSchema.optional(),
  preference: resourcePreferenceInputSchema.nullable().optional(),
  favorite: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const resourcePreferenceSchema = resourcePreferenceInputSchema.extend({
  id: z.uuid(),
});

export const resourceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  type: resourceTypeSchema,
  description: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  docsUrl: z.string().nullable(),
  repoUrl: z.string().nullable(),
  installCommand: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()),
  preference: resourcePreferenceSchema.nullable(),
  favorite: z.boolean(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** Another active Resource that looks like the one just saved, with the reason it matched. */
export const resourceDuplicateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: resourceTypeSchema,
  sourceUrl: z.string().nullable(),
  reason: z.enum(["url", "name"]),
});
export type ResourceDuplicate = z.infer<typeof resourceDuplicateSchema>;

export const resourceWarningSchema = z.enum(["DUPLICATE_SOURCE_URL", "DUPLICATE_NAME"]);
export type ResourceWarning = z.infer<typeof resourceWarningSchema>;

export const resourceMutationResponseSchema = z.object({
  resource: resourceSchema,
  warnings: z.array(resourceWarningSchema).default([]),
  duplicates: z.array(resourceDuplicateSchema).default([]),
});

export const resourceListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  type: resourceTypeSchema.optional(),
  tag: z.string().trim().min(1).max(60).optional(),
  preference: globalPreferenceModeSchema.optional(),
  favorite: z.enum(["true", "false"]).optional(),
  archived: z.enum(["active", "archived", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const resourceListResponseSchema = z.object({
  resources: z.array(resourceSchema),
  total: z.number().int().nonnegative(),
});

export type Resource = z.infer<typeof resourceSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type ResourceListQuery = z.infer<typeof resourceListQuerySchema>;

export const projectStageSchema = z.enum([
  "experiment",
  "mvp",
  "production",
  "maintenance",
]);
export type ProjectStage = z.infer<typeof projectStageSchema>;

export const projectStatusSchema = z.enum(["active", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const projectPlatformsSchema = z.array(z.string().trim().min(1).max(60)).max(10);
const projectPrioritiesSchema = z.array(z.string().trim().min(1).max(100)).max(10);
const projectResourceIdsSchema = z.array(z.uuid()).max(50);
const projectRulesSchema = z.array(z.string().trim().min(1).max(500)).max(30);

export const profileTypeSchema = z.enum(["stack", "design", "ai", "deployment"]);
export type ProfileType = z.infer<typeof profileTypeSchema>;

export const projectProfileAttachmentSchema = z.object({
  profileId: z.uuid(),
  priority: z.number().int().min(-1000).max(1000).default(0),
});
export type ProjectProfileAttachment = z.infer<typeof projectProfileAttachmentSchema>;

export const projectProfileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  type: profileTypeSchema,
  priority: z.number().int(),
  archivedAt: z.iso.datetime().nullable(),
});
export type ProjectProfile = z.infer<typeof projectProfileSchema>;


/** Recipe applied to a Project: a reference whose decisions rank between Project and Profile scope. */
export const projectRecipeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  archivedAt: z.iso.datetime().nullable(),
});
export type ProjectRecipe = z.infer<typeof projectRecipeSchema>;

export const createProjectSchema = z.object({
  clientRequestId: z.uuid().optional(),
  recipeId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4_000).optional(),
  productType: z.string().trim().max(100).optional(),
  stage: projectStageSchema.default("mvp"),
  platforms: projectPlatformsSchema.default(["web"]),
  priorities: projectPrioritiesSchema.default([]),
  rules: projectRulesSchema.default([]),
  profiles: z.array(projectProfileAttachmentSchema).max(10).optional(),
  resourceIds: projectResourceIdsSchema.optional(),
});

export const updateProjectSchema = z.object({
  recipeId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4_000).nullable().optional(),
  productType: z.string().trim().max(100).nullable().optional(),
  stage: projectStageSchema.optional(),
  platforms: projectPlatformsSchema.optional(),
  priorities: projectPrioritiesSchema.optional(),
  rules: projectRulesSchema.optional(),
  profiles: z.array(projectProfileAttachmentSchema).max(10).optional(),
  resourceIds: projectResourceIdsSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

/** Minimal Resource reference embedded in Project and decision responses. */
export const resourceReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  type: resourceTypeSchema,
  sourceUrl: z.string().nullable(),
  archivedAt: z.iso.datetime().nullable(),
});
export type ResourceReference = z.infer<typeof resourceReferenceSchema>;

export const projectResourceSummarySchema = resourceReferenceSchema.extend({
  attachedAt: z.iso.datetime(),
});

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  productType: z.string().nullable(),
  stage: projectStageSchema,
  status: projectStatusSchema,
  platforms: z.array(z.string()),
  priorities: z.array(z.string()),
  rules: z.array(z.string()),
  recipe: projectRecipeSchema.nullable(),
  profiles: z.array(projectProfileSchema),
  resources: z.array(projectResourceSummarySchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const projectResponseSchema = z.object({ project: projectSchema });

export const projectListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  stage: projectStageSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

/** `Idempotency-Key` header value for `POST /v1/projects`; it wins over a body `clientRequestId`. */
export const idempotencyKeySchema = z.uuid();

export type Project = z.infer<typeof projectSchema>;
export type ProjectResourceSummary = z.infer<typeof projectResourceSummarySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const decisionScopeSchema = z.enum(["project", "recipe", "profile", "global"]);

/** Profile (or later Recipe) a decision comes from, with its attachment priority on the Project. */
export const decisionOriginSchema = z.object({ id: z.string(), name: z.string(), priority: z.number().int() });
export type DecisionOrigin = z.infer<typeof decisionOriginSchema>;
export type DecisionScope = z.infer<typeof decisionScopeSchema>;

const decisionJsonSchema = z.record(z.string().max(100), z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 5_000,
  "Value is too large",
);

/**
 * Body of `PUT /v1/projects/:id/decisions/:slot`. `AI_DECIDE` must not carry a
 * Resource; every other mode requires one (enforced by the domain service).
 */
export const upsertProjectDecisionSchema = z.object({
  mode: decisionModeSchema,
  resourceId: z.uuid().nullable().default(null),
  priority: z.number().int().min(-1000).max(1000).default(0),
  constraints: decisionJsonSchema.default({}),
  rationale: z.string().trim().max(4_000).nullable().default(null),
  conditions: decisionJsonSchema.default({}),
});
export type UpsertProjectDecisionInput = z.infer<typeof upsertProjectDecisionSchema>;

export const decisionRecordSchema = z.object({
  id: z.uuid(),
  scope: decisionScopeSchema,
  origin: decisionOriginSchema.nullable(),
  slot: z.string(),
  mode: decisionModeSchema,
  resource: resourceReferenceSchema.nullable(),
  priority: z.number().int(),
  constraints: z.record(z.string(), z.unknown()),
  rationale: z.string().nullable(),
  conditions: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});
export type DecisionRecord = z.infer<typeof decisionRecordSchema>;

/** One slot as seen from a Project: the explicit override, the inherited global rule and which one wins. */
export const projectDecisionViewSchema = z.object({
  slot: z.string(),
  source: decisionScopeSchema,
  effective: decisionRecordSchema,
  project: decisionRecordSchema.nullable(),
  /** Decision contributed by the Project's applied Recipe, if any. */
  recipe: decisionRecordSchema.nullable(),
  /** Highest-priority Profile decision for the slot, if any Profile provides one. */
  profile: decisionRecordSchema.nullable(),
  /** Every Profile decision for the slot, highest priority first, so conflicts stay visible. */
  profiles: z.array(decisionRecordSchema),
  global: decisionRecordSchema.nullable(),
});
export type ProjectDecisionView = z.infer<typeof projectDecisionViewSchema>;

export const projectDecisionsResponseSchema = z.object({
  decisions: z.array(projectDecisionViewSchema),
});

/** `null` after removing an override for a slot that has no global rule to fall back to. */
export const projectDecisionResponseSchema = z.object({
  decision: projectDecisionViewSchema.nullable(),
});

// ---------------------------------------------------------------------------
// Context Compiler versions and exports (Handoff 6)
// ---------------------------------------------------------------------------

export const exportTargetSchema = z.enum(["generic", "agents", "claude", "cursor", "copilot"]);
export type ExportTarget = z.infer<typeof exportTargetSchema>;

export const compileScopeSchema = z.enum(["global", "profile", "recipe", "project"]);

export const compiledResourceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  sourceUrl: z.string().nullable(),
  installCommand: z.string().nullable(),
  archived: z.boolean(),
});

export const compiledResourceSchema = compiledResourceRefSchema.extend({
  slug: z.string().nullable(),
  description: z.string().nullable(),
  docsUrl: z.string().nullable(),
  repoUrl: z.string().nullable(),
  attached: z.boolean(),
  slots: z.array(z.string()),
});

export const shadowedDecisionSchema = z.object({
  decisionId: z.string(),
  scope: compileScopeSchema,
  mode: decisionModeSchema,
  resourceId: z.string().nullable(),
  priority: z.number().int(),
  origin: decisionOriginSchema.nullable(),
});

export const compiledDecisionSchema = z.object({
  slot: z.string(),
  mode: decisionModeSchema,
  source: compileScopeSchema,
  origin: decisionOriginSchema.nullable(),
  decisionId: z.string(),
  resource: compiledResourceRefSchema.nullable(),
  priority: z.number().int(),
  constraints: z.record(z.string(), z.unknown()),
  rationale: z.string().nullable(),
  shadowed: z.array(shadowedDecisionSchema),
});

export const compileWarningSchema = z.object({
  code: z.enum(["RESOURCE_UNRESOLVED", "RESOURCE_ARCHIVED", "RESOURCE_CONFLICT", "DISABLED_RESOURCE_ATTACHED", "RULE_CONFLICT", "MISSING_REQUIREMENT"]),
  slot: z.string().nullable(),
  resourceId: z.string().nullable(),
  message: z.string(),
});
export type CompileWarning = z.infer<typeof compileWarningSchema>;

/** Mirrors `CanonicalContext` from `@devcontext/context-compiler`; the API validates compiler output against it. */
export const canonicalContextSchema = z.object({
  compilerVersion: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    description: z.string().nullable(),
    productType: z.string().nullable(),
    stage: z.string(),
    platforms: z.array(z.string()),
    priorities: z.array(z.string()),
  }),
  decisions: z.array(compiledDecisionSchema),
  resources: z.array(compiledResourceSchema),
  rules: z.array(z.string()),
  warnings: z.array(compileWarningSchema),
});
export type CanonicalContext = z.infer<typeof canonicalContextSchema>;

export const exportPreviewSchema = z.object({
  target: exportTargetSchema,
  fileName: z.string(),
  content: z.string(),
});
export type ExportPreview = z.infer<typeof exportPreviewSchema>;

export const contextVersionSummarySchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  compilerVersion: z.string(),
  contentHash: z.string(),
  decisionCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export type ContextVersionSummary = z.infer<typeof contextVersionSummarySchema>;

export const contextVersionSchema = contextVersionSummarySchema.extend({
  canonical: canonicalContextSchema,
  previews: z.array(exportPreviewSchema),
});
export type ContextVersion = z.infer<typeof contextVersionSchema>;

export const compileResponseSchema = z.object({
  version: contextVersionSchema,
  /** `false` when the canonical hash matched the latest version and nothing was stored. */
  created: z.boolean(),
});

export const contextStateResponseSchema = z.object({
  version: contextVersionSchema.nullable(),
  /** True when compiling now would produce a different hash than the latest stored version. */
  stale: z.boolean(),
  draftHash: z.string(),
  draftWarnings: z.array(compileWarningSchema),
});
export type ContextState = z.infer<typeof contextStateResponseSchema>;

export const contextVersionListResponseSchema = z.object({
  versions: z.array(contextVersionSummarySchema),
});

export const contextVersionResponseSchema = z.object({
  version: contextVersionSchema,
});

export const createExportSchema = z.object({
  target: exportTargetSchema,
  version: z.number().int().positive().optional(),
});
export type CreateExportInput = z.infer<typeof createExportSchema>;

/** Export history also records zipped bundles, which are not a renderer target. */
export const exportEventTargetSchema = z.enum([...exportTargetSchema.options, "bundle"]);
export type ExportEventTarget = z.infer<typeof exportEventTargetSchema>;

export const exportEventSchema = z.object({
  id: z.uuid(),
  target: exportEventTargetSchema,
  fileName: z.string(),
  contextVersion: z.number().int().positive().nullable(),
  contentHash: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ExportEvent = z.infer<typeof exportEventSchema>;

export const exportResponseSchema = z.object({
  export: exportPreviewSchema.extend({
    contextVersion: z.number().int().positive(),
    contentHash: z.string(),
  }),
  event: exportEventSchema,
  created: z.boolean(),
});

export const exportListResponseSchema = z.object({
  exports: z.array(exportEventSchema),
});

// ---------------------------------------------------------------------------
// Profiles, Project profile attachments and batch decisions (Handoff 7)
// ---------------------------------------------------------------------------

export const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: profileTypeSchema,
  description: z.string().trim().max(2_000).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  type: profileTypeSchema.optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");
export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  type: profileTypeSchema,
  description: z.string().nullable(),
  decisionCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProfileSummary = z.infer<typeof profileSummarySchema>;

export const profileSchema = profileSummarySchema.extend({
  decisions: z.array(decisionRecordSchema),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  type: profileTypeSchema.optional(),
  archived: z.enum(["active", "archived", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type ProfileListQuery = z.infer<typeof profileListQuerySchema>;

export const profileListResponseSchema = z.object({
  profiles: z.array(profileSummarySchema),
  total: z.number().int().nonnegative(),
});

export const profileResponseSchema = z.object({ profile: profileSchema });

/** Result of upserting/removing one Profile decision slot. */
export const profileDecisionResponseSchema = z.object({ decision: decisionRecordSchema.nullable() });

export const setProjectProfilesSchema = z.object({
  profiles: z.array(projectProfileAttachmentSchema).max(10),
});

export const projectProfilesResponseSchema = z.object({ profiles: z.array(projectProfileSchema) });

/** Upsert many Project decisions and remove others in one transaction (wizard save). */
export const batchProjectDecisionsSchema = z.object({
  decisions: z.array(upsertProjectDecisionSchema.extend({ slot: decisionSlotSchema })).max(80).default([]),
  removeSlots: z.array(decisionSlotSchema).max(80).default([]),
}).refine((value) => value.decisions.length + value.removeSlots.length > 0, "Nothing to change");
export type BatchProjectDecisionsInput = z.infer<typeof batchProjectDecisionsSchema>;

export const globalDecisionsResponseSchema = z.object({ decisions: z.array(decisionRecordSchema) });

// ---------------------------------------------------------------------------
// V0.3 usability: search, compatibility rules, clone, save-as-profile, diff,
// workspace summary (Handoff 8A)
// ---------------------------------------------------------------------------

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(160),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultKindSchema = z.enum(["resource", "project", "profile", "recipe"]);
export type SearchResultKind = z.infer<typeof searchResultKindSchema>;

export const searchResultSchema = z.object({
  kind: searchResultKindSchema,
  id: z.uuid(),
  name: z.string(),
  subtitle: z.string().nullable(),
  archived: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(searchResultSchema),
});

export const compatibilityKindSchema = z.enum(["conflicts", "requires"]);
export type CompatibilityKind = z.infer<typeof compatibilityKindSchema>;

export const createCompatibilityRuleSchema = z.object({
  kind: compatibilityKindSchema,
  leftResourceId: z.uuid(),
  rightResourceId: z.uuid(),
  note: z.string().trim().max(500).optional(),
}).refine((value) => value.leftResourceId !== value.rightResourceId, "A rule needs two different resources");
export type CreateCompatibilityRuleInput = z.infer<typeof createCompatibilityRuleSchema>;

export const compatibilityRuleSchema = z.object({
  id: z.uuid(),
  kind: compatibilityKindSchema,
  left: resourceReferenceSchema,
  right: resourceReferenceSchema,
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type CompatibilityRule = z.infer<typeof compatibilityRuleSchema>;

export const compatibilityRuleListQuerySchema = z.object({
  resourceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const compatibilityRuleListResponseSchema = z.object({ rules: z.array(compatibilityRuleSchema) });
export const compatibilityRuleResponseSchema = z.object({ rule: compatibilityRuleSchema, created: z.boolean() });

export const cloneProjectSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
});
export type CloneProjectInput = z.infer<typeof cloneProjectSchema>;

export const saveProjectAsProfileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: profileTypeSchema,
  description: z.string().trim().max(2_000).optional(),
});
export type SaveProjectAsProfileInput = z.infer<typeof saveProjectAsProfileSchema>;

export const saveProjectAsProfileResponseSchema = z.object({ profile: profileSchema, created: z.boolean() });

export const decisionChangeSchema = z.object({
  slot: z.string(),
  kind: z.enum(["added", "removed", "changed"]),
  fields: z.array(z.enum(["mode", "resource", "source", "constraints", "rationale"])),
  before: compiledDecisionSchema.nullable(),
  after: compiledDecisionSchema.nullable(),
});

export const contextDiffSchema = z.object({
  compilerVersion: z.object({ before: z.string(), after: z.string() }).nullable(),
  project: z.array(z.object({
    field: z.enum(["name", "description", "productType", "stage", "platforms", "priorities"]),
    before: z.string().nullable(),
    after: z.string().nullable(),
  })),
  decisions: z.array(decisionChangeSchema),
  resources: z.object({ added: z.array(compiledResourceSchema), removed: z.array(compiledResourceSchema) }),
  rules: z.object({ added: z.array(z.string()), removed: z.array(z.string()) }),
  warnings: z.object({ added: z.array(compileWarningSchema), removed: z.array(compileWarningSchema) }),
  unchanged: z.boolean(),
});
export type ContextDiff = z.infer<typeof contextDiffSchema>;

export const contextDiffQuerySchema = z.object({
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
});

/** `from`/`diff` are null when the Project has fewer than two versions to compare. */
export const contextDiffResponseSchema = z.object({
  from: contextVersionSummarySchema.nullable(),
  to: contextVersionSummarySchema.nullable(),
  diff: contextDiffSchema.nullable(),
});

export const workspaceSummarySchema = z.object({
  resources: z.number().int().nonnegative(),
  favorites: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  profiles: z.number().int().nonnegative(),
  compiledProjects: z.number().int().nonnegative(),
  contextVersions: z.number().int().nonnegative(),
  exports: z.number().int().nonnegative(),
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

// ---------------------------------------------------------------------------
// V0.3 reliability: audit trail (Handoff 8B)
// ---------------------------------------------------------------------------

/** Aggregate an audit event belongs to; decisions are recorded against their Project or Profile. */
export const auditEntityTypeSchema = z.enum(["account", "resource", "project", "profile", "recipe", "compatibility_rule", "workspace"]);
export type AuditEntityType = z.infer<typeof auditEntityTypeSchema>;

/**
 * Append-only record of a major mutation. `metadata` carries identifiers, enum
 * values, slot keys and counts only; never names, notes, URLs or prompt text.
 */
export const auditEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  entityType: auditEntityTypeSchema,
  entityId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditEventListQuerySchema = z.object({
  entityType: auditEntityTypeSchema.optional(),
  entityId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AuditEventListQuery = z.infer<typeof auditEventListQuerySchema>;

export const auditEventListResponseSchema = z.object({ events: z.array(auditEventSchema) });

// ---------------------------------------------------------------------------
// V1 recipes, onboarding, samples and portability (Handoff 9)
// ---------------------------------------------------------------------------

export const createRecipeSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
  profiles: z.array(projectProfileAttachmentSchema).max(10).optional(),
});
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  profiles: z.array(projectProfileAttachmentSchema).max(10).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

export const setRecipeProfilesSchema = z.object({ profiles: z.array(projectProfileAttachmentSchema).max(10) });

export const recipeSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  decisionCount: z.number().int().nonnegative(),
  profileCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;

/** Full Recipe: attached Profiles (with priority) plus the Recipe's own decisions. */
export const recipeSchema = recipeSummarySchema.extend({
  profiles: z.array(projectProfileSchema),
  decisions: z.array(decisionRecordSchema),
});
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  archived: z.enum(["active", "archived", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type RecipeListQuery = z.infer<typeof recipeListQuerySchema>;

export const recipeListResponseSchema = z.object({ recipes: z.array(recipeSummarySchema), total: z.number().int().nonnegative() });
export const recipeResponseSchema = z.object({ recipe: recipeSchema });
export const recipeProfilesResponseSchema = z.object({ profiles: z.array(projectProfileSchema) });

export const saveProjectAsRecipeSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
});
export type SaveProjectAsRecipeInput = z.infer<typeof saveProjectAsRecipeSchema>;
export const saveProjectAsRecipeResponseSchema = z.object({ recipe: recipeSchema, created: z.boolean() });

// Workspace settings: first-run onboarding and optional sample data.

export const onboardingStateSchema = z.enum(["new", "in_progress", "skipped", "completed"]);
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
export const onboardingChoiceSchema = z.enum(["samples", "import", "empty"]);
export type OnboardingChoice = z.infer<typeof onboardingChoiceSchema>;

export const workspaceSettingsSchema = z.object({
  onboardingState: onboardingStateSchema,
  onboardingChoice: onboardingChoiceSchema.nullable(),
  sampleVersion: z.string().nullable(),
  sampleInstalledAt: z.iso.datetime().nullable(),
  /** Version of the sample set this build can install; differs from `sampleVersion` after an upgrade. */
  currentSampleVersion: z.string(),
});
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export const workspaceSettingsResponseSchema = z.object({ settings: workspaceSettingsSchema });

export const updateOnboardingSchema = z.object({
  state: onboardingStateSchema,
  choice: onboardingChoiceSchema.nullable().optional(),
});
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;

export const sampleCountsSchema = z.object({
  resources: z.number().int().nonnegative(),
  profiles: z.number().int().nonnegative(),
  recipes: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  compatibilityRules: z.number().int().nonnegative(),
});
export type SampleCounts = z.infer<typeof sampleCountsSchema>;
export const sampleInstallResponseSchema = z.object({ settings: workspaceSettingsSchema, created: z.boolean(), counts: sampleCountsSchema });
export const sampleRemoveResponseSchema = z.object({ settings: workspaceSettingsSchema, removed: sampleCountsSchema });

// Portable DevContext JSON (format "devcontext", version 1).

export const portableFormat = "devcontext";
export const portableVersion = 1;

/** Bounds applied before any mutation; the whole document is rejected when one is exceeded. */
export const portableLimits = {
  documentBytes: 32 * 1024 * 1024,
  requestBytes: 32 * 1024 * 1024 + 1024,
  jsonDepth: 20,
  resources: 1_000,
  profiles: 200,
  recipes: 100,
  projects: 200,
  compatibilityRules: 500,
  decisionsPerEntity: 80,
  tagsPerResource: 30,
  attachmentsPerProject: 50,
  profilesPerEntity: 10,
} as const;

const portableRefSchema = z.string().trim().min(1).max(80);

const portableDecisionSchema = z.object({
  slot: decisionSlotSchema,
  mode: decisionModeSchema,
  resourceRef: portableRefSchema.nullable().default(null),
  priority: z.number().int().min(-1000).max(1000).default(0),
  constraints: decisionJsonSchema.default({}),
  rationale: z.string().trim().max(4_000).nullable().default(null),
  conditions: decisionJsonSchema.default({}),
});
export type PortableDecision = z.infer<typeof portableDecisionSchema>;

const portableProfileAttachmentSchema = z.object({
  profileRef: portableRefSchema,
  priority: z.number().int().min(-1000).max(1000).default(0),
});

export const portableResourceSchema = z.object({
  ref: portableRefSchema,
  name: z.string().trim().min(1).max(160),
  type: resourceTypeSchema,
  description: z.string().trim().max(2_000).nullable().default(null),
  sourceUrl: httpUrlSchema.nullable().default(null),
  docsUrl: httpUrlSchema.nullable().default(null),
  repoUrl: httpUrlSchema.nullable().default(null),
  installCommand: z.string().trim().max(1_000).nullable().default(null),
  notes: z.string().trim().max(10_000).nullable().default(null),
  metadata: metadataSchema.default({}),
  tags: z.array(z.string().trim().min(1).max(60)).max(portableLimits.tagsPerResource).default([]),
  favorite: z.boolean().default(false),
  archived: z.boolean().default(false),
  preference: resourcePreferenceInputSchema.nullable().default(null),
});
export type PortableResource = z.infer<typeof portableResourceSchema>;

export const portableProfileSchema = z.object({
  ref: portableRefSchema,
  name: z.string().trim().min(1).max(160),
  type: profileTypeSchema,
  description: z.string().trim().max(2_000).nullable().default(null),
  archived: z.boolean().default(false),
  decisions: z.array(portableDecisionSchema).max(portableLimits.decisionsPerEntity).default([]),
});
export type PortableProfile = z.infer<typeof portableProfileSchema>;

export const portableRecipeSchema = z.object({
  ref: portableRefSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).nullable().default(null),
  archived: z.boolean().default(false),
  profiles: z.array(portableProfileAttachmentSchema).max(portableLimits.profilesPerEntity).default([]),
  decisions: z.array(portableDecisionSchema).max(portableLimits.decisionsPerEntity).default([]),
});
export type PortableRecipe = z.infer<typeof portableRecipeSchema>;

export const portableProjectSchema = z.object({
  ref: portableRefSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4_000).nullable().default(null),
  productType: z.string().trim().max(100).nullable().default(null),
  stage: projectStageSchema.default("mvp"),
  status: projectStatusSchema.default("active"),
  platforms: projectPlatformsSchema.default([]),
  priorities: projectPrioritiesSchema.default([]),
  rules: projectRulesSchema.default([]),
  recipeRef: portableRefSchema.nullable().default(null),
  profiles: z.array(portableProfileAttachmentSchema).max(portableLimits.profilesPerEntity).default([]),
  resourceRefs: z.array(portableRefSchema).max(portableLimits.attachmentsPerProject).default([]),
  decisions: z.array(portableDecisionSchema).max(portableLimits.decisionsPerEntity).default([]),
});
export type PortableProject = z.infer<typeof portableProjectSchema>;

export const portableCompatibilityRuleSchema = z.object({
  kind: compatibilityKindSchema,
  leftRef: portableRefSchema,
  rightRef: portableRefSchema,
  note: z.string().trim().max(500).nullable().default(null),
});
export type PortableCompatibilityRule = z.infer<typeof portableCompatibilityRuleSchema>;

/**
 * The user's structured DevContext data. Refs are opaque per-document keys
 * (exports use entity ids), never database ids on import. History (context
 * versions, export events, audit trail) and anything account-related are
 * deliberately absent.
 */
export const portableDocumentSchema = z.object({
  format: z.literal(portableFormat),
  version: z.literal(portableVersion),
  exportedAt: z.iso.datetime().optional(),
  resources: z.array(portableResourceSchema).max(portableLimits.resources).default([]),
  profiles: z.array(portableProfileSchema).max(portableLimits.profiles).default([]),
  recipes: z.array(portableRecipeSchema).max(portableLimits.recipes).default([]),
  projects: z.array(portableProjectSchema).max(portableLimits.projects).default([]),
  compatibilityRules: z.array(portableCompatibilityRuleSchema).max(portableLimits.compatibilityRules).default([]),
});
export type PortableDocument = z.infer<typeof portableDocumentSchema>;

export const importStrategySchema = z.enum(["skip", "copy", "replace"]);
export type ImportStrategy = z.infer<typeof importStrategySchema>;

/** `document` is validated by the service so version problems get an explicit message. */
export const importRequestSchema = z.object({
  document: z.unknown(),
  strategy: importStrategySchema.default("skip"),
  dryRun: z.boolean().default(true),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export const importActionSchema = z.enum(["create", "skip", "replace", "copy"]);
export type ImportAction = z.infer<typeof importActionSchema>;
export const importEntityTypeSchema = z.enum(["resource", "profile", "recipe", "project", "compatibilityRule"]);

export const importItemSchema = z.object({
  type: importEntityTypeSchema,
  ref: z.string(),
  name: z.string(),
  action: importActionSchema,
  reason: z.string().nullable(),
});
export type ImportItem = z.infer<typeof importItemSchema>;

export const importCountsSchema = z.object({
  create: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  replace: z.number().int().nonnegative(),
  copy: z.number().int().nonnegative(),
});
export type ImportCounts = z.infer<typeof importCountsSchema>;

export const importSummarySchema = z.object({
  strategy: importStrategySchema,
  dryRun: z.boolean(),
  counts: z.object({
    resources: importCountsSchema,
    profiles: importCountsSchema,
    recipes: importCountsSchema,
    projects: importCountsSchema,
    compatibilityRules: importCountsSchema,
  }),
  items: z.array(importItemSchema),
  warnings: z.array(z.string()),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

/** `created` is false when an `Idempotency-Key` replayed an earlier import; `applied` is false for dry runs. */
export const importResponseSchema = z.object({
  summary: importSummarySchema,
  applied: z.boolean(),
  created: z.boolean(),
});

// ---------------------------------------------------------------------------
// Billing and entitlements (Handoff 10). Plans, limits and features are
// defined once on the API; the web renders whatever the API reports.
// ---------------------------------------------------------------------------

export const planIdSchema = z.enum(["free", "pro"]);
export type PlanId = z.infer<typeof planIdSchema>;

export const planLimitKeySchema = z.enum(["projects", "resources", "profiles", "recipes"]);
export type PlanLimitKey = z.infer<typeof planLimitKeySchema>;

export const planLimitsSchema = z.object({
  projects: z.number().int().nonnegative(),
  resources: z.number().int().nonnegative(),
  profiles: z.number().int().nonnegative(),
  recipes: z.number().int().nonnegative(),
});
export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const planFeatureKeySchema = z.enum(["bundle", "diff"]);
export type PlanFeatureKey = z.infer<typeof planFeatureKeySchema>;

export const planFeaturesSchema = z.object({
  exportTargets: z.array(exportTargetSchema),
  bundle: z.boolean(),
  diff: z.boolean(),
  /** Context versions visible in history. */
  historyLimit: z.number().int().positive(),
});
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

export const planDefinitionSchema = z.object({
  id: planIdSchema,
  name: z.string(),
  description: z.string(),
  limits: planLimitsSchema,
  features: planFeaturesSchema,
  /** Display-only, set by the operator when billing goes live; null until then. */
  priceLabel: z.string().nullable(),
});
export type PlanDefinition = z.infer<typeof planDefinitionSchema>;

export const subscriptionStatusSchema = z.enum([
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "expired",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const entitlementReasonSchema = z.enum([
  "no_subscription",
  "active",
  "trialing",
  "renewal_pending",
  "past_due_grace",
  "cancel_at_period_end",
  "period_ended",
  "payment_failed",
  "incomplete",
  "canceled",
]);
export type EntitlementReason = z.infer<typeof entitlementReasonSchema>;

/** What the user can do right now, derived deterministically from the subscription record and the clock. */
export const entitlementSchema = z.object({
  plan: planIdSchema,
  reason: entitlementReasonSchema,
  /** When Pro access ends unless the provider confirms a renewal; null for Free or open-ended. */
  effectiveUntil: z.iso.datetime().nullable(),
  paymentProblem: z.boolean(),
  cancelAtPeriodEnd: z.boolean(),
});
export type Entitlement = z.infer<typeof entitlementSchema>;

export const usageMeterSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});
export type UsageMeter = z.infer<typeof usageMeterSchema>;

export const billingUsageSchema = z.object({
  projects: usageMeterSchema,
  resources: usageMeterSchema,
  profiles: usageMeterSchema,
  recipes: usageMeterSchema,
});
export type BillingUsage = z.infer<typeof billingUsageSchema>;

export const subscriptionViewSchema = z.object({
  status: subscriptionStatusSchema,
  provider: z.string().nullable(),
  currentPeriodStart: z.iso.datetime().nullable(),
  currentPeriodEnd: z.iso.datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.iso.datetime().nullable(),
  /** True when a provider customer exists, so the manage/cancel portal can be opened. */
  manageable: z.boolean(),
});
export type SubscriptionView = z.infer<typeof subscriptionViewSchema>;

export const billingProviderInfoSchema = z.object({
  id: z.string().nullable(),
  configured: z.boolean(),
  /** A fake provider that simulates checkout and webhooks; never true in production. */
  testMode: z.boolean(),
});
export type BillingProviderInfo = z.infer<typeof billingProviderInfoSchema>;

export const billingSummarySchema = z.object({
  entitlement: entitlementSchema,
  usage: billingUsageSchema,
  subscription: subscriptionViewSchema,
  provider: billingProviderInfoSchema,
  plans: z.array(planDefinitionSchema),
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;
export const billingSummaryResponseSchema = z.object({ billing: billingSummarySchema });

export const billingRedirectResponseSchema = z.object({ url: z.url() });
export const billingReconcileResponseSchema = z.object({ entitlement: entitlementSchema, subscription: subscriptionViewSchema });

export const billingWebhookStatusSchema = z.enum(["processed", "duplicate", "ignored", "unmatched"]);
export type BillingWebhookStatus = z.infer<typeof billingWebhookStatusSchema>;
export const billingWebhookResponseSchema = z.object({ received: z.literal(true), eventId: z.string(), status: billingWebhookStatusSchema });

/** Test-mode provider controls; only registered when the fake provider is configured. */
export const billingTestCheckoutSchema = z.object({ outcome: z.enum(["paid", "failed", "canceled"]) });
export const billingTestPortalSchema = z.object({ action: z.enum(["cancel", "resume", "renew", "fail_renewal", "expire"]) });

// ---------------------------------------------------------------------------
// Technology catalog: read-only reference data shipped with the app
// (data/catalog, served by @devcontext/catalog). Scores are editor
// assessments, never measurements; the UI must label them as such.
// ---------------------------------------------------------------------------

export const catalogDomainSchema = z.enum([
  "frontend",
  "backend",
  "database",
  "ai",
  "devops-and-services",
  "mobile-and-desktop",
  "data-engineering",
  "security",
  "turkey",
]);
export type CatalogDomain = z.infer<typeof catalogDomainSchema>;

export const catalogPopularitySchema = z.enum(["very-high", "high", "medium", "niche"]);
export type CatalogPopularity = z.infer<typeof catalogPopularitySchema>;
export const catalogMaturitySchema = z.enum(["mature", "stable", "emerging", "experimental"]);
export type CatalogMaturity = z.infer<typeof catalogMaturitySchema>;
export const catalogLevelSchema = z.enum(["low", "medium", "high"]);
export type CatalogLevel = z.infer<typeof catalogLevelSchema>;
export const catalogPricingSchema = z.enum(["free", "freemium", "paid", "usage-based"]);
export type CatalogPricing = z.infer<typeof catalogPricingSchema>;
export const catalogTeamSizeSchema = z.enum(["solo", "small", "medium", "large"]);
export type CatalogTeamSize = z.infer<typeof catalogTeamSizeSchema>;
export const catalogTimeToMvpSchema = z.enum(["days", "1-2 weeks", "weeks", "months"]);
export type CatalogTimeToMvp = z.infer<typeof catalogTimeToMvpSchema>;
export const catalogStackLayerSchema = z.enum(["language", "frontend", "backend", "database", "infra"]);
export type CatalogStackLayer = z.infer<typeof catalogStackLayerSchema>;
/** 1 (weak, AI errs often) to 5 (excellent); a structured editor assessment. */
export const catalogScoreSchema = z.number().int().min(1).max(5);

/** A slug mentioned by another entry; `known` is false for technologies not yet in the catalog. */
export const catalogReferenceSchema = z.object({
  slug: z.string(),
  name: z.string().nullable(),
  known: z.boolean(),
});
export type CatalogReference = z.infer<typeof catalogReferenceSchema>;

/** Buildability, token efficiency, training-data density and model fit do not apply to AI tools themselves and are null there. */
export const catalogReadinessSchema = z.object({
  docsQuality: catalogScoreSchema,
  adoption: z.string(),
  communitySupport: catalogScoreSchema,
  aiBuildability: catalogScoreSchema.nullable(),
  tokenEfficiency: catalogScoreSchema.nullable(),
  trainingDataDensity: z.string().nullable(),
  bestModels: z.array(z.string()),
  aiPitfalls: z.array(z.string()),
  verdict: z.string(),
});
export type CatalogReadiness = z.infer<typeof catalogReadinessSchema>;

/** Prototype speed and production readiness are deliberately separate scores; never combine them. */
export const catalogVelocitySchema = z.object({
  timeToPrototype: z.string(),
  timeToMvp: z.string().nullable(),
  timeToProductionReady: z.string(),
  prototypeSpeed: catalogScoreSchema,
  productionReadiness: catalogScoreSchema,
  productionGaps: z.array(z.string()),
  opsBurden: z.string().nullable(),
  hiddenCosts: z.array(z.string()),
  verdict: z.string(),
});
export type CatalogVelocity = z.infer<typeof catalogVelocitySchema>;

export const catalogTechnologySummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: resourceTypeSchema,
  domain: catalogDomainSchema,
  category: z.string(),
  summary: z.string(),
  popularity: catalogPopularitySchema,
  maturity: catalogMaturitySchema,
  learningCurve: catalogLevelSchema,
  pricing: catalogPricingSchema,
  license: z.string(),
  tags: z.array(z.string()),
  aiBuildability: catalogScoreSchema.nullable(),
});
export type CatalogTechnologySummary = z.infer<typeof catalogTechnologySummarySchema>;

export const catalogTechnologySchema = catalogTechnologySummarySchema.extend({
  whatFor: z.string(),
  whereUsed: z.string(),
  commonUse: z.string(),
  strengths: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  docsUrl: z.string(),
  repoUrl: z.string().nullable(),
  installCommand: z.string().nullable(),
  alternatives: z.array(catalogReferenceSchema),
  pairsWith: z.array(catalogReferenceSchema),
  readiness: catalogReadinessSchema.nullable(),
  velocity: catalogVelocitySchema.nullable(),
  stacks: z.array(z.object({ slug: z.string(), name: z.string() })),
});
export type CatalogTechnology = z.infer<typeof catalogTechnologySchema>;

export const catalogStackSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  teamSize: catalogTeamSizeSchema,
  learningCurve: catalogLevelSchema,
  timeToMvp: catalogTimeToMvpSchema,
  tags: z.array(z.string()),
  technologyCount: z.number().int().nonnegative(),
  prototypeSpeed: catalogScoreSchema.nullable(),
  productionReadiness: catalogScoreSchema.nullable(),
  /** The first known technologies across layers, for compact previews. */
  highlights: z.array(catalogReferenceSchema),
});
export type CatalogStackSummary = z.infer<typeof catalogStackSummarySchema>;

export const catalogStackSchema = catalogStackSummarySchema.extend({
  layers: z.array(z.object({ layer: catalogStackLayerSchema, technologies: z.array(catalogReferenceSchema) })),
  bestFor: z.array(z.string()),
  notFor: z.array(z.string()),
  performance: z.string(),
  scalability: z.string(),
  cost: z.string(),
  aiFriendliness: z.string(),
  usedBy: z.array(z.string()),
  velocity: catalogVelocitySchema.nullable(),
});
export type CatalogStack = z.infer<typeof catalogStackSchema>;

export const catalogDomainInfoSchema = z.object({
  id: catalogDomainSchema,
  label: z.string(),
  count: z.number().int().nonnegative(),
  note: z.string().nullable(),
});
export type CatalogDomainInfo = z.infer<typeof catalogDomainInfoSchema>;

export const catalogOverviewSchema = z.object({
  version: z.string(),
  technologyCount: z.number().int().nonnegative(),
  stackCount: z.number().int().nonnegative(),
  readinessCount: z.number().int().nonnegative(),
  velocityCount: z.number().int().nonnegative(),
  pendingReferenceCount: z.number().int().nonnegative(),
  domains: z.array(catalogDomainInfoSchema),
  methodology: z.object({
    measured: z.array(z.string()),
    estimated: z.array(z.string()),
    warning: z.string(),
    scoreScale: z.record(z.string(), z.string()),
    fieldMeanings: z.record(z.string(), z.string()),
    velocityStatus: z.string(),
    velocityBaseline: z.string(),
    velocityWarning: z.string(),
  }),
});
export type CatalogOverview = z.infer<typeof catalogOverviewSchema>;

export const catalogTechnologyListQuerySchema = z.object({
  domain: catalogDomainSchema.optional(),
  type: resourceTypeSchema.optional(),
  q: z.string().trim().max(160).optional(),
  tag: z.string().trim().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type CatalogTechnologyListQuery = z.infer<typeof catalogTechnologyListQuerySchema>;

export const catalogOverviewResponseSchema = z.object({ catalog: catalogOverviewSchema });
export const catalogTechnologyListResponseSchema = z.object({
  technologies: z.array(catalogTechnologySummarySchema),
  total: z.number().int().nonnegative(),
});
export const catalogTechnologyResponseSchema = z.object({ technology: catalogTechnologySchema });
export const catalogStackListResponseSchema = z.object({ stacks: z.array(catalogStackSummarySchema) });
export const catalogStackResponseSchema = z.object({ stack: catalogStackSchema });

/** Catalog slug → id of the active Library Resource created from it. */
export const catalogLibraryLinksResponseSchema = z.object({ links: z.record(z.string(), z.uuid()) });
export type CatalogLibraryLinks = z.infer<typeof catalogLibraryLinksResponseSchema>["links"];

/** `created` is false when the technology was already in the Library (an archived copy is restored). */
export const catalogLibraryAddResponseSchema = z.object({ resource: resourceSchema, created: z.boolean() });
export type CatalogLibraryAddResult = z.infer<typeof catalogLibraryAddResponseSchema>;

export const catalogStackLibraryResultSchema = z.object({
  created: z.array(resourceSchema),
  existing: z.array(resourceSchema),
  /** Layer slugs the catalog does not describe yet; nothing is created for them. */
  skipped: z.array(z.string()),
});
export type CatalogStackLibraryResult = z.infer<typeof catalogStackLibraryResultSchema>;

export const catalogPresetDecisionSchema = z.object({
  slot: decisionSlotSchema,
  resourceId: z.uuid(),
  name: z.string(),
  technologySlug: z.string(),
});
export type CatalogPresetDecision = z.infer<typeof catalogPresetDecisionSchema>;

/** `created` is false when an active stack Profile with the preset's name already existed; its decisions are left untouched. */
export const catalogStackProfileResponseSchema = z.object({
  profile: profileSchema,
  created: z.boolean(),
  decisions: z.array(catalogPresetDecisionSchema),
  library: catalogStackLibraryResultSchema,
});
export type CatalogStackProfileResult = z.infer<typeof catalogStackProfileResponseSchema>;

// ---------------------------------------------------------------------------
// Account lifecycle, structured data export and legal surfaces (Handoff 11)
// ---------------------------------------------------------------------------

export const accountDeletionStatusSchema = z.enum(["none", "pending_external", "completed"]);
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>;

export const accountDeletionViewSchema = z.object({
  status: accountDeletionStatusSchema,
  attempts: z.number().int().nonnegative(),
  requestedAt: z.iso.datetime().nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
  /** Content-free failure code of the last attempt, for example `billing_provider_unavailable`. */
  lastError: z.string().nullable(),
  /** True when the last attempt stopped at an external step and the same request can simply be sent again. */
  retryable: z.boolean(),
});
export type AccountDeletionView = z.infer<typeof accountDeletionViewSchema>;

export const accountStoredCountsSchema = z.object({
  resources: z.number().int().nonnegative(),
  tags: z.number().int().nonnegative(),
  profiles: z.number().int().nonnegative(),
  recipes: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  decisions: z.number().int().nonnegative(),
  compatibilityRules: z.number().int().nonnegative(),
  contextVersions: z.number().int().nonnegative(),
  exports: z.number().int().nonnegative(),
  auditEvents: z.number().int().nonnegative(),
  importRequests: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
});
export type AccountStoredCounts = z.infer<typeof accountStoredCountsSchema>;

export const accountIntegrationsSchema = z.object({
  billing: z.object({
    provider: z.string().nullable(),
    configured: z.boolean(),
    testMode: z.boolean(),
    plan: planIdSchema,
    status: subscriptionStatusSchema,
    /** A provider customer exists, so cancellation happens through the provider portal or at deletion. */
    linked: z.boolean(),
  }),
  /** Connected external services other than billing; this build has none (no GitHub, no AI provider). */
  external: z.array(z.object({ id: z.string(), name: z.string(), connectedAt: z.iso.datetime().nullable() })),
});
export type AccountIntegrations = z.infer<typeof accountIntegrationsSchema>;

export const accountProcessingSchema = z.object({
  /** No request ever leaves the API for an AI provider; compilation is deterministic and local. */
  externalAi: z.literal(false),
  /** Imported URLs, prompts, rules and install commands are stored as text and never fetched or executed. */
  importedContentStoredAsData: z.literal(true),
});

export const accountSummarySchema = z.object({
  user: currentUserSchema,
  createdAt: z.iso.datetime(),
  stored: accountStoredCountsSchema,
  integrations: accountIntegrationsSchema,
  processing: accountProcessingSchema,
  deletion: accountDeletionViewSchema,
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export const accountSummaryResponseSchema = z.object({ account: accountSummarySchema });

export const deleteAccountRequestSchema = z.object({
  /** Re-entered password, checked by Better Auth against the credential account; never logged. */
  password: z.string().min(1).max(128),
  /** The account e-mail typed by the user; a mismatch refuses the request before any other step runs. */
  confirmation: z.string().trim().min(1).max(254),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
export const deleteAccountResponseSchema = z.object({ deleted: z.literal(true), deletion: accountDeletionViewSchema });

export const accountExportFormat = "devcontext-account";
export const accountExportVersion = 1;

/**
 * Everything the account owns, wrapped around the portable workspace document
 * (format "devcontext", version 1). No password hash, session token, provider
 * secret or verification value is ever part of it.
 */
export const accountExportSchema = z.object({
  format: z.literal(accountExportFormat),
  version: z.literal(accountExportVersion),
  exportedAt: z.iso.datetime(),
  account: z.object({ id: z.uuid(), email: z.email(), name: z.string(), createdAt: z.iso.datetime() }),
  settings: z.object({
    onboardingState: onboardingStateSchema,
    onboardingChoice: onboardingChoiceSchema.nullable(),
    sampleVersion: z.string().nullable(),
    sampleInstalledAt: z.iso.datetime().nullable(),
  }),
  subscription: z.object({
    plan: planIdSchema,
    status: subscriptionStatusSchema,
    provider: z.string().nullable(),
    currentPeriodEnd: z.iso.datetime().nullable(),
    cancelAtPeriodEnd: z.boolean(),
  }),
  workspace: portableDocumentSchema,
  contextVersions: z.array(z.object({
    projectId: z.uuid(),
    projectName: z.string(),
    version: z.number().int().positive(),
    compilerVersion: z.string(),
    contentHash: z.string(),
    createdAt: z.iso.datetime(),
    canonical: z.record(z.string(), z.unknown()),
  })),
  exports: z.array(z.object({ projectId: z.uuid(), target: z.string(), createdAt: z.iso.datetime() })),
  auditEvents: z.array(auditEventSchema),
});
export type AccountExport = z.infer<typeof accountExportSchema>;

/**
 * Factual, configuration-driven inputs of the Terms and Privacy pages. Values
 * the operator has not supplied are null and listed in `missing`; the pages
 * stay drafts until every value is present and `LEGAL_APPROVED_AT` is set.
 */
export const legalConfigSchema = z.object({
  productName: z.string(),
  draft: z.boolean(),
  approvedAt: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  entity: z.object({
    name: z.string().nullable(),
    address: z.string().nullable(),
    contactEmail: z.string().nullable(),
    jurisdiction: z.string().nullable(),
  }),
  processing: z.object({
    externalAi: z.literal(false),
    billingProvider: z.string().nullable(),
    billingTestMode: z.boolean(),
    hostingRegion: z.string().nullable(),
    subprocessors: z.array(z.string()),
  }),
  retention: z.object({
    accountDeletion: z.literal("immediate"),
    billingRecordsYears: z.number().int().nullable(),
    backupDays: z.number().int().nullable(),
  }),
  /** Environment variables still unset; each one is rendered as an explicit placeholder, never as a claim. */
  missing: z.array(z.string()),
});
export type LegalConfig = z.infer<typeof legalConfigSchema>;
export const legalConfigResponseSchema = z.object({ legal: legalConfigSchema });
