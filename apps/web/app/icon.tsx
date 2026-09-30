import { ImageResponse } from "next/og";
import { productMonogram } from "@devcontext/contracts/brand";
import { brandFonts, MonogramTile } from "./brand-image";

/** Favicon and install icons, generated from the brand monogram so a rename updates them too. */
const sizes = { favicon: 32, app: 192, large: 512 } as const;

export function generateImageMetadata() {
  return Object.entries(sizes).map(([id, size]) => ({ id, size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const key = String(await id) as keyof typeof sizes;
  const size = sizes[key] ?? sizes.favicon;
  // Small favicons keep a rounded square; install icons leave room for platform masks.
  return new ImageResponse(<MonogramTile radius={size <= 32 ? 0.22 : 0.2} size={size} />, { width: size, height: size, fonts: await brandFonts(productMonogram) });
}
