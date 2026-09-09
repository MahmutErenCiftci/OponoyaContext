import {
  accountSummaryResponseSchema,
  auditEventListResponseSchema,
  billingSummaryResponseSchema,
  legalConfigResponseSchema,
  catalogLibraryLinksResponseSchema,
  catalogOverviewResponseSchema,
  catalogStackListResponseSchema,
  catalogStackResponseSchema,
  catalogTechnologyListResponseSchema,
  catalogTechnologyResponseSchema,
  contextDiffResponseSchema,
  contextStateResponseSchema,
  contextVersionListResponseSchema,
  exportListResponseSchema,
  globalDecisionsResponseSchema,
  healthResponseSchema,
  profileListResponseSchema,
  profileResponseSchema,
  projectDecisionsResponseSchema,
  projectListResponseSchema,
  projectResponseSchema,
  recipeListResponseSchema,
  recipeResponseSchema,
  resourceListResponseSchema,
  workspaceSettingsResponseSchema,
  workspaceSummarySchema,
  type AccountSummary,
  type AuditEvent,
  type BillingSummary,
  type LegalConfig,
  type CatalogLibraryLinks,
  type CatalogOverview,
  type CatalogStack,
  type CatalogStackSummary,
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
  type ProjectDecisionView,
  type Recipe,
  type RecipeSummary,
  type Resource,
  type WorkspaceSettings,
  type WorkspaceSummary,
} from "@devcontext/contracts";
import { z } from "zod";
import { readSession } from "./session";

const apiUrlSchema = z.url().refine((value) => ["http:", "https:"].includes(URL.parse(value)?.protocol ?? ""));

export function getApiBaseUrl(apiUrl: string = process.env.API_URL ?? "http://localhost:4000") {
  return apiUrlSchema.parse(apiUrl);
}

export async function getWorkspaceStatus(apiUrl: string = process.env.API_URL ?? "http://localhost:4000"): Promise<"connected" | "unavailable"> {
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
function fetchAsUser(path: string, cookieHeader: string, apiUrl: string, searchParams?: URLSearchParams) {
  const target = new URL(path, getApiBaseUrl(apiUrl));
  if (searchParams) target.search = searchParams.toString();
  return fetch(target, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    signal: AbortSignal.timeout(3_000),
  });
}

/** Signed-in user or null; pages that must tell an outage apart from a signed-out visitor use `readSession`. */
export async function getCurrentUser(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<CurrentUser | null> {
  const session = await readSession(cookieHeader, apiUrl);
  return session.status === "authenticated" ? session.user : null;
}

/** The caller's own audit trail, newest first; empty when it cannot be loaded. */
export async function getAuditEvents(
  cookieHeader: string,
  searchParams: URLSearchParams = new URLSearchParams({ limit: "8" }),
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<AuditEvent[] | null> {
  try {
    const response = await fetchAsUser("/v1/audit", cookieHeader, apiUrl, searchParams);
    if (!response.ok) return null;
    const parsed = auditEventListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.events : null;
  } catch {
    return null;
  }
}

export async function getResourceList(
  cookieHeader: string,
  searchParams: URLSearchParams = new URLSearchParams(),
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<{ resources: Resource[]; total: number }> {
  try {
    const response = await fetchAsUser("/v1/resources", cookieHeader, apiUrl, searchParams);
    if (!response.ok) return { resources: [], total: 0 };
    const parsed = resourceListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { resources: [], total: 0 };
  } catch {
    return { resources: [], total: 0 };
  }
}

export async function getProjectList(
  cookieHeader: string,
  searchParams: URLSearchParams = new URLSearchParams(),
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<{ projects: Project[]; total: number }> {
  try {
    const response = await fetchAsUser("/v1/projects", cookieHeader, apiUrl, searchParams);
    if (!response.ok) return { projects: [], total: 0 };
    const parsed = projectListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { projects: [], total: 0 };
  } catch {
    return { projects: [], total: 0 };
  }
}

/** `null` when the Project is missing or the decisions could not be loaded, so the page can say so. */
export async function getProjectDecisions(
  cookieHeader: string,
  projectId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<ProjectDecisionView[] | null> {
  try {
    const response = await fetchAsUser(`/v1/projects/${encodeURIComponent(projectId)}/decisions`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = projectDecisionsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.decisions : null;
  } catch {
    return null;
  }
}

export async function getProjectContext(
  cookieHeader: string,
  projectId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<ContextState | null> {
  try {
    const response = await fetchAsUser(`/v1/projects/${encodeURIComponent(projectId)}/context`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = contextStateResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getContextVersions(
  cookieHeader: string,
  projectId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<ContextVersionSummary[]> {
  try {
    const response = await fetchAsUser(`/v1/projects/${encodeURIComponent(projectId)}/context/versions`, cookieHeader, apiUrl);
    if (!response.ok) return [];
    const parsed = contextVersionListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.versions : [];
  } catch {
    return [];
  }
}

export async function getExportHistory(
  cookieHeader: string,
  projectId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<ExportEvent[]> {
  try {
    const response = await fetchAsUser(`/v1/projects/${encodeURIComponent(projectId)}/exports`, cookieHeader, apiUrl);
    if (!response.ok) return [];
    const parsed = exportListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.exports : [];
  } catch {
    return [];
  }
}

export async function getProfileList(
  cookieHeader: string,
  searchParams: URLSearchParams = new URLSearchParams(),
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<{ profiles: ProfileSummary[]; total: number }> {
  try {
    const response = await fetchAsUser("/v1/profiles", cookieHeader, apiUrl, searchParams);
    if (!response.ok) return { profiles: [], total: 0 };
    const parsed = profileListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { profiles: [], total: 0 };
  } catch {
    return { profiles: [], total: 0 };
  }
}

export async function getProfile(
  cookieHeader: string,
  profileId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<Profile | null> {
  try {
    const response = await fetchAsUser(`/v1/profiles/${encodeURIComponent(profileId)}`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = profileResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.profile : null;
  } catch {
    return null;
  }
}

export async function getGlobalDecisions(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<DecisionRecord[]> {
  try {
    const response = await fetchAsUser("/v1/global-decisions", cookieHeader, apiUrl);
    if (!response.ok) return [];
    const parsed = globalDecisionsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.decisions : [];
  } catch {
    return [];
  }
}

export async function getWorkspaceSummary(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<WorkspaceSummary | null> {
  try {
    const response = await fetchAsUser("/v1/workspace/summary", cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = z.object({ summary: workspaceSummarySchema }).safeParse(await response.json());
    return parsed.success ? parsed.data.summary : null;
  } catch {
    return null;
  }
}

export async function getContextDiff(
  cookieHeader: string,
  projectId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<ContextDiffResult | null> {
  try {
    const response = await fetchAsUser(`/v1/projects/${encodeURIComponent(projectId)}/context/diff`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = contextDiffResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type ContextDiffResult = z.infer<typeof contextDiffResponseSchema>;

export async function getRecipeList(
  cookieHeader: string,
  searchParams: URLSearchParams = new URLSearchParams(),
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<{ recipes: RecipeSummary[]; total: number }> {
  try {
    const response = await fetchAsUser("/v1/recipes", cookieHeader, apiUrl, searchParams);
    if (!response.ok) return { recipes: [], total: 0 };
    const parsed = recipeListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { recipes: [], total: 0 };
  } catch {
    return { recipes: [], total: 0 };
  }
}

export async function getRecipe(
  cookieHeader: string,
  recipeId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<Recipe | null> {
  try {
    const response = await fetchAsUser(`/v1/recipes/${encodeURIComponent(recipeId)}`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = recipeResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.recipe : null;
  } catch {
    return null;
  }
}

/** Onboarding and sample state; null when the API cannot be reached so pages can say so. */
export async function getWorkspaceSettings(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<WorkspaceSettings | null> {
  try {
    const response = await fetchAsUser("/v1/workspace/settings", cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = workspaceSettingsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.settings : null;
  } catch {
    return null;
  }
}

/** Plan, usage, subscription and provider state; null when the API cannot be reached. */
export async function getBillingSummary(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<BillingSummary | null> {
  try {
    const response = await fetchAsUser("/v1/billing", cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = billingSummaryResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.billing : null;
  } catch {
    return null;
  }
}

/** Catalog metadata: counts, domains and the methodology disclaimer; null when the API cannot be reached. */
export async function getCatalogOverview(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<CatalogOverview | null> {
  try {
    const response = await fetchAsUser("/v1/catalog", cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = catalogOverviewResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.catalog : null;
  } catch {
    return null;
  }
}

export async function getCatalogTechnologies(
  cookieHeader: string,
  searchParams: URLSearchParams = new URLSearchParams(),
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<{ technologies: CatalogTechnologySummary[]; total: number } | null> {
  try {
    const response = await fetchAsUser("/v1/catalog/technologies", cookieHeader, apiUrl, searchParams);
    if (!response.ok) return null;
    const parsed = catalogTechnologyListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Null for an unknown slug or an unreachable API; pages treat both as "not found". */
export async function getCatalogTechnology(
  cookieHeader: string,
  slug: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<CatalogTechnology | null> {
  try {
    const response = await fetchAsUser(`/v1/catalog/technologies/${encodeURIComponent(slug)}`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = catalogTechnologyResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.technology : null;
  } catch {
    return null;
  }
}

export async function getCatalogStacks(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<CatalogStackSummary[] | null> {
  try {
    const response = await fetchAsUser("/v1/catalog/stacks", cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = catalogStackListResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.stacks : null;
  } catch {
    return null;
  }
}

export async function getCatalogStack(
  cookieHeader: string,
  slug: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<CatalogStack | null> {
  try {
    const response = await fetchAsUser(`/v1/catalog/stacks/${encodeURIComponent(slug)}`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = catalogStackResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.stack : null;
  } catch {
    return null;
  }
}

/** Catalog slug → Library Resource id for entries already saved; empty when unavailable. */
export async function getCatalogLibraryLinks(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<CatalogLibraryLinks> {
  try {
    const response = await fetchAsUser("/v1/catalog/library", cookieHeader, apiUrl);
    if (!response.ok) return {};
    const parsed = catalogLibraryLinksResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.links : {};
  } catch {
    return {};
  }
}

export async function getProject(
  cookieHeader: string,
  projectId: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<Project | null> {
  try {
    const response = await fetchAsUser(`/v1/projects/${encodeURIComponent(projectId)}`, cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = projectResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.project : null;
  } catch {
    return null;
  }
}

/** What the account stores, its integrations and any pending deletion state; null when the API cannot be reached. */
export async function getAccountSummary(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<AccountSummary | null> {
  try {
    const response = await fetchAsUser("/v1/account", cookieHeader, apiUrl);
    if (!response.ok) return null;
    const parsed = accountSummaryResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.account : null;
  } catch {
    return null;
  }
}

/** Public, configuration-driven inputs of the Terms and Privacy pages; null when the API cannot be reached. */
export async function getLegalConfig(apiUrl: string = process.env.API_URL ?? "http://localhost:4000"): Promise<LegalConfig | null> {
  try {
    const response = await fetch(new URL("/v1/legal", getApiBaseUrl(apiUrl)), { cache: "no-store", signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;
    const parsed = legalConfigResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.legal : null;
  } catch {
    return null;
  }
}
