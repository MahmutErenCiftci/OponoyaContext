import { notFound, redirect } from "next/navigation";
import { getProfileList, getRecipe, getResourceList } from "../../../../lib/api";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { RecipeDetailClient } from "./recipe-detail-client";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const recipe = await getRecipe(cookieHeader, id);
  if (!recipe) notFound();
  const [library, profiles] = await Promise.all([
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getProfileList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
  ]);

  return (
    <WorkspaceShell active="Recipes" user={user}>
      <RecipeDetailClient initial={recipe} library={library.resources} profiles={profiles.profiles} />
    </WorkspaceShell>
  );
}
