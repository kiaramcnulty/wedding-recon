import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The Vendor Verification badge: a blue check + "Vendor verified", and nothing
 * else — no popover, no tooltip, no identity claim (locked decision, see
 * docs/vendor-verification-plan.md). One component everywhere the badge shows:
 * the vendor-page header, the preview card (all four surfaces), the Hub.
 *
 * Blue, deliberately NOT green (green is the brand + the venue category color).
 * The hue is a deeper blue than the photos category (`#378ADD`) and the shape
 * is a distinct check-in-circle, so the two never read as the same mark even
 * when a verified photographer's pin and this badge share a card.
 *
 * `iconOnly` drops the label for tight surfaces (the preview card, where the
 * vendor name already competes for width); the accessible name is preserved via
 * `aria-label` / `title`.
 */

// One deep-blue token, defined here so both fills stay in lockstep. Tailwind's
// blue-700; distinct from the photos-category `#378ADD` at a glance.
const VERIFIED_BLUE = "#1D4ED8";

export function VerifiedBadge({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <BadgeCheck
        aria-label="Vendor verified"
        role="img"
        className={cn("size-4 shrink-0", className)}
        style={{ color: VERIFIED_BLUE }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs font-semibold",
        className,
      )}
      style={{ color: VERIFIED_BLUE }}
    >
      <BadgeCheck className="size-4 shrink-0" aria-hidden />
      Vendor verified
    </span>
  );
}
