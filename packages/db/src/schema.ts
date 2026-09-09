import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const resourceType = pgEnum("resource_type", [
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

export const decisionMode = pgEnum("decision_mode", [
  "LOCKED",
  "PREFERRED",
  "AI_DECIDE",
  "DISABLED",
]);

export const profileType = pgEnum("profile_type", [
  "stack",
  "design",
  "ai",
  "deployment",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("sessions_token_unique").on(table.token),
  index("sessions_user_id_idx").on(table.userId),
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("accounts_provider_account_unique").on(table.providerId, table.accountId),
  index("accounts_user_id_idx").on(table.userId),
]);

export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("verifications_identifier_idx").on(table.identifier),
]);

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: resourceType("type").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"),
  docsUrl: text("docs_url"),
  repoUrl: text("repo_url"),
  installCommand: text("install_command"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  favorite: boolean("favorite").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("resources_owner_slug_unique").on(table.ownerUserId, table.slug),
  index("resources_owner_type_idx").on(table.ownerUserId, table.type),
  index("resources_owner_lower_name_idx").on(table.ownerUserId, sql`lower(${table.name})`),
]);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
}, (table) => [
  uniqueIndex("tags_owner_name_unique").on(table.ownerUserId, table.name),
]);

export const resourceTags = pgTable("resource_tags", {
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.resourceId, table.tagId] }),
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: profileType("type").notNull(),
  description: text("description"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("profiles_owner_slug_unique").on(table.ownerUserId, table.slug),
  index("profiles_owner_type_idx").on(table.ownerUserId, table.type),
  index("profiles_owner_lower_name_idx").on(table.ownerUserId, sql`lower(${table.name})`),
]);

export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("recipes_owner_slug_unique").on(table.ownerUserId, table.slug),
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientRequestId: uuid("client_request_id").defaultRandom().notNull(),
  /** Applied Recipe (reference, never a copy); its decisions rank between Project and Profile scope. */
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  productType: text("product_type"),
  stage: text("stage").notNull().default("mvp"),
  status: text("status").notNull().default("active"),
  platforms: jsonb("platforms").$type<string[]>().notNull().default([]),
  priorities: jsonb("priorities").$type<string[]>().notNull().default([]),
  rules: jsonb("rules").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("projects_owner_slug_unique").on(table.ownerUserId, table.slug),
  uniqueIndex("projects_owner_request_unique").on(table.ownerUserId, table.clientRequestId),
  index("projects_owner_status_idx").on(table.ownerUserId, table.status),
  index("projects_owner_lower_name_idx").on(table.ownerUserId, sql`lower(${table.name})`),
  index("projects_recipe_idx").on(table.recipeId),
]);

export const projectResources = pgTable("project_resources", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.resourceId] }),
  index("project_resources_resource_idx").on(table.resourceId),
]);

export const projectProfiles = pgTable("project_profiles", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.profileId] }),
]);

export const recipeProfiles = pgTable("recipe_profiles", {
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.recipeId, table.profileId] }),
]);

const decisionColumns = {
  mode: decisionMode("mode").notNull(),
  resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "set null" }),
  priority: integer("priority").notNull().default(0),
  constraints: jsonb("constraints").$type<Record<string, unknown>>().notNull().default({}),
  rationale: text("rationale"),
  conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const globalDecisions = pgTable("global_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  ...decisionColumns,
}, (table) => [
  uniqueIndex("global_decisions_owner_slot_unique").on(table.ownerUserId, table.slot),
]);

export const profileDecisions = pgTable("profile_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  ...decisionColumns,
}, (table) => [
  uniqueIndex("profile_decisions_profile_slot_unique").on(table.profileId, table.slot),
]);

export const recipeDecisions = pgTable("recipe_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  ...decisionColumns,
}, (table) => [
  uniqueIndex("recipe_decisions_recipe_slot_unique").on(table.recipeId, table.slot),
]);

export const projectDecisions = pgTable("project_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  slot: text("slot").notNull(),
  ...decisionColumns,
}, (table) => [
  uniqueIndex("project_decisions_project_slot_unique").on(table.projectId, table.slot),
]);

export const compatibilityKind = pgEnum("compatibility_kind", ["conflicts", "requires"]);

/**
 * Manually curated, owner-scoped compatibility rules between two Library
 * Resources. Evaluated deterministically by the compiler; never auto-applied.
 */
export const compatibilityRules = pgTable("compatibility_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  leftResourceId: uuid("left_resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  rightResourceId: uuid("right_resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  kind: compatibilityKind("kind").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("compatibility_rules_unique").on(table.ownerUserId, table.leftResourceId, table.rightResourceId, table.kind),
  index("compatibility_rules_left_idx").on(table.leftResourceId),
  index("compatibility_rules_right_idx").on(table.rightResourceId),
]);

export const contextVersions = pgTable("context_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  compilerVersion: text("compiler_version").notNull(),
  canonical: jsonb("canonical").$type<Record<string, unknown>>().notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("context_project_version_unique").on(table.projectId, table.version),
  index("context_project_latest_idx").on(table.projectId, table.createdAt),
]);

export const exportEvents = pgTable("export_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contextVersionId: uuid("context_version_id").references(() => contextVersions.id, { onDelete: "set null" }),
  target: text("target").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Append-only trail of major user-visible mutations (clone, decision changes,
 * compile/export, archive/restore, account events). The repository exposes
 * insert and read only; metadata holds identifiers, enum values and counts,
 * never Resource content. Rows follow the actor on account deletion.
 */
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("audit_events_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("audit_events_entity_idx").on(table.entityType, table.entityId),
]);

/**
 * Per-user workspace state that is not a domain entity: first-run onboarding
 * progress (skip/resume) and which versioned sample set is installed.
 */
export const workspaceSettings = pgTable("workspace_settings", {
  ownerUserId: uuid("owner_user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  onboardingState: text("onboarding_state").notNull().default("new"),
  onboardingChoice: text("onboarding_choice"),
  sampleVersion: text("sample_version"),
  sampleInstalledAt: timestamp("sample_installed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Every entity created by the optional sample set, keyed so installation is
 * idempotent and removal deletes exactly what was installed. No foreign key on
 * entity_id because rows span several tables; removal tolerates missing rows.
 */
export const workspaceSamples = pgTable("workspace_samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  key: text("key").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("workspace_samples_owner_key_unique").on(table.ownerUserId, table.key),
]);

/**
 * One billing record per user (Handoff 10). Plan and status mirror the payment
 * provider's view; entitlements are derived from them at read time so delayed
 * or reordered provider events cannot grant more than the provider confirmed.
 * Only provider identifiers are stored; card and invoice data never are.
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("none"),
  provider: text("provider"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  /** Provider timestamp of the last applied event; older events are ignored. */
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("subscriptions_owner_unique").on(table.ownerUserId),
  index("subscriptions_provider_customer_idx").on(table.provider, table.providerCustomerId),
  index("subscriptions_provider_subscription_idx").on(table.provider, table.providerSubscriptionId),
]);

/**
 * Every provider webhook event that reached the API, keyed by the provider's
 * event id so retries are answered without re-applying. `status` records
 * whether the event was processed, ignored as stale or left unmatched.
 */
export const billingEvents = pgTable("billing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  type: text("type").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("received"),
  note: text("note"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("billing_events_provider_event_unique").on(table.provider, table.providerEventId),
  index("billing_events_owner_idx").on(table.ownerUserId, table.receivedAt),
]);

/** Completed portable-JSON imports; a replayed request id returns the stored summary instead of importing again. */
export const importRequests = pgTable("import_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull(),
  strategy: text("strategy").notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("import_requests_owner_request_unique").on(table.ownerUserId, table.requestId),
]);

/**
 * Account deletion ledger (Handoff 11). One row per user who asked for
 * deletion; it survives the user row on purpose so a retry after an external
 * failure and support questions about a vanished account can be answered.
 * Only identifiers and enum values are stored: the provider references are
 * the legally required minimal billing record, nothing here names the person.
 */
export const accountDeletions = pgTable("account_deletions", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** No foreign key: the user row is gone once deletion completes. */
  userId: uuid("user_id").notNull(),
  status: text("status").notNull().default("requested"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  billingProvider: text("billing_provider"),
  billingCustomerId: text("billing_customer_id"),
  billingSubscriptionId: text("billing_subscription_id"),
  billingPlan: text("billing_plan"),
  billingStatus: text("billing_status"),
  billingRevokedAt: timestamp("billing_revoked_at", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  requestId: text("request_id"),
}, (table) => [
  uniqueIndex("account_deletions_user_unique").on(table.userId),
  index("account_deletions_status_idx").on(table.status, table.requestedAt),
]);
