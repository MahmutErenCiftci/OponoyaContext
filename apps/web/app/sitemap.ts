import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";

/** Public pages only, and only when `SITE_URL` says where they live (sitemaps need absolute URLs). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  if (!base) return [];
  return ["/", "/auth", "/legal/terms", "/legal/privacy"].map((path) => ({ url: new URL(path, base).toString(), changeFrequency: "monthly" }));
}
