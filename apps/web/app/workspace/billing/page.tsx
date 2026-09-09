import { redirect } from "next/navigation";
import { getBillingSummary } from "../../../lib/api";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { BillingClient, type ReturnState } from "./billing-client";

export const dynamic = "force-dynamic";

function parseReturn(value: string | undefined): ReturnState {
  return value === "success" || value === "canceled" || value === "portal" ? value : null;
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth");
  const { user, cookieHeader } = session;
  const [summary, query] = await Promise.all([getBillingSummary(cookieHeader), searchParams]);

  return (
    <WorkspaceShell active="Plan" user={user}>
      <BillingClient returnState={parseReturn(query.billing)} summary={summary} />
    </WorkspaceShell>
  );
}
