"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxPhoto {
  /** Small variant shown inline in the strip. */
  thumb: string;
  /** Full-size variant, fetched only when the photo is opened. */
  full: string;
  /**
   * Optional corner chip naming the photo's source, e.g. "Google". Deliberately
   * a plain string rather than a ReactNode: these arrays are built in the vendor
   * page (a Server Component) and handed to a client one, so keeping the field
   * serializable avoids a needless client boundary.
   */
  badge?: string;
  /**
   * When true, the tile holds its `src` until it is scrolled into view (an
   * IntersectionObserver, not just `loading="lazy"`, which has a load-ahead
   * margin). Set on BILLED tiles (a Google Place Photos fetch) so a photo the
   * couple never scrolls to costs nothing; free recon tiles load immediately.
   */
  defer?: boolean;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  alt?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  tileClassName?: string;
}

// A horizontal drag past this many pixels counts as a swipe to the next/previous
// photo rather than a tap. Kept comfortably above a tap's jitter so a stationary
// tap-to-close is never read as a swipe.
const SWIPE_THRESHOLD_PX = 40;

/**
 * A strip of photo thumbnails that open full-size in an overlay. Once open, the
 * photos are a single sequence you can page through — arrow buttons, the
 * keyboard's left/right keys, or a swipe on touch — so opening any tile lets you
 * reach every other one without closing first (this is why the vendor page
 * merges its recon and Google photos into one array).
 *
 * Thumbnails load lazily; a tile marked `defer` (a billed Google fetch) holds its
 * `src` behind an IntersectionObserver, so a Google photo scrolled off the strip
 * that the couple never reaches is never fetched (a Place Photos fetch avoided).
 * The full image is fetched only when a photo is actually opened, so default page
 * egress is unchanged (the lightbox adds no baseline cost). Navigation is
 * intentionally NOT preloaded — fetching adjacent full-size images the couple may
 * never look at would undo that saving — so the next photo loads on demand.
 */
export function PhotoLightbox({
  photos,
  alt = "Photo",
  containerClassName,
  containerStyle,
  tileClassName,
}: PhotoLightboxProps) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const [mounted, setMounted] = React.useState(false);
  // A tile whose image fails to load (e.g. a proxied Google photo that 404s) is
  // dropped rather than shown as a broken icon. Indices stay stable so the
  // lightbox still maps correctly.
  const [failed, setFailed] = React.useState<ReadonlySet<number>>(new Set());

  // The photos still showing, in original order. Navigation walks THIS list, not
  // the raw indices, so a dropped tile is skipped rather than landing on a blank
  // frame — the couple only ever paged past tiles they could see in the strip.
  const visibleIndices = React.useMemo(
    () => photos.map((_, i) => i).filter((i) => !failed.has(i)),
    [photos, failed],
  );

  // Step to the next (dir +1) or previous (dir -1) visible photo, clamped at the
  // ends. Functional update so it reads the latest open index without the
  // handlers below needing it as a dependency.
  const step = React.useCallback(
    (dir: 1 | -1) => {
      setOpenIdx((cur) => {
        if (cur === null) return cur;
        const pos = visibleIndices.indexOf(cur);
        if (pos === -1) return cur;
        const next = pos + dir;
        if (next < 0 || next >= visibleIndices.length) return cur; // clamp
        return visibleIndices[next];
      });
    },
    [visibleIndices],
  );

  // Portals need the DOM; defer the mount flag (see CLAUDE.md portal pattern).
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx, step]);

  // Swipe tracking. A horizontal drag on the overlay pages through the photos;
  // the guard flag stops the tap-to-close click that a browser may synthesize
  // after the gesture from also dismissing the lightbox.
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const swipedRef = React.useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Horizontal intent only: a mostly-vertical drag is left alone (it isn't a
    // page turn), so it falls through to the tap-to-close behavior unchanged.
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      step(dx < 0 ? 1 : -1); // swipe left → next, swipe right → previous
    }
  };

  if (photos.length === 0) return null;

  const pos = openIdx === null ? -1 : visibleIndices.indexOf(openIdx);
  const atStart = pos <= 0;
  const atEnd = pos < 0 || pos >= visibleIndices.length - 1;
  const canPage = visibleIndices.length > 1;

  return (
    <>
      <div className={containerClassName} style={containerStyle}>
        {photos.map((p, i) =>
          failed.has(i) ? null : (
            <button
              key={p.full + i}
              type="button"
              onClick={() => setOpenIdx(i)}
              aria-label={`Open ${alt.toLowerCase()} ${i + 1}`}
              className={cn(
                "relative block shrink-0 cursor-zoom-in overflow-hidden",
                tileClassName,
              )}
            >
              <TileImage
                photo={p}
                index={i}
                alt={alt}
                onFail={() =>
                  setFailed((prev) => {
                    const next = new Set(prev);
                    next.add(i);
                    return next;
                  })
                }
              />
              {p.badge && (
                // Names the source per-tile, which is what lets photos of
                // different provenance share one strip without the credit
                // beneath it appearing to cover all of them.
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white backdrop-blur-[2px]">
                  {p.badge}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {mounted &&
        openIdx !== null &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${alt} ${openIdx + 1}`}
            onClick={() => {
              // A swipe can be followed by a synthesized click on the backdrop;
              // swallow that one so paging never doubles as a dismiss.
              if (swipedRef.current) {
                swipedRef.current = false;
                return;
              }
              setOpenIdx(null);
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/85 p-4"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpenIdx(null)}
              className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>

            {canPage && (
              // Position counter, so a long strip doesn't lose the couple's place.
              <span className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
                {pos + 1} / {visibleIndices.length}
              </span>
            )}

            {canPage && !atStart && (
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            {canPage && !atEnd && (
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
              >
                <ChevronRight className="size-6" />
              </button>
            )}

            {/* No `key` on the src: reusing the element keeps the current photo
                on screen while the next one decodes, rather than flashing black.
                The counter above updates on the index change, so a swipe still
                registers instantly even before the image itself swaps. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[openIdx].full}
              alt={`${alt} ${openIdx + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full cursor-default rounded-lg object-contain"
            />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * One strip thumbnail. A `defer` tile (a billed Google Place Photos fetch) holds
 * its `src` until an IntersectionObserver reports it scrolled into view, so a
 * Google photo the couple never reaches is never fetched. A free recon tile
 * loads immediately (with the browser's lazy hint as a bonus). `onFail` drops a
 * tile whose image 404s (e.g. a rotated Google photo), matching the parent.
 */
function TileImage({
  photo,
  index,
  alt,
  onFail,
}: {
  photo: LightboxPhoto;
  index: number;
  alt: string;
  onFail: () => void;
}) {
  const ref = React.useRef<HTMLImageElement | null>(null);
  const [show, setShow] = React.useState(!photo.defer);

  React.useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (a very old engine): load it, deferred a tick so
    // this is not a synchronous setState in an effect body.
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      // A small margin so the tile loads as the couple scrolls toward it rather
      // than popping in blank — a tile they never approach still never loads.
      { rootMargin: "150px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      // `undefined` (not "") so a not-yet-shown tile requests nothing at all.
      src={show ? photo.thumb : undefined}
      alt={`${alt} ${index + 1}`}
      loading="lazy"
      decoding="async"
      onError={onFail}
      className="h-full w-full bg-muted object-cover"
    />
  );
}
