import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getGlobalDecisions,
  getProfileList,
  getProject,
  getProjectDecisions,
  getContextStatuses,
  getProjectList,
  getRecipeList,
  getResourceList,
  getSlotSuggestions,
} from "../../../lib/api";
import { contextStatusFrom, type ContextStatus } from "../../../lib/context-status";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { ProjectsClient } from "./projects-client";

export const metadata: Metadata = { title: "Projeler" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; recipe?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const editId = query.edit && z.uuid().safeParse(query.edit).success ? query.edit : null;
  const [initial, library, profiles, recipes, globalDecisions, editProject, editDecisions, suggestions] = await Promise.all([
    getProjectList(cookieHeader),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getProfileList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getRecipeList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getGlobalDecisions(cookieHeader),
    editId ? getProject(cookieHeader, editId) : Promise.resolve(null),
    editId ? getProjectDecisions(cookieHeader, editId) : Promise.resolve(null),
    getSlotSuggestions(cookieHeader),
  ]);
  if (!initial) return <ServiceUnavailable />;
  // One batch request for every visible project: freshness only, no canonical JSON or previews.
  const statuses = await getContextStatuses(cookieHeader, initial.projects.map((project) => project.id));
  const initialStatuses: Record<string, ContextStatus> = Object.fromEntries(initial.projects.map((project) => [project.id, contextStatusFrom(statuses.get(project.id))]));

  return (
    <WorkspaceShell active="Projects" user={user}>
      <ProjectsClient
        editDecisions={editDecisions ?? []}
        editOnLoad={editProject}
        globalDecisions={globalDecisions}
        initial={initial}
        initialRecipeId={query.recipe && z.uuid().safeParse(query.recipe).success ? query.recipe : null}
        initialStatuses={initialStatuses}
        library={library?.resources ?? []}
        openCreateOnLoad={query.new === "1"}
        profiles={profiles?.profiles ?? []}
        recipes={recipes?.recipes ?? []}
        suggestions={suggestions}
      />
    </WorkspaceShell>
  );
}
