import {
  accountSummaryResponseSchema,
  adminFeedbackListResponseSchema,
  adminOverviewResponseSchema,
  feedbackListResponseSchema,
  aiStatusResponseSchema,
  aiSuggestionListResponseSchema,
  auditEventListResponseSchema,
  auditPresenceResponseSchema,
  billingSummaryResponseSchema,
  legalConfigResponseSchema,
  authOptionsResponseSchema,
  type AuthOptions,
  catalogLibraryLinksResponseSchema,
  catalogOverviewResponseSchema,
  catalogSlotSuggestionsResponseSchema,
  catalogStackListResponseSchema,
  catalogStackResponseSchema,
  catalogSuggestionsResponseSchema,
  catalogTechnologyListResponseSchema,
  catalogTechnologyResponseSchema,
  contextStateResponseSchema,
  contextVersionListResponseSchema,
  exportListResponseSchema,
  globalDecisionsResponseSchema,
  healthResponseSchema,
  profileListResponseSchema,
  profileResponseSchema,
  projectContextStatusResponseSchema,
  projectDecisionsResponseSchema,
  projectListResponseSchema,
  projectResponseSchema,
  recipeListResponseSchema,
  recipeResponseSchema,
  resourceListResponseSchema,
  workspaceSettingsResponseSchema,
  workspaceSummarySchema,
  type AccountSummary,
  type AdminFeedback,
  type AdminOverview,
  type Feedback,
  type FeedbackStatus,
  type AiStatus,
  type AiSuggestion,
  type AuditEvent,
  type AuditPresence,
  type BillingSummary,
  type LegalConfig,
  type CatalogLibraryLinks,
  type CatalogOverview,
  type CatalogSlotSuggestions,
  type CatalogStack,
  type CatalogStackSummary,
  type CatalogSuggestions,
  type CatalogTechnology,
  type CatalogTechnologySummary,
  type ContextState,
  type ContextVersionSummary,
  type CurrentUser,
  type DecisionRecord,
  type ExportEvent,
  type Profile,
  type ProfileSummary,
  type Project,
  type ProjectContextStatus,
  type ProjectDecisionView,
  type Recipe,
  type RecipeSummary,
  type Resource,
  type WorkspaceSettings,
  type WorkspaceSummary,
} from "@devcontext/contracts";
import { cache } from "react";
import { z } from "zod";
import { readSession } from "./session";

/**
 * Server-side readers for pages. Every response is validated against the
 * shared contract; anything unexpected (network failure, non-2xx, malformed
 * body) becomes `null` so pages can show an honest "could not load" state.
 * Readers keyed by an entity are wrapped in React `cache()`: a page and its
 * `generateMetadata` share one request per render.
 */

const apiUrlSchema = z.url().refine((value) => ["http:", "https:"].includes(URL.parse(value)?.protocol ?? ""));

/** Development default; a production server without `API_URL` refuses to guess. */
const developmentApiUrl = "http://localhost:4000";

function configuredApiUrl() {
  const value = process.env.API_URL;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("API_URL is not configured");
  return developmentApiUrl;
}

export function getApiBaseUrl(apiUrl: string = configuredApiUrl()) {
  return apiUrlSchema.parse(apiUrl);
}

/** Server-side reads wait at most this long; the page then shows its unavailable state. */
const readTimeoutMs = 5_000;

export async function getWorkspaceStatus(apiUrl?: string): Promise<"connected" | "unavailable"> {
  try {
    const base = getApiBaseUrl(apiUrl);
    const response = await fetch(new URL("/health", base), {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return "unavailable";
    return healthResponseSchema.safeParse(await response.json()).success ? "connected" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Server-side read on behalf of the signed-in user; the session cookie is forwarded untouched. */
function fetchAsUser(path: string, cookieHeader: string, apiUrl: string | undefined, searchParams?: URLSearchParams) {
  const target = new URL(path, getApiBaseUrl(apiUrl));
  if (searchParams) target.search = searchParams.toString();
  return fetch(target, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    signal: AbortSignal.timeout(readTimeoutMs),
  });
}

/** One validated read: the parsed and picked value, or null for any failure. */
async function readAsUser<S extends z.ZodType, T>(
  path: string | null,
  schema: S,
  pick: (data: z.infer<S>) => T,
  cookieHeader: string,
  apiUrl?: string,
  searchParams?: URLSearchParams,
): Promise<T | null> {
  if (path === null) return null;
  try {
    const response = await fetchAsUser(path, cookieHeader, apiUrl, searchParams);
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? pick(parsed.data) : null;
  } catch {
    return null;
  }
}

/** One encoded path segment; empty and dot segments (which URL parsing would resolve away) read as "not found". */
function entityPath(prefix: string, id: string, suffix = ""): string | null {
  if (id === "" || /^(?:\.|%2e){1,2}$/i.test(id)) return null;
  return `${prefix}/${encodeURIComponent(id)}${suffix}`;
}

/** Signed-in user or null; pages that must tell an outage apart from a signed-out visitor use `readSession`. */
export async function getCurrentUser(cookieHeader: string, apiUrl?: string): Promise<CurrentUser | null> {
  const session = await readSession(cookieHeader, apiUrl);
  return session.status === "authenticated" ? session.user : null;
}

/** The caller's own audit trail, newest first; null when it cannot be loaded. */
export function getAuditEvents(cookieHeader: string, searchParams: URLSearchParams = new URLSearchParams({ limit: "8" }), apiUrl?: string): Promise<AuditEvent[] | null> {
  return readAsUser("/v1/audit", auditEventListResponseSchema, (data) => data.events, cookieHeader, apiUrl, searchParams);
}

/** Previous sign-in and newest activity for the overview greeting; null when unavailable. */
export function getAuditPresence(cookieHeader: string, apiUrl?: string): Promise<AuditPresence | null> {
  return readAsUser("/v1/audit/presence", auditPresenceResponseSchema, (data) => data.presence, cookieHeader, apiUrl);
}

/** Library page; null when the list could not be loaded (never an empty list pretending to be real). */
export function getResourceList(cookieHeader: string, searchParams: URLSearchParams = new URLSearchParams(), apiUrl?: string): Promise<{ resources: Resource[]; total: number } | null> {
  return readAsUser("/v1/resources", resourceListResponseSchema, (data) => data, cookieHeader, apiUrl, searchParams);
}

export function getProjectList(cookieHeader: string, searchParams: URLSearchParams = new URLSearchParams(), apiUrl?: string): Promise<{ projects: Project[]; total: number } | null> {
  return readAsUser("/v1/projects", projectListResponseSchema, (data) => data, cookieHeader, apiUrl, searchParams);
}

/** `null` when the Project is missing or the decisions could not be loaded, so the page can say so. */
export function getProjectDecisions(cookieHeader: string, projectId: string, apiUrl?: string): Promise<ProjectDecisionView[] | null> {
  return readAsUser(entityPath("/v1/projects", projectId, "/decisions"), projectDecisionsResponseSchema, (data) => data.decisions, cookieHeader, apiUrl);
}

/** Full context state (canonical, previews): only the context and stack screens need it. */
export function getProjectContext(cookieHeader: string, projectId: string, apiUrl?: string): Promise<ContextState | null> {
  return readAsUser(entityPath("/v1/projects", projectId, "/context"), contextStateResponseSchema, (data) => data, cookieHeader, apiUrl);
}

/** Freshness of many Projects in one request, keyed by id; missing ids could not be loaded. */
export async function getContextStatuses(cookieHeader: string, projectIds: string[], apiUrl?: string): Promise<Map<string, ProjectContextStatus>> {
  const ids = [...new Set(projectIds)].slice(0, 50);
  if (ids.length === 0) return new Map();
  const statuses = await readAsUser("/v1/projects/context-status", projectContextStatusResponseSchema, (data) => data.statuses, cookieHeader, apiUrl, new URLSearchParams({ ids: ids.join(",") }));
  return new Map((statuses ?? []).map((status) => [status.projectId, status]));
}

export async function getContextVersions(cookieHeader: string, projectId: string, apiUrl?: string): Promise<ContextVersionSummary[]> {
  return (await readAsUser(entityPath("/v1/projects", projectId, "/context/versions"), contextVersionListResponseSchema, (data) => data.versions, cookieHeader, apiUrl)) ?? [];
}

export async function getExportHistory(cookieHeader: string, projectId: string, apiUrl?: string): Promise<ExportEvent[]> {
  return (await readAsUser(entityPath("/v1/projects", projectId, "/exports"), exportListResponseSchema, (data) => data.exports, cookieHeader, apiUrl)) ?? [];
}

export function getProfileList(cookieHeader: string, searchParams: URLSearchParams = new URLSearchParams(), apiUrl?: string): Promise<{ profiles: ProfileSummary[]; total: number } | null> {
  return readAsUser("/v1/profiles", profileListResponseSchema, (data) => data, cookieHeader, apiUrl, searchParams);
}

export const getProfile = cache((cookieHeader: string, profileId: string, apiUrl?: string): Promise<Profile | null> =>
  readAsUser(entityPath("/v1/profiles", profileId), profileResponseSchema, (data) => data.profile, cookieHeader, apiUrl));

export async function getGlobalDecisions(cookieHeader: string, apiUrl?: string): Promise<DecisionRecord[]> {
  return (await readAsUser("/v1/global-decisions", globalDecisionsResponseSchema, (data) => data.decisions, cookieHeader, apiUrl)) ?? [];
}

export function getWorkspaceSummary(cookieHeader: string, apiUrl?: string): Promise<WorkspaceSummary | null> {
  return readAsUser("/v1/workspace/summary", z.object({ summary: workspaceSummarySchema }), (data) => data.summary, cookieHeader, apiUrl);
}

export function getRecipeList(cookieHeader: string, searchParams: URLSearchParams = new URLSearchParams(), apiUrl?: string): Promise<{ recipes: RecipeSummary[]; total: number } | null> {
  return readAsUser("/v1/recipes", recipeListResponseSchema, (data) => data, cookieHeader, apiUrl, searchParams);
}

export const getRecipe = cache((cookieHeader: string, recipeId: string, apiUrl?: string): Promise<Recipe | null> =>
  readAsUser(entityPath("/v1/recipes", recipeId), recipeResponseSchema, (data) => data.recipe, cookieHeader, apiUrl));

/** Onboarding and sample state; null when the API cannot be reached so pages can say so. */
export function getWorkspaceSettings(cookieHeader: string, apiUrl?: string): Promise<WorkspaceSettings | null> {
  return readAsUser("/v1/workspace/settings", workspaceSettingsResponseSchema, (data) => data.settings, cookieHeader, apiUrl);
}

/** Plan, usage, subscription and provider state; null when the API cannot be reached. */
export function getBillingSummary(cookieHeader: string, apiUrl?: string): Promise<BillingSummary | null> {
  return readAsUser("/v1/billing", billingSummaryResponseSchema, (data) => data.billing, cookieHeader, apiUrl);
}

/** Catalog metadata: counts, domains and the methodology disclaimer; null when the API cannot be reached. */
export function getCatalogOverview(cookieHeader: string, apiUrl?: string): Promise<CatalogOverview | null> {
  return readAsUser("/v1/catalog", catalogOverviewResponseSchema, (data) => data.catalog, cookieHeader, apiUrl);
}

export function getCatalogTechnologies(cookieHeader: string, searchParams: URLSearchParams = new URLSearchParams(), apiUrl?: string): Promise<{ technologies: CatalogTechnologySummary[]; total: number } | null> {
  return readAsUser("/v1/catalog/technologies", catalogTechnologyListResponseSchema, (data) => data, cookieHeader, apiUrl, searchParams);
}

/** Null for an unknown slug or an unreachable API; pages treat both as "not found". */
export const getCatalogTechnology = cache((cookieHeader: string, slug: string, apiUrl?: string): Promise<CatalogTechnology | null> =>
  readAsUser(entityPath("/v1/catalog/technologies", slug), catalogTechnologyResponseSchema, (data) => data.technology, cookieHeader, apiUrl));

export function getCatalogStacks(cookieHeader: string, apiUrl?: string): Promise<CatalogStackSummary[] | null> {
  return readAsUser("/v1/catalog/stacks", catalogStackListResponseSchema, (data) => data.stacks, cookieHeader, apiUrl);
}

export const getCatalogStack = cache((cookieHeader: string, slug: string, apiUrl?: string): Promise<CatalogStack | null> =>
  readAsUser(entityPath("/v1/catalog/stacks", slug), catalogStackResponseSchema, (data) => data.stack, cookieHeader, apiUrl));

/** Read-only catalog picks for the overview, based on the Library; null when unavailable. */
export function getCatalogSuggestions(cookieHeader: string, apiUrl?: string): Promise<CatalogSuggestions | null> {
  return readAsUser("/v1/catalog/suggestions", catalogSuggestionsResponseSchema, (data) => data.suggestions, cookieHeader, apiUrl);
}

/** Project wizard picks per decision slot and Library usage counts; null when unavailable (the wizard then lists the Library only). */
export function getSlotSuggestions(cookieHeader: string, apiUrl?: string): Promise<CatalogSlotSuggestions | null> {
  return readAsUser("/v1/catalog/slot-suggestions", catalogSlotSuggestionsResponseSchema, (data) => data.suggestions, cookieHeader, apiUrl);
}

/** Catalog slug → Library Resource id for entries already saved; empty when unavailable. */
export async function getCatalogLibraryLinks(cookieHeader: string, apiUrl?: string): Promise<CatalogLibraryLinks> {
  return (await readAsUser("/v1/catalog/library", catalogLibraryLinksResponseSchema, (data) => data.links, cookieHeader, apiUrl)) ?? {};
}

export const getProject = cache((cookieHeader: string, projectId: string, apiUrl?: string): Promise<Project | null> =>
  readAsUser(entityPath("/v1/projects", projectId), projectResponseSchema, (data) => data.project, cookieHeader, apiUrl));

/** What the account stores, its integrations and any pending deletion state; null when the API cannot be reached. */
export function getAccountSummary(cookieHeader: string, apiUrl?: string): Promise<AccountSummary | null> {
  return readAsUser("/v1/account", accountSummaryResponseSchema, (data) => data.account, cookieHeader, apiUrl);
}

/** AI availability, the user's consent and the monthly quota; null when the API cannot be reached. */
export function getAiStatus(cookieHeader: string, apiUrl?: string): Promise<AiStatus | null> {
  return readAsUser("/v1/ai", aiStatusResponseSchema, (data) => data.ai, cookieHeader, apiUrl);
}

/** Pending AI suggestions of a Project, newest first; empty when unavailable. */
export async function getAiSuggestions(cookieHeader: string, projectId: string, apiUrl?: string): Promise<AiSuggestion[]> {
  return (await readAsUser(entityPath("/v1/projects", projectId, "/ai/suggestions"), aiSuggestionListResponseSchema, (data) => data.suggestions, cookieHeader, apiUrl)) ?? [];
}

/** The signed-in user's own feedback reports, newest first; null when they cannot be loaded. */
export function getOwnFeedback(cookieHeader: string, apiUrl?: string): Promise<Feedback[] | null> {
  return readAsUser("/v1/feedback", feedbackListResponseSchema, (data) => data.feedback, cookieHeader, apiUrl);
}

/** Operator feedback inbox for one triage state; null when forbidden or unavailable (the overview tells those apart). */
export function getAdminFeedback(cookieHeader: string, status: FeedbackStatus | "all", apiUrl?: string): Promise<AdminFeedback[] | null> {
  return readAsUser("/v1/admin/feedback", adminFeedbackListResponseSchema, (data) => data.feedback, cookieHeader, apiUrl, new URLSearchParams({ status }));
}

export type AdminOverviewResult =
  | { status: "ok"; overview: AdminOverview }
  | { status: "forbidden" }
  | { status: "unavailable" };

/** Operator overview; "forbidden" (403) is kept apart from an outage so the page can tell them apart. */
export async function getAdminOverview(cookieHeader: string, apiUrl?: string): Promise<AdminOverviewResult> {
  try {
    const response = await fetchAsUser("/v1/admin/overview", cookieHeader, apiUrl);
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) return { status: "unavailable" };
    const parsed = adminOverviewResponseSchema.safeParse(await response.json());
    return parsed.success ? { status: "ok", overview: parsed.data.overview } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Public, configuration-driven inputs of the Terms and Privacy pages; null when the API cannot be reached. */
/** Public sign-in options; an unreachable API means "no optional features", never a broken link. */
export async function getAuthOptions(apiUrl?: string): Promise<AuthOptions> {
  try {
    const response = await fetch(new URL("/v1/auth/options", getApiBaseUrl(apiUrl)), { cache: "no-store", signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return { passwordReset: false };
    const parsed = authOptionsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.options : { passwordReset: false };
  } catch {
    return { passwordReset: false };
  }
}

export async function getLegalConfig(apiUrl?: string): Promise<LegalConfig | null> {
  try {
    const response = await fetch(new URL("/v1/legal", getApiBaseUrl(apiUrl)), { cache: "no-store", signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;
    const parsed = legalConfigResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.legal : null;
  } catch {
    return null;
  }
}
