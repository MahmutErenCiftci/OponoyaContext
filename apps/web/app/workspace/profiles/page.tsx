import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfileList } from "../../../lib/api";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { ProfilesClient } from "./profiles-client";

const copy = defineCopy({ tr: { title: "Profiller" }, en: { title: "Profiles" } });

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title };
}

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const initial = await getProfileList(cookieHeader, new URLSearchParams({ limit: "100" }));
  if (!initial) return <ServiceUnavailable />;

  return (
    <WorkspaceShell active="Profiles" user={user}>
      <ProfilesClient initial={initial} openCreateOnLoad={query.new === "1"} />
    </WorkspaceShell>
  );
}
