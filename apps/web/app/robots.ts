import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";

/** SITE_URL is runtime configuration; a build-time render would bake in "no origin". */
export const dynamic = "force-dynamic";

/** Public pages may be indexed; the signed-in workspace, the API proxy and billing flows never are. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/workspace", "/api/", "/billing/"] }],
    ...(base ? { sitemap: new URL("/sitemap.xml", base).toString() } : {}),
  };
}
