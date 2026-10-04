import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRecipeList } from "../../../lib/api";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { RecipesClient } from "./recipes-client";

const copy = defineCopy({ tr: { title: "Tarifler" }, en: { title: "Recipes" } });

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title };
}

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const initial = await getRecipeList(cookieHeader, new URLSearchParams({ limit: "100" }));
  if (!initial) return <ServiceUnavailable />;

  return (
    <WorkspaceShell active="Recipes" user={user}>
      <RecipesClient initial={initial} openCreateOnLoad={query.new === "1"} />
    </WorkspaceShell>
  );
}
