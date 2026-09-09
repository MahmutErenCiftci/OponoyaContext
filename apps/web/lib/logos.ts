import manifest from "./logo-manifest.json";

export type LogoEntry = { icon: string; title: string; hex: string };

const logos = manifest.logos as Record<string, LogoEntry | undefined>;
const names = manifest.names as Record<string, string | undefined>;
const hosts = manifest.hosts as Record<string, string | undefined>;

export const logoSource = { name: manifest.source, version: manifest.version, license: manifest.license };

export function logoForSlug(slug: string | null | undefined): LogoEntry | null {
  if (!slug) return null;
  return logos[slug] ?? null;
}

export function normalizeLogoName(name: string) {
  return name.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
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
  if (typeof fromMetadata === "string" && fromMetadata in logos) return fromMetadata;
  for (const url of [subject.sourceUrl, subject.docsUrl, subject.repoUrl]) {
    const host = hostOf(url);
    const slug = host ? hosts[host] : undefined;
    if (slug) return slug;
  }
  const plainName = subject.name.replace(/^sample\s*·\s*/i, "");
  return names[normalizeLogoName(plainName)] ?? null;
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

/** Brand colours that would vanish on a theme's background fall back to the text colour. */
export function logoColors(hex: string) {
  const light = luminance(hex);
  return {
    onDark: light < 0.08 ? "var(--text)" : `#${hex}`,
    onLight: light > 0.6 ? "var(--text)" : `#${hex}`,
  };
}

export function monogram(name: string) {
  return name.replace(/^sample\s*·\s*/i, "").split(/[\s/·+]+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
