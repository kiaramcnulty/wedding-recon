"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Scroll shell for the "why this exists / how it works" cards.
 *
 * Built on CSS scroll-snap rather than a carousel library, which matters for
 * three reasons: it costs no dependency, every card is in the server-rendered
 * HTML (so a crawler reads all the quotes whether or not it scrolls), and touch
 * swipe is the browser's own rather than a re-implementation of it. The arrows
 * and dots are a progressive enhancement - with JavaScript disabled the track
 * still swipes and scrolls, it just loses the buttons.
 *
 * The cards arrive as `children`, already rendered on the server (see
 * ValueCard), so this component holds no content of its own; `slideLabels`
 * carries just the strings the dots need for their accessible names.
 *
 * This is the only Client Component on the landing page, and the exception was
 * worth it: on a desktop mouse, with no horizontal scroll wheel, the arrows are
 * the only discoverable way through the cards.
 */
export function ValueCarousel({
  children,
  slideLabels,
  label,
  hint,
  className,
}: {
  children: React.ReactNode;
  slideLabels: string[];
  label: string;
  hint: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    // Also true when nothing overflows, which correctly disables both arrows.
    setAtEnd(el.scrollLeft >= max - 4);
    const count = slideLabels.length;
    const step = el.scrollWidth / Math.max(count, 1);
    setActive(Math.min(count - 1, Math.round(el.scrollLeft / step)));
  }, [slideLabels.length]);

  // Measure once after mount (deferred a tick to satisfy
  // react-hooks/set-state-in-effect) and again on resize - how many cards fit,
  // and so whether the arrows are live, is a function of the viewport.
  useEffect(() => {
    const t = setTimeout(sync, 0);
    window.addEventListener("resize", sync);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const page = useCallback((direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // Scroll by a fraction of the viewport rather than a fixed pixel count, so
    // one press advances roughly one screenful at every breakpoint.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  const goTo = useCallback((index: number) => {
    const card = trackRef.current?.children[index];
    // `block: "nearest"` is load-bearing: without it the browser also scrolls
    // the page vertically to centre the card, yanking the reader out of the
    // section they are reading.
    card?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  }, []);

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={trackRef}
        onScroll={sync}
        aria-label={label}
        tabIndex={0}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2",
          // scroll-px must match px, or the browser aligns the first card to
          // the container edge and scrolls the gutter away.
          "scroll-px-1 px-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand",
        )}
      >
        {children}
      </ul>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={atStart}
          aria-label="Previous"
          className="flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35 disabled:hover:text-muted-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={atEnd}
          aria-label="Next"
          className="flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-35 disabled:hover:text-muted-foreground"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>

        <div className="flex gap-1.5">
          {slideLabels.map((slideLabel, i) => (
            <button
              key={slideLabel}
              type="button"
              aria-label={slideLabel}
              aria-current={i === active}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-6 bg-brand" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          {hint}
        </span>
      </div>
    </div>
  );
}
