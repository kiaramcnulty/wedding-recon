"use client";

import * as React from "react";
import type { VendorTag } from "@/lib/filters/vendor-tags";
import { cn } from "@/lib/utils";

/**
 * Renders the filter-tag pills produced by `vendorTags()`. Two shapes:
 *
 * - `VendorTagList` — the full, wrapping list for the vendor detail page.
 * - `VendorTagPreview` — a single clipped line with a static "+N more" count,
 *   for the preview cards (map feeds, single-pin peek, Planning Hub). The count
 *   is not a control — the whole card is one tap target, so "+N more" is just a
 *   truthful hint that the detail page has the rest.
 *
 * Both hide themselves entirely when a vendor has no known facets — the couple
 * sees a tag row only when there is something real to show (Kiara, 2026-08-12).
 *
 * A `matched` pill (one satisfying an active filter) carries a thin brand ring
 * so the couple can see WHY a vendor surfaced; the rest are muted so they read
 * as secondary metadata and do not compete with the category pill.
 */

function Pill({ tag }: { tag: VendorTag }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        tag.matched
          ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/30"
          : "bg-muted text-muted-foreground",
      )}
    >
      {tag.label}
    </span>
  );
}

/** Overflow chip. Shares the muted pill styling so it reads as one of the row. */
function MoreChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/** Full, wrapping list — every tag, no truncation. */
export function VendorTagList({
  tags,
  className,
}: {
  tags: VendorTag[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((t) => (
        <Pill key={t.key} tag={t} />
      ))}
    </div>
  );
}

const GAP_PX = 6; // gap-1.5

/**
 * One clipped line of pills with a "+N more" count.
 *
 * The count is exact, not a fixed cap: pill widths vary wildly ("Barn / rustic"
 * vs "$8k–$12k"), so a static "show 3" would overflow some cards and underfill
 * others. An off-screen measurement row holds every pill (plus a sample chip)
 * at natural width; a layout effect fits as many as the container holds,
 * reserving room for the chip, and recomputes on resize. Measuring in a layout
 * effect means the count is settled before the browser paints, so there is no
 * flash of an overflowing row.
 */
export function VendorTagPreview({
  tags,
  className,
}: {
  tags: VendorTag[];
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(tags.length);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const avail = container.clientWidth;
      if (avail === 0) return; // not laid out yet — the observer will fire later
      const children = Array.from(measure.children) as HTMLElement[];
      if (children.length === 0) return;
      const chip = children[children.length - 1];
      const pills = children.slice(0, -1);
      const chipW = chip.offsetWidth;

      // Does the whole row fit with no chip at all?
      let total = 0;
      for (let i = 0; i < pills.length; i++) {
        total += (i > 0 ? GAP_PX : 0) + pills[i].offsetWidth;
      }
      if (total <= avail) {
        setVisibleCount(pills.length);
        return;
      }

      // It overflows, so a chip is needed: fit pills while leaving room for it.
      let used = 0;
      let count = 0;
      for (let i = 0; i < pills.length; i++) {
        const w = (i > 0 ? GAP_PX : 0) + pills[i].offsetWidth;
        if (used + w + GAP_PX + chipW > avail) break;
        used += w;
        count++;
      }
      setVisibleCount(count);
    };

    compute();
    // Observe BOTH the container (viewport width, rotation) and the measurement
    // row (its children's widths). The latter matters because these cards live
    // inside `content-visibility:auto` list items: an off-screen card's pills
    // measure 0 until it scrolls in, at which point the measurement row's size
    // changes and this recomputes — so the "+N more" count self-heals rather
    // than being stuck on a count taken while the pills had no width.
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [tags]);

  if (tags.length === 0) return null;

  const shown = tags.slice(0, visibleCount);
  const hidden = tags.length - visibleCount;

  return (
    <div ref={containerRef} className={cn("relative w-full overflow-hidden", className)}>
      {/* The visible single row. visibleCount is computed so it never wraps. */}
      <div className="flex gap-1.5">
        {shown.map((t) => (
          <Pill key={t.key} tag={t} />
        ))}
        {hidden > 0 && <MoreChip>+{hidden} more</MoreChip>}
      </div>

      {/* Off-screen measurement row: every pill at natural width, plus a sample
          chip sized to the worst case. `visibility:hidden` keeps layout (so
          offsetWidth is real) while painting nothing and taking no tap. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10 flex gap-1.5"
        style={{ visibility: "hidden" }}
      >
        {tags.map((t) => (
          <Pill key={t.key} tag={t} />
        ))}
        <MoreChip>+{tags.length} more</MoreChip>
      </div>
    </div>
  );
}
