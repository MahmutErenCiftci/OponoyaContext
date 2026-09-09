import { describe, expect, it } from "vitest";
import { applyTheme, parseTheme, readThemeFromCookieHeader, themeAttribute, themeCookie, themeCookieName } from "../lib/theme";

describe("theme preference", () => {
  it("parses only known values and falls back to the system preference", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("neon")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("light")).toBe("light");
  });

  it("reads the cookie from a raw header and writes a scoped, long-lived cookie", () => {
    expect(readThemeFromCookieHeader(`session=abc; ${themeCookieName}=light; other=1`)).toBe("light");
    expect(readThemeFromCookieHeader("session=abc")).toBe("system");
    expect(readThemeFromCookieHeader(null)).toBe("system");
    expect(themeCookie("dark")).toBe(`${themeCookieName}=dark; Path=/; Max-Age=31536000; SameSite=Lax`);
  });

  it("applies and clears the data attribute on the document root", () => {
    const root = { dataset: {} as DOMStringMap };
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
    applyTheme("system", root);
    expect(root.dataset.theme).toBeUndefined();
  });
});
