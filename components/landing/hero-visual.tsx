import { CATEGORIES, type VendorType } from "@/lib/constants/categories";
import { EXAMPLE_RECON } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

/**
 * The hero illustration: a stylised Colorado map with category pins, and an
 * example recon entry floating over it.
 *
 * Drawn in code rather than shipped as an image — it stays sharp at any size,
 * costs no bytes, and picks its pin colors straight out of CATEGORIES, so the
 * marketing page can never drift from the palette on the real map.
 *
 * The example card carries no vendor name on purpose: an invented quote
 * attached to a real business would be a fabricated review of someone's
 * livelihood, which is exactly the thing this product must not do. It used to
 * also carry an "Example" badge; that was dropped (Kiara, 2026-08-04) as
 * redundant with the standard reading of a hero mockup. The anonymity is what
 * the rule actually rests on, so keep the place generic - a county, not a venue.
 */

/** Pins scattered over the panel, positioned in percentages of the panel box. */
const PINS: { type: VendorType; left: string; top: string }[] = [
  { type: "venue", left: "20%", top: "26%" },
  { type: "photos", left: "48%", top: "16%" },
  { type: "food", left: "72%", top: "31%" },
  { type: "flowers", left: "34%", top: "48%" },
  { type: "band", left: "62%", top: "56%" },
  { type: "beauty", left: "14%", top: "62%" },
  { type: "planner", left: "84%", top: "62%" },
];

function MapPin({ type, left, top }: (typeof PINS)[number]) {
  const { icon: Icon, colorHex } = CATEGORIES[type];
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left, top }}
    >
      <span
        className="flex size-9 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white sm:size-10"
        style={{ backgroundColor: colorHex }}
      >
        <Icon className="size-4 sm:size-[18px]" strokeWidth={2.25} />
      </span>
    </span>
  );
}

export function HeroVisual({ className }: { className?: string }) {
  return (
    <div className={cn("w-full max-w-md", className)}>
      {/* Faux map — decorative, so it's hidden from assistive tech entirely.
          Everything it communicates is said in the copy beside it. */}
      <div
        aria-hidden="true"
        className="relative aspect-[5/4] overflow-hidden rounded-3xl border border-brand/20 bg-brand-soft shadow-sm"
      >
        {/* Dot grid, for the map-tile read. */}
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in srgb, var(--brand) 35%, transparent) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        {/* Front Range, roughly. Two layers so the ridge has depth. */}
        <svg
          className="absolute inset-x-0 bottom-0 w-full"
          viewBox="0 0 400 140"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 108 L58 62 L96 92 L150 40 L206 96 L252 66 L300 100 L348 58 L400 104 L400 140 L0 140 Z"
            fill="var(--brand)"
            opacity="0.16"
          />
          <path
            d="M0 128 L44 96 L92 120 L142 84 L192 118 L246 94 L296 124 L344 98 L400 126 L400 140 L0 140 Z"
            fill="var(--brand)"
            opacity="0.28"
          />
        </svg>

        {PINS.map((pin) => (
          <MapPin key={pin.type} {...pin} />
        ))}
      </div>

      {/* Example recon entry, overlapping the panel's bottom edge. */}
      <div className="relative z-10 mx-auto -mt-12 w-[88%] rounded-2xl border bg-card p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: CATEGORIES.venue.lightHex,
              color: CATEGORIES.venue.textHex,
            }}
          >
            {EXAMPLE_RECON.category}
          </span>
          <span className="text-xs text-muted-foreground">
            {EXAMPLE_RECON.place}
          </span>
        </div>

        {/* Detail sits on its own line rather than inline beside the price.
            Inline only reads well while it is short: a longer one wraps under
            the figure and orphans its last word, which a copy edit shouldn't
            be able to cause. */}
        <p className="mt-3 font-heading text-2xl font-semibold leading-none">
          {EXAMPLE_RECON.price}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {EXAMPLE_RECON.priceDetail}
        </p>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {EXAMPLE_RECON.notes}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
            {EXAMPLE_RECON.reconType}
          </span>
          <span>{EXAMPLE_RECON.collected}</span>
        </div>
      </div>
    </div>
  );
}
