import type { CurrentUser } from "@devcontext/contracts";
import type { ReactNode } from "react";
import { readTheme } from "../../lib/theme-server";
import { WorkspaceNavigation } from "./workspace-navigation";

export type WorkspaceSection = "Overview" | "Library" | "Catalog" | "Projects" | "Profiles" | "Recipes" | "Plan" | "Settings";

export async function WorkspaceShell({ user, active, children }: {
  user: CurrentUser | null;
  active: WorkspaceSection | null;
  children: ReactNode;
}) {
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">İçeriğe geç</a>
      <WorkspaceNavigation active={active} theme={await readTheme()} user={user} />
      <main id="workspace-content">{children}</main>
    </div>
  );
}
