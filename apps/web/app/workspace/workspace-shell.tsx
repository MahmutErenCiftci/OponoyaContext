import type { CurrentUser } from "@devcontext/contracts";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { parseSidebarCollapsed, sidebarCookieName } from "../../lib/sidebar";
import { readTheme } from "../../lib/theme-server";
import { WorkspaceFrame } from "./workspace-navigation";

export type WorkspaceSection = "Overview" | "Library" | "Catalog" | "Projects" | "Profiles" | "Recipes" | "Plan" | "Settings";

export async function WorkspaceShell({ user, active, children }: {
  user: CurrentUser | null;
  active: WorkspaceSection | null;
  children: ReactNode;
}) {
  const collapsed = parseSidebarCollapsed((await cookies()).get(sidebarCookieName)?.value);
  return (
    <WorkspaceFrame active={active} initialCollapsed={collapsed} theme={await readTheme()} user={user}>
      {children}
    </WorkspaceFrame>
  );
}
