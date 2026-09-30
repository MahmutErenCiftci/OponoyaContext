import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfileList, getRecipe, getResourceList } from "../../../../lib/api";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { RecipeDetailClient } from "./recipe-detail-client";

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await loadSession();
  const recipe = session.status === "authenticated" ? await getRecipe(session.cookieHeader, id) : null;
  return { title: recipe ? recipe.name : "Tarif" };
}

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const [recipe, library, profiles] = await Promise.all([
    getRecipe(cookieHeader, id),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
    getProfileList(cookieHeader, new URLSearchParams({ archived: "active", limit: "100" })),
  ]);
  if (!recipe) notFound();

  return (
    <WorkspaceShell active="Recipes" user={user}>
      <RecipeDetailClient initial={recipe} library={library?.resources ?? []} profiles={profiles?.profiles ?? []} />
    </WorkspaceShell>
  );
}
