import { useId } from "react";

/**
 * The hooliee mark (owner's pick 2026-10-04): the "oo" of the name as two
 * interlocked chain links. The right ring passes over at the top crossing and
 * the left ring at the bottom one; each over-pass cuts a gap into the ring
 * below it. Geometry lives in a 100×100 box and is shared with the generated
 * favicon, app and link-preview images (app/brand-image.tsx), so every
 * surface draws the same shape.
 *
 * A cut takes every pixel of the lower ring within a stroke half plus the
 * 4-unit `gap` of the upper ring's centre line, along ±45° of the upper ring
 * around the crossing: far enough that the cut fades out on its own instead
 * of ending in a sliver. Ring centres are 28 apart, so in the middle of the
 * overlap the centre lines are 16 apart, more than that reach (15), and the
 * two cuts never meet. A half turn lands on an identical image, which is
 * what lets the hover and loading animations loop without a visible jump.
 */
const radius = 22;
const width = 11;
const gap = 4;
const centres = { left: 36, right: 64 } as const;
const cy = 50;
/** Where the rings cross, in degrees (y down) from the left ring's centre: the bottom crossing; the top one is 180° on the right ring. */
const crossing = (Math.acos((centres.right - centres.left) / 2 / radius) * 180) / Math.PI;

function point(cx: number, degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
}

function ring(cx: number, start: number) {
  return `M${point(cx, start)}A${radius} ${radius} 0 1 1 ${point(cx, start + 180)}A${radius} ${radius} 0 1 1 ${point(cx, start)}`;
}

/** The stretch of a ring that lies on top at its crossing, `spread` degrees either side of it. */
export function logoOverArc(side: "left" | "right", spread = 45) {
  const middle = side === "left" ? crossing : 180 + crossing;
  return `M${point(centres[side], middle - spread)}A${radius} ${radius} 0 0 1 ${point(centres[side], middle + spread)}`;
}

export const logoGeometry = {
  width,
  /** Width of the cut a ring makes in the one it passes over: its own stroke plus the gap on both sides. */
  cutWidth: width + 2 * gap,
  /** Full rings as paths (for the draw-in animation): the left one starts at its leftmost point, the right one at its rightmost. */
  leftRing: ring(centres.left, 180),
  rightRing: ring(centres.right, 0),
} as const;

/**
 * Drawn in `currentColor`. `.logo-rings` turns as a whole and each
 * `.logo-ring` has `pathLength` 100, so CSS can draw it in with a dash offset.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  // Mask ids must be unique per instance; useId's punctuation is not safe inside url(#…).
  const id = `logo${useId().replace(/[^\w-]/g, "")}`;
  const { cutWidth, leftRing, rightRing } = logoGeometry;
  return (
    <svg aria-hidden="true" className={`logo-mark ${className}`.trim()} focusable="false" viewBox="0 0 100 100">
      <defs>
        <mask height="100" id={`${id}-l`} maskUnits="userSpaceOnUse" width="100" x="0" y="0">
          <rect fill="#fff" height="100" width="100" />
          <path d={logoOverArc("right")} fill="none" stroke="#000" strokeWidth={cutWidth} />
        </mask>
        <mask height="100" id={`${id}-r`} maskUnits="userSpaceOnUse" width="100" x="0" y="0">
          <rect fill="#fff" height="100" width="100" />
          <path d={logoOverArc("left")} fill="none" stroke="#000" strokeWidth={cutWidth} />
        </mask>
      </defs>
      <g className="logo-rings" fill="none" stroke="currentColor" strokeWidth={width}>
        <path className="logo-ring" d={leftRing} mask={`url(#${id}-l)`} pathLength={100} />
        <path className="logo-ring" d={rightRing} mask={`url(#${id}-r)`} pathLength={100} />
      </g>
    </svg>
  );
}

/** The mark turning in half steps, for buttons that wait on the server; the button's own label says what is happening. */
export function LogoSpinner() {
  return <span aria-hidden="true" className="logo-spinner"><LogoMark /></span>;
}
