import type { CSSProperties } from "react";
import { logoColors, logoForSlug, monogram } from "../lib/logos";

/**
 * Brand mark for a catalog technology. Renders the downloaded Simple Icons
 * glyph as a CSS mask tinted with the brand colour (adjusted per theme), or a
 * monogram when no logo is available.
 */
export function TechLogo({ slug, name, size = 22, className = "" }: { slug: string | null | undefined; name: string; size?: number; className?: string }) {
  const logo = logoForSlug(slug);
  if (!logo || !slug) {
    return <span aria-hidden="true" className={`tech-monogram ${className}`.trim()} style={{ fontSize: Math.max(9, Math.round(size * 0.42)) }}>{monogram(name)}</span>;
  }
  const colors = logoColors(logo.hex);
  const style = {
    width: size,
    height: size,
    "--logo-image": `url(/logos/${slug}.svg)`,
    "--logo-on-dark": colors.onDark,
    "--logo-on-light": colors.onLight,
  } as CSSProperties;
  return <span aria-label={`${logo.title} logo`} className={`tech-logo ${className}`.trim()} data-logo={slug} role="img" style={style} />;
}
