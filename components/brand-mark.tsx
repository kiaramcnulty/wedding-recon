import { cn } from "@/lib/utils";

/**
 * Wedding Recon logo — a magnifying glass with a tiered wedding cake inside the
 * lens. Kept in sync with app/icon.svg (the favicon / PWA icon). Sizing is
 * controlled via className (defaults to size-12).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wedding Recon"
      className={cn("size-12", className)}
    >
      <defs>
        <clipPath id="brandLensClip">
          <circle cx="27" cy="27" r="18.5" />
        </clipPath>
      </defs>
      {/* Handle */}
      <line
        x1="40"
        y1="40"
        x2="54"
        y2="54"
        stroke="#1D9E75"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Lens fill */}
      <circle cx="27" cy="27" r="18.5" fill="#E1F5EE" />
      {/* Wedding cake (clipped to the lens) */}
      <g clipPath="url(#brandLensClip)" fill="#1D9E75">
        <path d="M27 23.2C23.2 20.4 22.2 18.6 24 17.4c1.2-0.8 2.4-0.3 3 0.6 0.6-0.9 1.8-1.4 3-0.6 1.8 1.2 0.8 3-3 5.8Z" />
        <rect x="21" y="24.5" width="12" height="6" rx="1.6" />
        <rect x="16.5" y="31.5" width="21" height="7.5" rx="1.6" />
        <rect x="14.5" y="39.6" width="25" height="2.6" rx="1.3" />
      </g>
      {/* Lens ring */}
      <circle
        cx="27"
        cy="27"
        r="18.5"
        stroke="#1D9E75"
        strokeWidth="4.5"
        fill="none"
      />
    </svg>
  );
}
