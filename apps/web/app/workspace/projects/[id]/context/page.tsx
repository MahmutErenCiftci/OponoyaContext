import { notFound, redirect } from "next/navigation";
import { getContextVersions, getExportHistory, getProject, getProjectContext } from "../../../../../lib/api";
import { contextStatus } from "../../../../../lib/context-status";
import { loadSession } from "../../../../../lib/server-session";
import { ServiceUnavailable } from "../../../unavailable";
import { WorkspaceShell } from "../../../workspace-shell";
import { ProjectHeader } from "../project-header";
import { ContextClient } from "./context-client";

export const dynamic = "force-dynamic";

export default async function ProjectContextPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const project = await getProject(cookieHeader, id);
  if (!project) notFound();
  const [state, versions, exports, query] = await Promise.all([
    getProjectContext(cookieHeader, id),
    getContextVersions(cookieHeader, id),
    getExportHistory(cookieHeader, id),
    searchParams,
  ]);

  return (
    <WorkspaceShell active="Projects" user={user}>
      <section className="page">
        <ProjectHeader active="context" project={project} status={contextStatus(state)} />
        <ContextClient exports={exports} initial={state} initialView={query.view === "diff" ? "diff" : "document"} project={project} versions={versions} />
      </section>
    </WorkspaceShell>
  );
}
