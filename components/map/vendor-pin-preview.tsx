"use client";

import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { SaveButton } from "@/components/vendor/save-button";
import { type VendorType } from "@/lib/constants/categories";
import type { FilterSelection } from "@/lib/filters/match";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";
import { vendorPath } from "@/lib/vendors/slug";
import {
  captureClient,
  type PeekSurface,
} from "@/lib/analytics/posthog";

interface VendorPinPreviewProps {
  vendorId: string;
  vendorType: VendorType;
  /** Active attribute filters for this vendor's type, so matched tags sort first. */
  selection?: FilterSelection;
  onClose: () => void;
  /** Where the vendor page's back button returns. Defaults to Explore with this peek reopened. */
  returnTo?: string;
  /** Which map this peek is over, for the `vendor_peek_opened` event. */
  surface: PeekSurface;
}

/**
 * Zillow-style peek card for a single tapped map pin: the same preview card the
 * cluster feed uses (`vendor-preview-card.tsx`), floated over the bottom of the
 * map. Deliberately NOT a modal — no backdrop, no scroll lock, no portal — so
 * the map stays pannable underneath and the next pin tap just swaps the card.
 * Tapping the card is what opens the full vendor page.
 *
 * Dismissed by the ✕, Escape, a swipe down, or a tap on empty map (the map
 * reports background taps; see `vendor-map.tsx`).
 */
export function VendorPinPreview({
  vendorId,
  vendorType,
  selection,
  onClose,
  returnTo = "/explore?restore=1",
  surface,
}: VendorPinPreviewProps) {
  const items = useVendorPreviews([vendorId]);
  const item = items?.[0] ?? null;
  const cardRef = React.useRef<HTMLDivElement>(null);

  // One `vendor_peek_opened` per peek shown, fired once the preview resolves
  // so it can carry `verified`. Keyed on the vendor, so tapping a second pin
  // (which swaps the card in place) counts again, and a re-render does not.
  const peekedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!item || peekedRef.current === item.id) return;
    peekedRef.current = item.id;
    captureClient("vendor_peek_opened", {
      vendor_id: item.id,
      vendor_type: vendorType,
      surface,
      verified: item.verified,
    });
  }, [item, vendorType, surface]);

  // Escape closes, matching the cluster sheet.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Swipe-down-to-dismiss. Native (non-passive) listeners so touchmove can
  // preventDefault — React attaches touch listeners as passive. The axis lock
  // hands horizontal drags to the card's recon-preview carousel.
  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let startY = 0;
    let startX = 0;
    let dragging = false;
    let axis: "h" | "v" | null = null;
    let dy = 0;

    const start = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = true;
      axis = null;
      dy = 0;
      el.style.transition = "none";
    };
    const move = (e: TouchEvent) => {
      if (!dragging) return;
      dy = e.touches[0].clientY - startY;
      if (axis === null) {
        const dx = e.touches[0].clientX - startX;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // not committed yet
        axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
      if (axis === "h") {
        dragging = false;
        el.style.transform = "";
        return;
      }
      if (dy <= 0) {
        el.style.transform = ""; // pulling up — nothing above to reveal
        return;
      }
      e.preventDefault();
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = "transform 0.2s ease-out";
      if (dy > 60) {
        el.style.transform = "translateY(120%)";
        window.setTimeout(onClose, 180);
      } else {
        el.style.transform = "";
      }
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [onClose]);

  // The vendor row is gone (deleted between fetch and tap) — nothing to peek at.
  if (items !== null && !item) return null;

  return (
    <div
      ref={cardRef}
      aria-label="Vendor preview"
      className="relative animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
    >
      {/* Floats over the card's top-LEFT corner so the card itself stays the
          same shape as in the list feed; the top-right corner is the save
          heart, as on every other card. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute -left-1 -top-2 z-10 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      {item === null ? (
        <div className="flex h-[213px] items-center justify-center rounded-xl border bg-card shadow-xl">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <VendorPreviewCard
          item={item}
          vendorType={vendorType}
          selection={selection}
          // `from` returns the back button to the map it was opened from.
          href={vendorPath(item, returnTo)}
          onNavigate={() =>
            captureClient("vendor_card_clicked", {
              vendor_id: item.id,
              vendor_type: vendorType,
              surface,
              position: null,
              verified: item.verified,
            })
          }
          cornerAction={
            <SaveButton vendorId={item.id} vendorType={vendorType} returnTo={returnTo} variant="overlay" />
          }
          className="shadow-xl"
        />
      )}
    </div>
  );
}
