"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { type VendorType } from "@/lib/constants/categories";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";
import { cn } from "@/lib/utils";

/** One row of the feed: the vendor to preview, and the type that styles it. */
export interface VendorListEntry {
  id: string;
  vendorType: VendorType;
}

interface VendorListSheetProps {
  /** Vendors to list, in display order. Each carries its OWN type, so a feed can mix them. */
  entries: VendorListEntry[];
  /** Sheet title + accessible label (e.g. "24 venues available"). */
  heading: string;
  /** sessionStorage key the feed's scroll position is parked under across a vendor round trip. */
  scrollKey: string;
  /** Rendered under the last card — e.g. a note that the feed was capped. */
  footnote?: string;
  onClose: () => void;
}

/**
 * Zillow-style bottom-sheet feed of vendors. Opens over the map; dismissed by
 * the ✕, a swipe-down, Escape, or a tap on the dimmed backdrop. Tapping an item
 * opens that vendor's page (with a `from` that returns here).
 *
 * Shared by both list surfaces — the tapped-cluster feed
 * (`cluster-list-sheet.tsx`) and the "all results on screen" feed
 * (`explore/page.tsx`) — which differ only in what they put in `entries` and
 * `heading`. Change the sheet here and both move together.
 *
 * Rendered on demand (only while a list is open), so — like the external-link
 * overlay — it needs no mounted-state guard: the DOM exists by the time it does.
 */
export function VendorListSheet({
  entries,
  heading,
  scrollKey,
  footnote,
  onClose,
}: VendorListSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Stable id list for the preview fetch, plus the type each id renders with —
  // a mixed feed can't take one type for the whole list.
  const ids = React.useMemo(() => entries.map((e) => e.id), [entries]);
  const typeById = React.useMemo(() => {
    const m = new Map<string, VendorType>();
    for (const e of entries) m.set(e.id, e.vendorType);
    return m;
  }, [entries]);
  const items = useVendorPreviews(ids);

  // Lock background scroll + close on Escape while the sheet is up.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Swipe-down-to-dismiss. Native (non-passive) listeners so touchmove can
  // preventDefault — React attaches touch listeners as passive. Only engages
  // when the feed is scrolled to the top, so it never fights list scrolling.
  React.useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    let startY: number | null = null;
    let startX = 0;
    let dragging = false;
    // Axis lock: a touch that starts moving mostly horizontally belongs to a
    // recon-preview carousel, so the sheet must not claim it as a swipe-down.
    let axis: "h" | "v" | null = null;
    let dy = 0;

    const start = (e: TouchEvent) => {
      if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = true;
      axis = null;
      dy = 0;
      el.style.transition = "none";
    };
    const move = (e: TouchEvent) => {
      if (!dragging || startY == null) return;
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
        // Pulling up — hand control back to normal list scrolling.
        el.style.transform = "";
        return;
      }
      if ((scrollRef.current?.scrollTop ?? 0) > 0) {
        dragging = false;
        el.style.transform = "";
        return;
      }
      e.preventDefault();
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = "transform 0.2s ease-out";
      if (dy > 120) {
        el.style.transform = "translateY(100%)";
        window.setTimeout(onClose, 180);
      } else {
        el.style.transform = "";
      }
      startY = null;
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

  // Restore the feed's scroll position after returning from a vendor page. Set
  // before paint (layout effect) so the list doesn't flash at the top first.
  React.useLayoutEffect(() => {
    if (items === null) return;
    let saved: number | null = null;
    try {
      const raw = sessionStorage.getItem(scrollKey);
      if (raw != null) {
        saved = Number(raw);
        sessionStorage.removeItem(scrollKey);
      }
    } catch {
      // sessionStorage unavailable — nothing to restore
    }
    if (saved != null && !Number.isNaN(saved) && scrollRef.current) {
      scrollRef.current.scrollTop = saved;
    }
  }, [items, scrollKey]);

  // `from` returns the back button here: /explore?restore=1 reopens this sheet.
  // (The map view restores independently on any return — see explore/page.tsx.)
  const vendorHref = (id: string) =>
    `/vendor/${id}?from=${encodeURIComponent("/explore?restore=1")}`;

  /** Remember where we are in the feed so returning here lands in the same spot. */
  function rememberScroll() {
    try {
      if (scrollRef.current) {
        sessionStorage.setItem(scrollKey, String(scrollRef.current.scrollTop));
      }
    } catch {
      // sessionStorage unavailable — back will just land at the top
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl animate-in slide-in-from-bottom-8 fade-in-0 duration-200"
      >
        {/* Grab handle (also the primary swipe-down target) */}
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <div
            className="h-1.5 w-10 rounded-full bg-muted-foreground/30"
            aria-hidden
          />
        </div>

        {/* Header: count + close */}
        <div className="flex shrink-0 items-center gap-2 border-b px-4 pb-3 pt-1">
          <h2 className="min-w-0 flex-1 font-heading text-base font-semibold">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close list"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        >
          {items === null ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    // Native content-visibility virtualization: off-screen cards
                    // skip layout/paint, so a few-hundred-item feed stays smooth.
                    className={cn(
                      "[content-visibility:auto]",
                      item.slides.length > 0
                        ? "[contain-intrinsic-size:auto_196px]"
                        : "[contain-intrinsic-size:auto_112px]",
                    )}
                  >
                    <VendorPreviewCard
                      item={item}
                      vendorType={typeById.get(item.id) ?? "other"}
                      href={vendorHref(item.id)}
                      onNavigate={rememberScroll}
                    />
                  </li>
                ))}
              </ul>
              {footnote && (
                <p className="px-1 pb-1 pt-4 text-center text-xs text-muted-foreground">
                  {footnote}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
