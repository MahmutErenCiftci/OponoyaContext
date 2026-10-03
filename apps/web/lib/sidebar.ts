/** Persisted width of the workspace sidebar; the shell reads it so the first paint already has the chosen width. */
export const sidebarCookieName = "devcontext-sidebar";
const sidebarCookieMaxAge = 60 * 60 * 24 * 365;

export function parseSidebarCollapsed(value: string | null | undefined): boolean {
  return value === "collapsed";
}

export function sidebarCookie(collapsed: boolean): string {
  return `${sidebarCookieName}=${collapsed ? "collapsed" : "expanded"}; Path=/; Max-Age=${sidebarCookieMaxAge}; SameSite=Lax`;
}
