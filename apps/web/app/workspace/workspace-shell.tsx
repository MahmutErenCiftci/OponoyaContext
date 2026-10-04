import type { CurrentUser } from "@devcontext/contracts";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { loadSession } from "../../lib/server-session";
import { parseSidebarCollapsed, sidebarCookieName } from "../../lib/sidebar";
import { readTheme } from "../../lib/theme-server";
import { WorkspaceFrame } from "./workspace-navigation";

export type WorkspaceSection = "Overview" | "Library" | "Catalog" | "Projects" | "Profiles" | "Recipes" | "Plan" | "Settings" | "Feedback" | "Admin";

export async function WorkspaceShell({ user, active, children }: {
  user: CurrentUser | null;
  active: WorkspaceSection | null;
  children: ReactNode;
}) {
  const collapsed = parseSidebarCollapsed((await cookies()).get(sidebarCookieName)?.value);
  // Pages already resolved the session; the per-request cache answers without another API call.
  const session = user ? await loadSession() : null;
  const admin = session?.status === "authenticated" && session.admin;
  return (
    <WorkspaceFrame active={active} admin={admin} initialCollapsed={collapsed} theme={await readTheme()} user={user}>
      {children}
    </WorkspaceFrame>
  );
}
