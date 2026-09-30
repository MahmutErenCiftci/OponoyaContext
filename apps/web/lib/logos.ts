import manifest from "./logo-manifest.json";

export type LogoEntry = { icon: string; title: string; hex: string };

const logos = manifest.logos as Record<string, LogoEntry | undefined>;
const names = manifest.names as Record<string, string | undefined>;
const hosts = manifest.hosts as Record<string, string | undefined>;

export const logoSource = { name: manifest.source, version: manifest.version, license: manifest.license };

/**
 * Own-property lookups only: resource metadata and names are user data, and a
 * key such as `constructor` must never resolve to an Object.prototype member.
 */
function own<T>(table: Record<string, T | undefined>, key: string): T | null {
  return Object.hasOwn(table, key) ? table[key] ?? null : null;
}

function isLogoEntry(value: unknown): value is LogoEntry {
  return typeof value === "object" && value !== null
    && typeof (value as LogoEntry).icon === "string"
    && typeof (value as LogoEntry).title === "string"
    && typeof (value as LogoEntry).hex === "string";
}

export function logoForSlug(slug: string | null | undefined): LogoEntry | null {
  if (!slug) return null;
  const entry = own(logos, slug);
  return isLogoEntry(entry) ? entry : null;
}

export function normalizeLogoName(name: string) {
  return name.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function hostOf(url: string | null | undefined) {
  if (!url) return null;
  return URL.parse(url)?.hostname.toLowerCase().replace(/^www\./, "") ?? null;
}

export type LogoSubject = {
  name: string;
  sourceUrl?: string | null;
  docsUrl?: string | null;
  repoUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Finds the catalog entry a Library resource stands for. Resources created
 * from the catalog carry `metadata.catalogSlug`; anything else is matched by a
 * distinctive documentation host or an exact (case- and punctuation-
 * insensitive) name, ignoring the "Sample ·" prefix of sample data.
 */
export function catalogSlugFor(subject: LogoSubject): string | null {
  const fromMetadata = subject.metadata?.catalogSlug;
  if (typeof fromMetadata === "string" && logoForSlug(fromMetadata)) return fromMetadata;
  for (const url of [subject.sourceUrl, subject.docsUrl, subject.repoUrl]) {
    const host = hostOf(url);
    const slug = host ? own(hosts, host) : null;
    if (slug && logoForSlug(slug)) return slug;
  }
  const plainName = subject.name.replace(/^sample\s*·\s*/i, "");
  const slug = own(names, normalizeLogoName(plainName));
  return slug && logoForSlug(slug) ? slug : null;
}

/** Relative luminance (0..1) of a six-digit hex colour. */
export function luminance(hex: string) {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(value)) return 0.5;
  const channel = (component: number) => {
    const c = component / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

export function contrastRatio(a: number, b: number) {
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Luminance of the surfaces logos sit on: the light theme's `--surface` and
 * the dark theme's `--surface` token in app/globals.css. Keep them in step.
 */
const lightSurface = luminance("ffffff");
const darkSurface = luminance("111419");
/** Below this a brand colour reads as a faint smudge; the mark is drawn in the text colour instead. */
export const minimumLogoContrast = 2;

/** Brand colours that would vanish on a theme's surface fall back to that theme's text colour (`--ink`). */
export function logoColors(hex: string) {
  const brand = luminance(hex);
  return {
    onDark: contrastRatio(brand, darkSurface) < minimumLogoContrast ? "var(--ink)" : `#${hex}`,
    onLight: contrastRatio(brand, lightSurface) < minimumLogoContrast ? "var(--ink)" : `#${hex}`,
  };
}

/** Up to two initials, letters and digits only ("dbt (Data Build Tool)" → "DD", never "D("). */
export function monogram(name: string) {
  const initials = name
    .replace(/^sample\s*·\s*/i, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((part) => part[0]!)
    .join("")
    .slice(0, 2);
  return initials ? initials.toLocaleUpperCase("tr") : "?";
}
