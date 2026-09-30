import { productMonogram } from "@devcontext/contracts/brand";

/**
 * Colours of the generated brand images. Image generation cannot read CSS
 * custom properties, so these mirror the light theme's `--accent` and
 * `--accent-ink` tokens and the dark `--canvas`, `--ink` and `--muted`
 * tokens in app/globals.css.
 */
export const brandColors = { accent: "#b4f000", accentInk: "#101800", canvas: "#0b0d10", ink: "#f3f5f7", muted: "#98a0ad" } as const;

type BrandFont = { name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" };

/**
 * Manrope (the UI typeface) for the given text, subset by Google Fonts to the
 * glyphs the image needs. Images are generated at build time, so this runs
 * once per build; when the download fails the images fall back to the
 * built-in font rather than failing the build.
 */
export async function brandFonts(text: string, weights: Array<500 | 800> = [800]): Promise<BrandFont[]> {
  const fonts: BrandFont[] = [];
  for (const weight of weights) {
    try {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}&text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(10_000) }).then((response) => response.text());
      const source = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
      if (!source) continue;
      const data = await fetch(source, { signal: AbortSignal.timeout(10_000) }).then((response) => (response.ok ? response.arrayBuffer() : null));
      if (data) fonts.push({ name: "Manrope", data, weight, style: "normal" });
    } catch {
      // Offline build: keep the default font.
    }
  }
  return fonts;
}

/** The monogram tile used by every app icon size; `radius` is a share of the size. */
export function MonogramTile({ size, radius = 0.22 }: { size: number; radius?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(size * radius),
        background: brandColors.accent,
        color: brandColors.accentInk,
        fontFamily: "Manrope",
        fontSize: Math.round(size * 0.6),
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {productMonogram}
    </div>
  );
}
