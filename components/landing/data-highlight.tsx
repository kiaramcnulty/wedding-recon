import Link from "next/link";

import {
  CATEGORIES,
  CATEGORY_PLURAL,
  type VendorType,
} from "@/lib/constants/categories";
import { BEAUTY_SETUP, DATA_SECTION, VENDOR_COUNTS } from "@/lib/landing/content";
import { APP_HREF } from "@/lib/landing/nav";
import { cn } from "@/lib/utils";

/**
 * The directory in numbers. Replaces the old "Colorado first" and "what you can
 * look up" sections, and has to carry their SEO weight as well as its own:
 *
 * - The category bars are LINKS to `/explore?types=<type>`, so the eleven
 *   internal links the category grid used to provide survive the swap.
 * - Every label is real DOM text, never baked into an image, so "venues",
 *   "photographers", "hotels" and the town names stay crawlable. If these
 *   charts are ever redrawn as SVG, keep the labels as <text>, not paths.
 *
 * Charts are plain HTML rather than a charting library: two ranked bar lists do
 * not justify a dependency, and divs keep the text selectable and crawlable.
 *
 * Colour follows the dataviz rules. Bar length carries magnitude, so the fill
 * is a single hue - repainting ten bars in the ten category colours was tried
 * and rejected: run through the palette validator, planner green against food
 * amber comes out at deltaE 1.5 under deuteranopia (indistinguishable) and DJ
 * purple against band violet at 10 with full colour vision, below the hard
 * floor of 15. Identity rides the icon swatch and the label instead, which is
 * also how the app's own category chips work.
 */
/**
 * The two-series split palette. Brand green plus the DJ violet already in
 * CATEGORIES - checked with the dataviz palette validator, which puts the pair
 * at deltaE 20.7 under deuteranopia and 31.7 with normal vision, clear of both
 * floors. Do not substitute a colour here without re-running that check.
 */
const SPLIT_COLORS = ["#1D9E75", "#8B41C4"] as const;

export function DataHighlight() {
  const maxVendors = Math.max(...VENDOR_COUNTS.map((row) => row.count));

  return (
    <div className="space-y-12">
      {/* Headline figures. Three numbers is a stat row, not a chart. */}
      <dl className="grid gap-6 sm:grid-cols-3">
        <Stat
          value={DATA_SECTION.headline.vendors}
          label={DATA_SECTION.headline.vendorsLabel}
        />
        <Stat
          value={DATA_SECTION.headline.types}
          label={DATA_SECTION.headline.typesLabel}
        />
        <Stat
          value={DATA_SECTION.headline.recon}
          label={DATA_SECTION.headline.reconLabel}
        />
      </dl>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        {/* Vendors by category ------------------------------------------- */}
        <section>
          <ChartHeading
            title={DATA_SECTION.categoryChart.title}
            subtitle={DATA_SECTION.categoryChart.subtitle}
          />
          <ul className="mt-5 space-y-2">
            {VENDOR_COUNTS.map(({ type, count }) => (
              <li key={type}>
                <Link
                  href={`${APP_HREF}?types=${type}`}
                  className="block rounded-lg px-2 py-1.5 no-underline! transition-colors hover:bg-background"
                >
                  <span className="flex items-center gap-2">
                    <CategorySwatch type={type} />
                    <span className="text-sm first-letter:uppercase">
                      {CATEGORY_PLURAL[type]}
                    </span>
                    <span className="ml-auto text-sm font-medium tabular-nums">
                      {count}
                    </span>
                  </span>
                  <Bar value={count} max={maxVendors} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Hair and makeup: comes-to-you vs studio ----------------------- */}
        <section>
          <ChartHeading
            title={DATA_SECTION.beautyChart.title}
            subtitle={DATA_SECTION.beautyChart.subtitle}
          />

          {/* Part-to-whole, so one stacked bar rather than two. The 2px gap is
              in the surface colour and is what separates the segments - never
              a stroke, which would add ink that is not data. The pair clears
              the palette validator at deltaE 20.7 under deuteranopia, and both
              segments are direct-labelled below, so identity never rests on
              colour alone. */}
          <div className="mt-6 flex h-6 w-full gap-0.5 overflow-hidden">
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
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {seg.count}
                </span>
              </li>
            ))}
          </ul>

          {/* The denominator ships with the chart. A share without its base is
              a claim rather than a fact. */}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {BEAUTY_SETUP.base}
          </p>

          <div className="mt-8 rounded-2xl border bg-background p-5">
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {DATA_SECTION.medianVenue.value}
            </p>
            <p className="mt-1 text-sm font-medium">
              {DATA_SECTION.medianVenue.label}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {DATA_SECTION.medianVenue.note}
            </p>
          </div>
        </section>
      </div>

      {/* Coverage: town names kept as text so the local search terms survive
          the removal of the old Colorado section. */}
      <div>
        <h3 className="font-heading text-base font-semibold">
          {DATA_SECTION.coverageTitle}
        </h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {DATA_SECTION.coverageAreas.map((area) => (
            <li
              key={area}
              className="rounded-full border border-brand/25 bg-brand-soft/50 px-3 py-1.5 text-sm text-brand-ink"
            >
              {area}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        {DATA_SECTION.measuredOn}
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-heading text-4xl font-semibold tracking-tight text-brand-ink sm:text-5xl">
          {value}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
          {label}
        </span>
      </dd>
    </div>
  );
}

function ChartHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </>
  );
}

function CategorySwatch({ type }: { type: VendorType }) {
  const { icon: Icon, colorHex, lightHex } = CATEGORIES[type];
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: lightHex, color: colorHex }}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

/**
 * A bar. Thin, square at the baseline and rounded 4px at the data end, growing
 * from a single left baseline - the fixed mark spec. The value is already
 * printed on the row above, so the bar carries no label of its own.
 */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="mt-1.5 block h-2.5 w-full rounded-sm bg-border/60">
      <span
        className="block h-full rounded-l-none rounded-r-[4px] bg-brand"
        style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
      />
    </span>
  );
}
