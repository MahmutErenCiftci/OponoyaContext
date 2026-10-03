import { productDescription, productName, productTagline } from "@devcontext/contracts/brand";
import { ImageResponse } from "next/og";
import { brandColors, brandFonts, LogoTile } from "./brand-image";

export const alt = `${productName}: ${productTagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview card for shared pages (landing, legal), built from the brand constants. */
export default async function OpenGraphImage() {
  const fonts = await brandFonts(`${productName}${productTagline}${productDescription}`, [500, 800]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: brandColors.canvas, color: brandColors.ink, fontFamily: "Manrope" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <LogoTile size={88} />
          <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.5 }}>{productName}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>{productTagline}</div>
          <div style={{ fontSize: 30, fontWeight: 500, color: brandColors.muted, maxWidth: 960, lineHeight: 1.35 }}>{productDescription}</div>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, borderRadius: 5, background: brandColors.accent }} />
      </div>
    ),
    { ...size, fonts },
  );
}
