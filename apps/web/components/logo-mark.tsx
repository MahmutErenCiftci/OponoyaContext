/**
 * The Oponoya mark (owner's pick 2026-09-30, "İmleç"): an O followed by a text
 * cursor, "context for coding agents". Geometry lives in a 100×100 box and is
 * shared with the generated favicon, app and link-preview images
 * (app/brand-image.tsx), so every surface draws the same shape. The gap
 * between ring and cursor keeps the pair from reading as "a" or "OI".
 */
export const logoGeometry = {
  ring: { cx: 40, cy: 50, r: 24, width: 12 },
  cursor: { x: 78, y: 22, width: 9, height: 56, radius: 3 },
} as const;

/** Drawn in `currentColor`; the cursor carries `.logo-cursor` so it can blink on hover. */
export function LogoMark({ className = "" }: { className?: string }) {
  const { ring, cursor } = logoGeometry;
  return (
    <svg aria-hidden="true" className={`logo-mark ${className}`.trim()} focusable="false" viewBox="0 0 100 100">
      <circle cx={ring.cx} cy={ring.cy} fill="none" r={ring.r} stroke="currentColor" strokeWidth={ring.width} />
      <rect className="logo-cursor" fill="currentColor" height={cursor.height} rx={cursor.radius} width={cursor.width} x={cursor.x} y={cursor.y} />
    </svg>
  );
}
