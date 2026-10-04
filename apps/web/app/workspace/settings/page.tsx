import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivityTimeline } from "../../../components/activity-timeline";
import { getAccountSummary, getAiStatus, getAuditEvents, getWorkspaceSettings } from "../../../lib/api";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { readTheme } from "../../../lib/theme-server";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { SettingsClient } from "./settings-client";

const copy = defineCopy({
  tr: { metaTitle: "Ayarlar" },
  en: { metaTitle: "Settings" },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [settings, account, ai, theme, query, activity, locale] = await Promise.all([
    getWorkspaceSettings(cookieHeader),
    getAccountSummary(cookieHeader),
    getAiStatus(cookieHeader),
    readTheme(),
    searchParams,
    getAuditEvents(cookieHeader, new URLSearchParams({ limit: "15" })),
    getLocale(),
  ]);

  return (
    <WorkspaceShell active="Settings" user={user}>
      <SettingsClient account={account} activity={<ActivityTimeline events={activity} locale={locale} />} ai={ai} initialSection={query.section} settings={settings} theme={theme} user={user} />
    </WorkspaceShell>
  );
}
