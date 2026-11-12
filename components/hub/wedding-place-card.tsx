"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";
import { CATEGORIES } from "@/lib/constants/categories";
import { JOURNEY_HREF } from "@/lib/search/journey-state";
import {
  useJourneySnapshot,
  weddingPlaceOf,
  withoutWeddingPlace,
  writeJourney,
} from "@/lib/search/wedding-place";
import { cn } from "@/lib/utils";
import { vendorPath } from "@/lib/vendors/slug";

const HUB_RETURN = encodeURIComponent("/hub");

/**
 * The booked venue, or the town the couple is looking in, as the guided
 * journey recorded it: pinned above the saved vendors as its own card, with
 * Change (back into the journey at that step) and Remove (with Undo).
 * Renders nothing when the journey has no place.
 */
export function WeddingPlaceCard() {
  const journey = useJourneySnapshot();
  const place = React.useMemo(() => weddingPlaceOf(journey), [journey]);
  const vendorId = place?.kind === "venue" ? place.location.vendorId : undefined;
  const ids = React.useMemo(() => (vendorId ? [vendorId] : []), [vendorId]);
  const previews = useVendorPreviews(ids);
  const item = previews?.[0] ?? null;

  if (!journey || !place) return null;

  const remove = () => {
    const before = journey;
    writeJourney(withoutWeddingPlace(journey));
    toast(place.kind === "venue" ? "Venue removed" : "Town removed", {
      action: { label: "Undo", onClick: () => writeJourney(before) },
      // Longer than the 4s default: Undo is the whole point of this toast.
      duration: 8000,
    });
  };

  const when = formatWhen(place.weddingMonth, place.weddingYear);
  const venueColor = CATEGORIES.venue;

  return (
    <section className="px-4 pt-4" aria-label={place.kind === "venue" ? "Your venue" : "Your wedding town"}>
      <div className="rounded-2xl border border-brand/25 bg-brand-soft/60 p-2">
        <p className="px-1.5 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-brand-ink">
          {place.kind === "venue" ? "Your venue" : "Your wedding town"}
          {when && <span className="font-normal normal-case tracking-normal text-muted-foreground"> · {when}</span>}
        </p>

        {vendorId && item ? (
          <VendorPreviewCard
            item={item}
            vendorType="venue"
            showCategoryPill={false}
            href={`${vendorPath(item)}?from=${HUB_RETURN}`}
          />
        ) : vendorId && previews === null ? (
          <div className="h-[213px] animate-pulse rounded-xl bg-background" />
        ) : (
          // A town, or a venue that is not in our directory: no card to show,
          // just the place.
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full"
              style={
                place.kind === "venue"
                  ? { backgroundColor: venueColor.lightHex, color: venueColor.textHex }
                  : undefined
              }
            >
              {place.kind === "venue" ? (
                <venueColor.icon className="size-5" />
              ) : (
                <MapPin className="size-5 text-brand" />
              )}
            </span>
            <span className="min-w-0 truncate font-heading text-sm font-semibold">{place.location.label}</span>
          </div>
        )}

        <div className="flex items-center gap-2 px-1 pb-0.5 pt-2">
          <Link
            href={`${JOURNEY_HREF}?edit=${place.kind}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background")}
          >
            Change
          </Link>
          <button
            type="button"
            onClick={remove}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
          >
            Remove
          </button>
        </div>
      </div>
    </section>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatWhen(month?: number, year?: number): string | null {
  if (month && year) return `${MONTHS[month - 1]} ${year}`;
  if (year) return String(year);
  if (month) return MONTHS[month - 1];
  return null;
}
