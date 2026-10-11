import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Vendor Verification badge: a blue check + "Vendor verified", and nothing
 * else — no popover, no tooltip, no identity claim (locked decision, see
 * docs/vendor-verification-plan.md). One component everywhere the badge shows:
 * the vendor-page header, the preview card (all four surfaces), the Hub, the
 * search dropdown and the portal.
 *
 * A SOLID pill (white on blue), not tinted text: a paying vendor's mark has to
 * read at a glance next to a category label of the same size. Blue, deliberately
 * NOT green (green is the brand + the venue category color), and deeper than the
 * photos category (`#378ADD`), so the two never read as the same mark even when
 * a verified photographer's pin and this badge share a card. The colors are the
 * `--verified*` tokens in app/globals.css.
 *
 * Three sizes:
 * - default: "Vendor verified" pill (vendor-page header, portal).
 * - `compact`: shorter "Verified" pill for cards, where the name competes for
 *   width (the preview card on every surface).
 * - `iconOnly`: the bare check for the tightest rows (the search dropdown); the
 *   accessible name is preserved via `aria-label`.
 */
export function VerifiedBadge({
  iconOnly = false,
  compact = false,
  className,
}: {
  iconOnly?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <BadgeCheck
        aria-label="Vendor verified"
        role="img"
        className={cn("size-4 shrink-0 text-verified", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-verified font-semibold text-white shadow-[0_1px_4px_rgb(29_78_216/0.35)]",
        compact
          ? "gap-0.5 py-px pr-1.5 pl-1 text-[11px]"
          : "gap-1 py-0.5 pr-2.5 pl-1.5 text-xs",
        className,
      )}
    >
      <BadgeCheck className={compact ? "size-3.5 shrink-0" : "size-4 shrink-0"} aria-hidden />
      {compact ? "Verified" : "Vendor verified"}
    </span>
  );
}
