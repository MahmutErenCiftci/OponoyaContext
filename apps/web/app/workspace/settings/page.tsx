import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountSummary, getAiStatus, getWorkspaceSettings } from "../../../lib/api";
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
  const [settings, account, ai, theme, query] = await Promise.all([getWorkspaceSettings(cookieHeader), getAccountSummary(cookieHeader), getAiStatus(cookieHeader), readTheme(), searchParams]);

  return (
    <WorkspaceShell active="Settings" user={user}>
      <SettingsClient account={account} ai={ai} initialSection={query.section} settings={settings} theme={theme} user={user} />
    </WorkspaceShell>
  );
}
