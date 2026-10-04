import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getContextVersions, getExportHistory, getProject, getProjectContext } from "../../../../../lib/api";
import { contextStatus } from "../../../../../lib/context-status";
import { defineCopy } from "../../../../../lib/i18n";
import { getLocale } from "../../../../../lib/locale-server";
import { loadSession } from "../../../../../lib/server-session";
import { ServiceUnavailable } from "../../../unavailable";
import { WorkspaceShell } from "../../../workspace-shell";
import { ProjectHeader } from "../project-header";
import { ContextClient } from "./context-client";

const copy = defineCopy({
  tr: { title: "Talimatlar" },
  en: { title: "Instructions" },
});

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = copy[await getLocale()];
  const session = await loadSession();
  const project = session.status === "authenticated" ? await getProject(session.cookieHeader, id) : null;
  return { title: project ? `${project.name} · ${t.title}` : t.title };
}

export default async function ProjectContextPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [project, state, versions, exports, query] = await Promise.all([
    getProject(cookieHeader, id),
    getProjectContext(cookieHeader, id),
    getContextVersions(cookieHeader, id),
    getExportHistory(cookieHeader, id),
    searchParams,
  ]);
  if (!project) notFound();

  return (
    <WorkspaceShell active="Projects" user={user}>
      <section className="page">
        <ProjectHeader active="context" project={project} status={contextStatus(state)} />
        <ContextClient exports={exports} initial={state} initialView={query.view === "diff" ? "diff" : "document"} project={project} versions={versions} />
      </section>
    </WorkspaceShell>
  );
}
