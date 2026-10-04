import { logoGeometry, logoOverArc } from "../components/logo-mark";

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

/**
 * The logo tile used by every app icon size and the link preview: the drawn
 * mark from components/logo-mark.tsx on the accent square. `radius` is a
 * share of the size. Colours are explicit because image generation has no
 * `currentColor` from CSS. Instead of masks (which image generation does not
 * reliably support) the crossings are painted: a band in the tile colour cuts
 * the ring underneath, and the left ring's over-pass is drawn back on top,
 * a little longer than its cut so no seam shows at the ends.
 */
export function LogoTile({ size, radius = 0.22 }: { size: number; radius?: number }) {
  const inner = Math.round(size * 0.8);
  const { width, cutWidth, leftRing, rightRing } = logoGeometry;
  const { accent, accentInk } = brandColors;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: Math.round(size * radius), background: accent }}>
      <svg height={inner} viewBox="0 0 100 100" width={inner}>
        <path d={leftRing} fill="none" stroke={accentInk} strokeWidth={width} />
        <path d={logoOverArc("right")} fill="none" stroke={accent} strokeWidth={cutWidth} />
        <path d={rightRing} fill="none" stroke={accentInk} strokeWidth={width} />
        <path d={logoOverArc("left")} fill="none" stroke={accent} strokeWidth={cutWidth} />
        <path d={logoOverArc("left", 47)} fill="none" stroke={accentInk} strokeWidth={width} />
      </svg>
    </div>
  );
}
