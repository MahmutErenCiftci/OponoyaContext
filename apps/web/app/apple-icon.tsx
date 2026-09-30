import { ImageResponse } from "next/og";
import { LogoTile } from "./brand-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: the logo tile edge to edge (iOS applies its own corner mask). */
export default function AppleIcon() {
  return new ImageResponse(<LogoTile radius={0} size={180} />, size);
}
