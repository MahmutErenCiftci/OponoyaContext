import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivityTimeline } from "../../../components/activity-timeline";
import { getAccountSummary, getAiStatus, getAuditEvents, getWorkspaceSettings } from "../../../lib/api";
import { loadSession } from "../../../lib/server-session";
import { readTheme } from "../../../lib/theme-server";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [settings, account, ai, theme, query, activity] = await Promise.all([
    getWorkspaceSettings(cookieHeader),
    getAccountSummary(cookieHeader),
    getAiStatus(cookieHeader),
    readTheme(),
    searchParams,
    getAuditEvents(cookieHeader, new URLSearchParams({ limit: "15" })),
  ]);

  return (
    <WorkspaceShell active="Settings" user={user}>
      <SettingsClient account={account} activity={<ActivityTimeline events={activity} />} ai={ai} initialSection={query.section} settings={settings} theme={theme} user={user} />
    </WorkspaceShell>
  );
}
