"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { type VendorType } from "@/lib/constants/categories";
import {
  VendorPreviewCard,
  useVendorPreviews,
} from "@/components/map/vendor-preview-card";
import { cn } from "@/lib/utils";

/**
 * Rows added per page. Sized to comfortably overfill a phone screen (cards are
 * roughly 112-196px in an 844px viewport) so the couple never sees the bottom
 * of the window, while keeping the preview query — and its request URL — small.
 */
const FEED_PAGE_SIZE = 20;

/** One row of the feed: the vendor to preview, and the type that styles it. */
export interface VendorListEntry {
  id: string;
  vendorType: VendorType;
}

/**
 * The scrollable list of vendor cards, with no shell of its own.
 *
 * Extracted from `vendor-list-sheet.tsx` so the same feed can be a bottom-sheet
 * (the tapped-cluster case, which is genuinely a modal subset of the map) or a
 * full VIEW alongside the map (the results case, reached by the Map/List
 * toggle). Those want completely different containers but exactly the same
 * cards, scroll-restore and preview fetching.
 */
export function VendorFeed({
  entries,
  scrollKey,
  footnote,
  className,
  scrollRef: externalScrollRef,
}: {
  /** Vendors to list, in display order. Each carries its OWN type, so a feed can mix them. */
  entries: VendorListEntry[];
  /** sessionStorage key the scroll position is parked under across a vendor round trip. */
  scrollKey: string;
  /** Rendered under the last card — e.g. a note that the feed was capped. */
  footnote?: string;
  className?: string;
  /**
   * Lets a host observe the scroll container. The bottom-sheet needs it: its
   * swipe-down-to-dismiss must only engage at scrollTop 0, or a swipe meant to
   * scroll the list closes the sheet instead.
   */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const ownScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? ownScrollRef;

  // How many rows we have asked for previews of. The feed can be handed up to
  // MAX_VISIBLE_ENTRIES (200) vendors, and the preview fetch pulls every active
  // recon entry for every id in one query — full `notes` / `price_details`
  // prose plus a media join — to render a two-line truncated carousel.
  // Measured against a realistic corpus, 119 vendors was 237 recon rows and
  // 171 KB, on a request URL of 4,770 characters (200 ids is about 8 KB, which
  // is at or past what gateways will carry). Asking for a page at a time makes
  // the first paint proportional to a screenful instead of to the whole list.
  const [shownCount, setShownCount] = React.useState(FEED_PAGE_SIZE);

  // A materially different list (a pan, a filter change) starts again at the
  // first page. Keyed on the id list rather than array identity so a re-render
  // that produces an equal list does not reset the couple's scroll depth.
  //
  // Adjusted DURING render rather than in an effect. This is React's documented
  // way to reset state when a prop changes: setting state while rendering makes
  // React re-run this component before it touches the DOM, so the children never
  // see the stale window. An effect would set state after paint, which both
  // renders a frame of the previous list and trips the cascading-render rule.
  const entriesKey = entries.map((e) => e.id).join(",");
  const [prevEntriesKey, setPrevEntriesKey] = React.useState(entriesKey);
  if (prevEntriesKey !== entriesKey) {
    setPrevEntriesKey(entriesKey);
    setShownCount(FEED_PAGE_SIZE);
  }

  const shown = React.useMemo(
    () => entries.slice(0, shownCount),
    [entries, shownCount],
  );
  const hasMore = shownCount < entries.length;

  // Stable id list for the preview fetch, plus the type each id renders with —
  // a mixed feed can't take one type for the whole list.
  const ids = React.useMemo(() => shown.map((e) => e.id), [shown]);
  const typeById = React.useMemo(() => {
    const m = new Map<string, VendorType>();
    for (const e of entries) m.set(e.id, e.vendorType);
    return m;
  }, [entries]);
  const items = useVendorPreviews(ids);

  // Grow the window when the sentinel below the last card comes near. The
  // observer is created only while there IS more to show, so it stops costing
  // anything at the end of the list. rootMargin buys a screenful of runway so
  // the next page is usually already in hand by the time it is scrolled to.
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (obs) => {
        if (obs.some((o) => o.isIntersecting)) {
          setShownCount((n) => Math.min(n + FEED_PAGE_SIZE, entries.length));
        }
      },
      { root: scrollRef.current, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, entries.length, scrollRef, items]);

  // Restore scroll after returning from a vendor page. Set before paint (layout
  // effect) so the list doesn't flash at the top first.
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
  }, [items, scrollKey, scrollRef]);

  // `from` returns the back button here: /explore?restore=1 restores the view.
  const vendorHref = (id: string) =>
    `/vendor/${id}?from=${encodeURIComponent("/explore?restore=1")}`;

  /** Remember where we are so returning here lands in the same spot. */
  function rememberScroll() {
    try {
      if (scrollRef.current) {
        sessionStorage.setItem(scrollKey, String(scrollRef.current.scrollTop));
      }
    } catch {
      // sessionStorage unavailable — back will just land at the top
    }
  }

  return (
    <div
      ref={scrollRef}
      className={cn("overflow-y-auto overscroll-contain px-3 py-3", className)}
    >
      {items === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          No vendors here. Try moving the map or loosening a filter.
        </p>
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
          {/* Sentinel: crossing into view (or within 600px of it) pages in the
              next batch. Kept OUTSIDE the list so it is never a stray <li>. */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex justify-center py-4"
              aria-hidden
            >
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Announced separately from the spinner, which is decorative — a
              screen reader gets the count, not a perpetual "loading". */}
          <p className="sr-only" role="status">
            {hasMore
              ? `Showing ${items.length} of ${entries.length} vendors. Scroll for more.`
              : `Showing all ${items.length} vendors.`}
          </p>
          {footnote && !hasMore && (
            <p className="px-1 pb-1 pt-4 text-center text-xs text-muted-foreground">
              {footnote}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Segmented Map / List switch. */
export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: "map" | "list";
  onChange: (next: "map" | "list") => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className={cn(
        "flex shrink-0 items-center rounded-full border border-border bg-background/95 p-0.5 shadow-sm backdrop-blur",
        className,
      )}
    >
      {(["map", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full px-3 py-1 text-[13px] capitalize transition-colors",
            view === v
              ? "bg-foreground font-medium text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
