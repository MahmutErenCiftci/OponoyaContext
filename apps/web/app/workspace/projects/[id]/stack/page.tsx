import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAiStatus, getProject, getProjectContext, getProjectDecisions, getResourceList } from "../../../../../lib/api";
import { contextStatus } from "../../../../../lib/context-status";
import { loadSession } from "../../../../../lib/server-session";
import { ServiceUnavailable } from "../../../unavailable";
import { WorkspaceShell } from "../../../workspace-shell";
import { ProjectHeader } from "../project-header";
import { StackClient } from "./stack-client";

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await loadSession();
  const project = session.status === "authenticated" ? await getProject(session.cookieHeader, id) : null;
  return { title: project ? `${project.name} · Teknoloji kararları` : "Teknoloji kararları" };
}

export default async function ProjectStackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [project, decisions, library, context, ai] = await Promise.all([
    getProject(cookieHeader, id),
    getProjectDecisions(cookieHeader, id),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getProjectContext(cookieHeader, id),
    getAiStatus(cookieHeader),
  ]);
  if (!project) notFound();

  return (
    <WorkspaceShell active="Projects" user={user}>
      <section className="page">
        <ProjectHeader active="stack" project={project} status={contextStatus(context)} />
        <StackClient ai={ai} initial={decisions} library={library?.resources ?? []} project={project} warnings={context?.draftWarnings ?? null} />
      </section>
    </WorkspaceShell>
  );
}
