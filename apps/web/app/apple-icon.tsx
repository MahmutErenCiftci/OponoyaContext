import { ImageResponse } from "next/og";
import { productMonogram } from "@devcontext/contracts/brand";
import { brandFonts, MonogramTile } from "./brand-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: the monogram tile edge to edge (iOS applies its own corner mask). */
export default async function AppleIcon() {
  return new ImageResponse(<MonogramTile radius={0} size={180} />, { ...size, fonts: await brandFonts(productMonogram) });
}
