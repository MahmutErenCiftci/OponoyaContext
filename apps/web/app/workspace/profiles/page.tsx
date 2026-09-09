import { redirect } from "next/navigation";
import { getProfileList } from "../../../lib/api";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { ProfilesClient } from "./profiles-client";

export const dynamic = "force-dynamic";

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const initial = await getProfileList(cookieHeader);

  return (
    <WorkspaceShell active="Profiles" user={user}>
      <ProfilesClient initial={initial} openCreateOnLoad={query.new === "1"} />
    </WorkspaceShell>
  );
}
