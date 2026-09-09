export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

/** Persisted preference; the root layout reads it so the first paint already has the right palette. */
export const themeCookieName = "devcontext-theme";
const themeCookieMaxAge = 60 * 60 * 24 * 365;

export const themeLabels: Record<Theme, string> = { system: "Sistem", light: "Açık", dark: "Koyu" };

export const themeDescriptions: Record<Theme, string> = {
  system: "Cihazının görünüm tercihini kullan.",
  light: "Açık yüzeyler ve koyu metin.",
  dark: "Düşük ışık için koyu çalışma alanı.",
};

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** Value for `data-theme` on <html>; undefined means follow the system preference. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

export function readThemeFromCookieHeader(header: string | null | undefined): Theme {
  if (!header) return "system";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === themeCookieName) return parseTheme(decodeURIComponent(rest.join("=")));
  }
  return "system";
}

export function themeCookie(theme: Theme): string {
  return `${themeCookieName}=${theme}; Path=/; Max-Age=${themeCookieMaxAge}; SameSite=Lax`;
}

/** Applies a choice to the current document without a reload. */
export function applyTheme(theme: Theme, root: { dataset: DOMStringMap } = document.documentElement) {
  const attribute = themeAttribute(theme);
  if (attribute) root.dataset.theme = attribute;
  else delete root.dataset.theme;
}

/** Stores the choice for future server renders and applies it immediately. */
export function persistTheme(theme: Theme) {
  document.cookie = themeCookie(theme);
  applyTheme(theme);
}
