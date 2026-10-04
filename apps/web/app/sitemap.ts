import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";

/** SITE_URL is runtime configuration; a build-time render would bake in an empty sitemap. */
export const dynamic = "force-dynamic";

/** Public pages only, and only when `SITE_URL` says where they live (sitemaps need absolute URLs). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  if (!base) return [];
  return ["/", "/en", "/auth", "/legal/terms", "/legal/privacy"].map((path) => ({ url: new URL(path, base).toString(), changeFrequency: "monthly" }));
}
