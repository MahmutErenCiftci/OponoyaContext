import { notFound, redirect } from "next/navigation";
import { getProject, getProjectContext, getProjectDecisions, getResourceList } from "../../../../../lib/api";
import { contextStatus } from "../../../../../lib/context-status";
import { loadSession } from "../../../../../lib/server-session";
import { ServiceUnavailable } from "../../../unavailable";
import { WorkspaceShell } from "../../../workspace-shell";
import { ProjectHeader } from "../project-header";
import { StackClient } from "./stack-client";

export const dynamic = "force-dynamic";

export default async function ProjectStackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const project = await getProject(cookieHeader, id);
  if (!project) notFound();
  const [decisions, library, context] = await Promise.all([
    getProjectDecisions(cookieHeader, id),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getProjectContext(cookieHeader, id),
  ]);

  return (
    <WorkspaceShell active="Projects" user={user}>
      <section className="page">
        <ProjectHeader active="stack" project={project} status={contextStatus(context)} />
        <StackClient initial={decisions} library={library.resources} project={project} warnings={context?.draftWarnings ?? null} />
      </section>
    </WorkspaceShell>
  );
}
