import { redirect } from "next/navigation";
import {
  getGlobalDecisions,
  getProfileList,
  getProject,
  getProjectContext,
  getProjectDecisions,
  getProjectList,
  getRecipeList,
  getResourceList,
} from "../../../lib/api";
import { contextStatus, type ContextStatus } from "../../../lib/context-status";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; recipe?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const [initial, library, profiles, recipes, globalDecisions, editProject, editDecisions] = await Promise.all([
    getProjectList(cookieHeader),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getProfileList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getRecipeList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getGlobalDecisions(cookieHeader),
    query.edit ? getProject(cookieHeader, query.edit) : Promise.resolve(null),
    query.edit ? getProjectDecisions(cookieHeader, query.edit) : Promise.resolve(null),
  ]);
  const contexts = await Promise.all(initial.projects.slice(0, 20).map(async (project) => [project.id, contextStatus(await getProjectContext(cookieHeader, project.id))] as const));
  const initialStatuses: Record<string, ContextStatus> = Object.fromEntries(contexts);

  return (
    <WorkspaceShell active="Projects" user={user}>
      <ProjectsClient
        editDecisions={editDecisions ?? []}
        editOnLoad={editProject}
        globalDecisions={globalDecisions}
        initial={initial}
        initialRecipeId={query.recipe ?? null}
        initialStatuses={initialStatuses}
        library={library.resources}
        openCreateOnLoad={query.new === "1"}
        profiles={profiles.profiles}
        recipes={recipes.recipes}
      />
    </WorkspaceShell>
  );
}
