import { catalogDomainSchema, resourceTypeSchema } from "@devcontext/contracts";
import { redirect } from "next/navigation";
import { getCatalogLibraryLinks, getCatalogOverview, getCatalogStacks, getCatalogTechnologies } from "../../../lib/api";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; domain?: string; type?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const query = await searchParams;
  const [overview, technologies, stacks, links] = await Promise.all([
    getCatalogOverview(cookieHeader),
    getCatalogTechnologies(cookieHeader),
    getCatalogStacks(cookieHeader),
    getCatalogLibraryLinks(cookieHeader),
  ]);
  const domain = catalogDomainSchema.safeParse(query.domain);
  const type = resourceTypeSchema.safeParse(query.type);

  return (
    <WorkspaceShell active="Catalog" user={user}>
      <CatalogClient
        initialDomain={domain.success ? domain.data : null}
        initialQuery={query.q ?? ""}
        initialType={type.success ? type.data : null}
        links={links}
        overview={overview}
        stacks={stacks ?? []}
        technologies={technologies?.technologies ?? []}
      />
    </WorkspaceShell>
  );
}
