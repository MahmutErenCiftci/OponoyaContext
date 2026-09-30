import type { CSSProperties } from "react";
import { logoColors, logoForSlug, monogram } from "../lib/logos";

/**
 * Brand mark for a catalog technology. Renders the downloaded Simple Icons
 * glyph as a CSS mask tinted with the brand colour (adjusted per theme), or a
 * letter monogram in a box of the same size when no logo is available. The
 * technology's name is always printed next to the mark, so the mark itself
 * is decorative for assistive technology.
 */
export function TechLogo({ slug, name, size = 22, className = "" }: { slug: string | null | undefined; name: string; size?: number; className?: string }) {
  const logo = logoForSlug(slug);
  if (!logo || !slug) {
    return (
      <span aria-hidden="true" className={`tech-monogram ${className}`.trim()} data-monogram="" style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.46)) }}>
        {monogram(name)}
      </span>
    );
  }
  const colors = logoColors(logo.hex);
  const style = {
    width: size,
    height: size,
    "--logo-image": `url(/logos/${slug}.svg)`,
    "--logo-on-dark": colors.onDark,
    "--logo-on-light": colors.onLight,
  } as CSSProperties;
  return <span aria-hidden="true" className={`tech-logo ${className}`.trim()} data-logo={slug} style={style} />;
}
