import { productDescription, productName } from "@devcontext/contracts/brand";
import type { MetadataRoute } from "next";

/** Install metadata; icons are the generated monogram tiles from app/icon.tsx. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: productName,
    short_name: productName,
    description: productDescription,
    lang: "tr",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#b4f000",
    icons: [
      { src: "/icon/favicon", sizes: "32x32", type: "image/png" },
      { src: "/icon/app", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/large", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
