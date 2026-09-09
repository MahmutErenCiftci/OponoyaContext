import { notFound, redirect } from "next/navigation";
import { getProfile, getResourceList } from "../../../../lib/api";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { ProfileDetailClient } from "./profile-detail-client";

export const dynamic = "force-dynamic";

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const profile = await getProfile(cookieHeader, id);
  if (!profile) notFound();
  const library = await getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" }));

  return (
    <WorkspaceShell active="Profiles" user={user}>
      <ProfileDetailClient initial={profile} library={library.resources} />
    </WorkspaceShell>
  );
}
