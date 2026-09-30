/**
 * Public origin of the web app (`SITE_URL`, e.g. https://app.example.com),
 * used for absolute links in metadata, Open Graph images and the sitemap.
 * Server-only and optional: without it those links stay relative and the
 * sitemap is empty.
 */
export function siteUrl(value: string | undefined = process.env.SITE_URL): URL | null {
  if (!value) return null;
  const url = URL.parse(value);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.origin !== value.replace(/\/$/, "")) return null;
  return url;
}
