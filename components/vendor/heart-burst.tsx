/**
 * The save "bloom" (Kiara, 2026-11-08): a soft ring and seven tiny hearts that
 * drift out from the save heart and fade. Rendered only while the heart pops,
 * centred on it by the caller (a `relative` box). Decorative and inert; the
 * keyframes live in app/globals.css and stop under reduced motion.
 */

// [dx, dy, rotate, size, delay]: an uneven ring about 20px out, so it reads
// as petals scattering rather than a mechanical starburst. Kept within ~18px
// upward: on a preview card the heart sits 22px below an edge that clips.
const PARTICLES: [number, number, number, number, number][] = [
  [0, -16, -8, 7, 0],
  [-16, -9, -28, 6, 40],
  [16, -8, 24, 6, 20],
  [-19, 6, -40, 5, 70],
  [19, 6, 36, 5, 60],
  [-8, 17, -16, 5, 110],
  [9, 17, 14, 4, 90],
];

export function HeartBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className="animate-heart-ring absolute left-1/2 top-1/2 size-6 rounded-full border border-rose/60" />
      {PARTICLES.map(([dx, dy, r, size, delay], i) => (
        <svg
          key={i}
          viewBox="0 0 10 9"
          className="animate-heart-burst absolute left-1/2 top-1/2 text-rose"
          style={
            {
              width: size,
              height: size,
              animationDelay: `${delay}ms`,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--r": `${r}deg`,
            } as React.CSSProperties
          }
        >
          <path
            d="M5 9 C 2 6.8, 0 5, 0 3 C 0 1.3, 1.3 0, 2.8 0 C 3.7 0, 4.4 0.5, 5 1.3 C 5.6 0.5, 6.3 0, 7.2 0 C 8.7 0, 10 1.3, 10 3 C 10 5, 8 6.8, 5 9 Z"
            fill="currentColor"
          />
        </svg>
      ))}
    </span>
  );
}
