import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getResourceList } from "../../../lib/api";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { LibraryClient } from "./library-client";

const copy = defineCopy({ tr: { title: "Kütüphane" }, en: { title: "Library" } });

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title };
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ add?: string; q?: string; view?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const view = query.view === "archived" ? "archived" : query.view === "favorites" ? "favorites" : "active";
  const params = new URLSearchParams({ archived: view === "archived" ? "archived" : "active" });
  if (view === "favorites") params.set("favorite", "true");
  if (query.q) params.set("q", query.q);
  const initial = await getResourceList(cookieHeader, params);
  if (!initial) return <ServiceUnavailable />;

  return (
    <WorkspaceShell active="Library" user={user}>
      <LibraryClient initial={initial} initialSearch={query.q ?? ""} initialView={view} openCreateOnLoad={query.add === "1"} />
    </WorkspaceShell>
  );
}
