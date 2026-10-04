import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile, getResourceList } from "../../../../lib/api";
import { defineCopy } from "../../../../lib/i18n";
import { getLocale } from "../../../../lib/locale-server";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { ProfileDetailClient } from "./profile-detail-client";

const copy = defineCopy({ tr: { fallbackTitle: "Profil" }, en: { fallbackTitle: "Profile" } });

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [session, locale] = await Promise.all([loadSession(), getLocale()]);
  const profile = session.status === "authenticated" ? await getProfile(session.cookieHeader, id) : null;
  return { title: profile ? profile.name : copy[locale].fallbackTitle };
}

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const [profile, library] = await Promise.all([
    getProfile(cookieHeader, id),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
  ]);
  if (!profile) notFound();

  return (
    <WorkspaceShell active="Profiles" user={user}>
      <ProfileDetailClient initial={profile} library={library?.resources ?? []} />
    </WorkspaceShell>
  );
}
