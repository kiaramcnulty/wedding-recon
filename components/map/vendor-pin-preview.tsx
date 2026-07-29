"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { type VendorType } from "@/lib/constants/categories";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";

interface VendorPinPreviewProps {
  vendorId: string;
  vendorType: VendorType;
  onClose: () => void;
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
  onClose,
}: VendorPinPreviewProps) {
  const router = useRouter();
  const items = useVendorPreviews([vendorId]);
  const item = items?.[0] ?? null;
  const cardRef = React.useRef<HTMLDivElement>(null);

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
      {/* Floats over the card's top-right corner so the card itself stays the
          same shape as in the list feed. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute -top-2 right-1 z-10 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      {item === null ? (
        <div className="flex h-[112px] items-center justify-center rounded-xl border bg-card shadow-xl">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <VendorPreviewCard
          item={item}
          vendorType={vendorType}
          // `from` returns the back button to the map with this peek reopened.
          onOpen={() =>
            router.push(
              `/vendor/${item.id}?from=${encodeURIComponent("/explore?restore=1")}`,
            )
          }
          className="shadow-xl"
        />
      )}
    </div>
  );
}
