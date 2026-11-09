import { cn } from "@/lib/utils";

/**
 * Fine-line botanical art for the bridal polish (Kiara, 2026-11-08): no words,
 * just the feel of a printed invitation. Drawn in `currentColor` at a hairline
 * weight, so a caller sets the colour and opacity with text classes. Purely
 * decorative: always `aria-hidden`, never a tap target.
 */

// Leaves along the stem: [x, y, angle, scale]. Alternating sides, smaller
// toward the tip, so it reads as a eucalyptus or olive sprig.
const LEAVES: [number, number, number, number][] = [
  [20, 50, -70, 1.25],
  [30, 45, 12, 1.2],
  [42, 38, -66, 1.15],
  [53, 33, 8, 1.08],
  [65, 27, -60, 1],
  [76, 21, 2, 0.92],
  [88, 16, -54, 0.82],
  [98, 11, -4, 0.7],
];

/**
 * A curved sprig, from the bottom left to its tip at the top right. Mirror it
 * with `-scale-y-100` to hang from a top-left corner, or `rotate-180` for the
 * top-right one.
 */
export function Sprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path
        d="M4 58 C 28 48, 58 34, 114 6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {LEAVES.map(([x, y, a, k], i) => (
        <path
          key={i}
          d="M0 0 C 4 -5.5, 12 -5.5, 17 0 C 12 5.5, 4 5.5, 0 0 Z M0 0 L 14 0"
          transform={`translate(${x} ${y}) rotate(${a}) scale(${k})`}
          stroke="currentColor"
          strokeWidth="0.8"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.12"
        />
      ))}
      {/* A few berries near the tip. */}
      <circle cx="108" cy="13" r="1.4" fill="currentColor" fillOpacity="0.5" />
      <circle cx="103" cy="5" r="1.1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="113" cy="1.8" r="0.9" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}

/** A hairline divider with a small heart at its centre. */
export function Flourish({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 12"
      fill="none"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path d="M2 6 H 58" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
      <path d="M82 6 H 138" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
      <path
        d="M70 10 C 66.5 7.6, 63.5 5.6, 63.5 3.6 C 63.5 2, 64.8 1, 66.3 1 C 67.6 1, 68.6 1.8, 70 3.2 C 71.4 1.8, 72.4 1, 73.7 1 C 75.2 1, 76.5 2, 76.5 3.6 C 76.5 5.6, 73.5 7.6, 70 10 Z"
        stroke="currentColor"
        strokeWidth="0.75"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <circle cx="61" cy="6" r="0.9" fill="currentColor" />
      <circle cx="79" cy="6" r="0.9" fill="currentColor" />
    </svg>
  );
}
