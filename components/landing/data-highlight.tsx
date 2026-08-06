import Link from "next/link";

import { SwipeCarousel } from "@/components/landing/swipe-carousel";
import {
  CATEGORIES,
  CATEGORY_PLURAL,
  type VendorType,
} from "@/lib/constants/categories";
import {
  BEAUTY_SETUP,
  DATA_SECTION,
  VENDOR_COUNTS,
} from "@/lib/landing/content";
import { APP_HREF } from "@/lib/landing/nav";
import { cn } from "@/lib/utils";

/**
 * The directory in numbers, as a swipeable quick-facts deck. Replaces the old
 * "Colorado first" and "what you can look up" sections, and has to carry their
 * SEO weight as well as its own:
 *
 * - The category rows are LINKS to `/explore?types=<type>`, so the ten internal
 *   links the category grid used to provide survive the swap. They are inside a
 *   carousel card, which costs nothing: the deck is server-rendered, so every
 *   link and label is in the HTML whether or not that card is on screen.
 * - Every label is real DOM text, never baked into an image, so "venues",
 *   "photographers", "hotels" and the town names stay crawlable. If these
 *   charts are ever redrawn as SVG, keep the labels as <text>, not paths.
 *
 * Charts are plain HTML rather than a charting library: a ranked bar list and a
 * two-part split do not justify a dependency, and divs keep the text selectable.
 *
 * Color follows the dataviz rules. Bar length carries magnitude, so the fill is
 * a single hue - repainting ten bars in the ten category colors was tried and
 * rejected: run through the palette validator, planner green against food amber
 * comes out at deltaE 1.5 under deuteranopia (indistinguishable) and DJ purple
 * against band violet at 10 with full color vision, below the hard floor of 15.
 * Identity rides the icon swatch and the label instead, which is also how the
 * app's own category chips work.
 */

/**
 * The two-series split palette. Brand green plus the DJ violet already in
 * CATEGORIES - checked with the dataviz palette validator, which puts the pair
 * at deltaE 20.7 under deuteranopia and 31.7 with normal vision, clear of both
 * floors. Do not substitute a color here without re-running that check.
 */
const SPLIT_COLORS = ["#1D9E75", "#8B41C4"] as const;

/** Every card is the same height, so the deck does not jump as it scrolls. */
const CARD =
  "flex min-w-0 shrink-0 basis-[88%] snap-start flex-col rounded-2xl border bg-background p-5 shadow-sm sm:basis-[62%] lg:basis-[46%]";

export function DataHighlight() {
  // The scale is set by the capped values, not the true ones - see the note on
  // VENDOR_COUNTS. Without the cap the venue bar is 2.5x the next category and
  // the bottom half of the chart is unreadable.
  const maxVendors = Math.max(
    ...VENDOR_COUNTS.map((row) => row.barValue ?? row.count),
  );

  const labels = [
    DATA_SECTION.categoryChart.title,
    DATA_SECTION.beautyChart.title,
    DATA_SECTION.medianVenue.label,
    DATA_SECTION.reconFact.label,
    DATA_SECTION.coverageTitle,
  ];

  return (
    <div>
      <SwipeCarousel
        slideLabels={labels}
        label={DATA_SECTION.carouselLabel}
        hint={DATA_SECTION.carouselHint}
        className="mt-8"
      >
        {/* Vendors by category. The bar is the row's own background fill, which
            keeps ten categories inside one card height. */}
        <li className={CARD}>
          <CardHeading
            title={DATA_SECTION.categoryChart.title}
            subtitle={DATA_SECTION.categoryChart.subtitle}
          />
          <ul className="mt-4 space-y-0.5">
            {VENDOR_COUNTS.map(({ type, count, display, barValue }) => (
              <li key={type}>
                <Link
                  href={`${APP_HREF}?types=${type}`}
                  className="relative flex items-center gap-2 overflow-hidden rounded-md px-2 py-1 no-underline! transition-colors hover:bg-muted/60"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-r-[4px] bg-brand/15"
                    style={{
                      width: `${Math.min((barValue ?? count) / maxVendors, 1) * 100}%`,
                    }}
                  />
                  <CategorySwatch type={type} />
                  <span className="relative text-[13px] first-letter:uppercase">
                    {CATEGORY_PLURAL[type]}
                  </span>
                  <span className="relative ml-auto text-[13px] font-medium tabular-nums">
                    {display ?? count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>

        {/* Hair and makeup: comes-to-you vs studio. */}
        <li className={CARD}>
          <CardHeading title={DATA_SECTION.beautyChart.title} />

          {/* Part-to-whole, so one stacked bar rather than two. The 2px gap is
              in the surface color and is what separates the segments - never a
              stroke, which would add ink that is not data. Both segments are
              direct-labelled below, so identity never rests on color alone. */}
          <div className="mt-6 flex h-7 w-full gap-0.5">
            {BEAUTY_SETUP.segments.map((seg, i) => (
              <span
                key={seg.label}
                className={cn(
                  "block h-full",
                  i === 0 ? "rounded-l-[4px]" : "rounded-r-[4px]",
                )}
                style={{
                  width: `${seg.pct}%`,
                  backgroundColor: SPLIT_COLORS[i],
                }}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {BEAUTY_SETUP.segments.map((seg, i) => (
              <li key={seg.label} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SPLIT_COLORS[i] }}
                  aria-hidden
                />
                <span>{seg.label}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {seg.pct}%
                </span>
              </li>
            ))}
          </ul>

          {/* If a base is set it ships with the chart. NOTE (2026-08-04): the
              base was removed from content.ts, so the 78/22 split now reads as
              a share of ALL hair and makeup artists rather than of the 50 who
              said where they work. Optional here so that stays the author's
              call, but a percentage without its denominator asserts something
              the data does not support - put it back if in doubt. */}
          {"base" in BEAUTY_SETUP && (
            <p className="mt-auto pt-4 text-xs leading-relaxed text-muted-foreground">
              {(BEAUTY_SETUP as { base?: string }).base}
            </p>
          )}
        </li>

        {/* Median venue starting price. */}
        <li className={CARD}>
          <FigureCard
            value={DATA_SECTION.medianVenue.value}
            label={DATA_SECTION.medianVenue.label}
          />
        </li>

        {/* Recon entries on file. */}
        <li className={CARD}>
          <FigureCard
            value={DATA_SECTION.reconFact.value}
            label={DATA_SECTION.reconFact.label}
            note={DATA_SECTION.reconFact.note}
          />
        </li>

        {/* Coverage: town names kept as text so the local search terms survive
            the removal of the old Colorado section. */}
        <li className={CARD}>
          <h3 className="font-heading text-base font-semibold">
            {DATA_SECTION.coverageTitle}
          </h3>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {DATA_SECTION.coverageAreas.map((area) => (
              <li
                key={area}
                className="rounded-full border border-brand/25 bg-brand-soft/50 px-2.5 py-1 text-[13px] text-brand-ink"
              >
                {area}
              </li>
            ))}
          </ul>
        </li>
      </SwipeCarousel>

      <p className="mt-4 text-xs text-muted-foreground">
        {DATA_SECTION.measuredOn}
      </p>
    </div>
  );
}

function CardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </>
  );
}

/** A single headline number - a stat tile, deliberately not a one-bar chart. */
function FigureCard({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="font-heading text-5xl font-semibold tracking-tight text-brand-ink">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium">{label}</p>
      {note && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}

function CategorySwatch({ type }: { type: VendorType }) {
  const { icon: Icon, colorHex } = CATEGORIES[type];
  return (
    <span
      className="relative flex size-5 shrink-0 items-center justify-center"
      style={{ color: colorHex }}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}
