"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_PLURAL,
  VENDOR_TYPES,
  type CategoryMeta,
  type VendorType,
} from "@/lib/constants/categories";
import {
  filtersForType,
  SEASONS,
  DAY_TYPES,
  VENUE_PRICE_ASSUMPTIONS,
  type FilterDef,
} from "@/lib/constants/vendor-filters";
import HISTOGRAMS from "@/lib/constants/filter-histograms.json";
import type { Vendor } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * Per-type attribute filters for Explore.
 *
 * Attribute filters are inherently per-vendor-type — you cannot filter venues
 * by cuisine — so the sheet only opens once exactly one type is chosen. That is
 * also why the trigger is disabled rather than hidden with no type selected:
 * a disabled control with a reason is discoverable, a missing one is not.
 *
 * Histograms come from `filter-histograms.json`, generated from the real corpus
 * by `scripts/backfill-vendor-filters.mjs`, so a slider shows where vendors
 * actually sit rather than a uniform axis nobody occupies. Bins are NON-uniform
 * (roughly equal-count), which is why every slider indexes bins rather than
 * values — a linear track over these edges would put the handle in the wrong
 * place.
 */

type Hist = { min: number; max: number; median: number; bins: { lo: number; hi: number; n: number }[] };
type HistByType = Record<string, Record<string, Hist>>;
const HIST = HISTOGRAMS as HistByType;

export type FilterState = Record<string, unknown>;

/** The date a venue price should be quoted for. Venue only. */
export interface DateContext {
  season?: string;
  day?: string;
}

function money(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

function fmt(def: FilterDef, n: number): string {
  if (def.unit === "usd") return money(n);
  if (def.unit === "weeks") return `${n} wk`;
  return String(n);
}

/* ------------------------------------------------------------------ chips */

/**
 * A selected chip fills with the vendor type's OWN colour — the same hue as its
 * map pins and its category chip — so the sheet reads as part of that category
 * rather than as a neutral system dialog.
 */
function Chip({
  on,
  meta,
  onClick,
  children,
  size = "md",
}: {
  on: boolean;
  meta: CategoryMeta;
  onClick: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={
        on
          ? { backgroundColor: meta.colorHex, borderColor: meta.colorHex }
          : { borderColor: `${meta.colorHex}40`, color: meta.textHex }
      }
      className={cn(
        "rounded-full border transition-colors",
        size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
        on ? "font-medium text-white" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ChipGroup({
  def,
  value,
  meta,
  onChange,
}: {
  def: FilterDef;
  value: string[];
  meta: CategoryMeta;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {def.options?.map((o) => (
        <Chip
          key={o.value}
          on={value.includes(o.value)}
          meta={meta}
          onClick={() =>
            onChange(
              value.includes(o.value)
                ? value.filter((v) => v !== o.value)
                : [...value, o.value],
            )
          }
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- histogram */

/**
 * Dual-thumb range slider over the histogram.
 *
 * Two overlaid native `input[type=range]` elements rather than a custom drag
 * implementation: that keeps keyboard control, focus rings and screen-reader
 * semantics for free. The trick that makes it work is `pointer-events: none` on
 * the inputs with it re-enabled on the THUMBS only, so a drag always reaches the
 * nearest thumb instead of the topmost track swallowing it.
 *
 * The thumbs index BINS, not values. The histogram bins are roughly equal-count
 * and therefore non-uniform in width, so a linear value track would put the
 * handle visibly out of step with the bar under it.
 */
function RangeControl({
  def,
  hist,
  value,
  accent,
  onChange,
  scaled,
}: {
  def: FilterDef;
  hist: Hist;
  value: { min?: number; max?: number } | undefined;
  accent: string;
  onChange: (next: { min?: number; max?: number } | undefined) => void;
  /** Bin counts under the current companion selection, for the rescale. */
  scaled?: number[];
}) {
  const bins = hist.bins;
  const counts = scaled ?? bins.map((b) => b.n);
  const peak = Math.max(1, ...counts);
  const last = bins.length - 1;

  const loIdx = value?.min == null ? 0 : Math.max(0, bins.findIndex((b) => b.hi > value.min!));
  const hiRaw = value?.max == null ? last : bins.findIndex((b) => b.hi >= value.max!);
  const hiIdx = hiRaw < 0 ? last : hiRaw;

  const emit = (lo: number, hi: number) => {
    const full = lo === 0 && hi === last;
    onChange(full ? undefined : { min: bins[lo].lo, max: bins[hi].hi });
  };

  // Everything on this control is positioned in ONE coordinate system: the
  // centre of the histogram bar a value selects.
  //
  // A native range input does NOT put its thumb at value/max across the track.
  // It insets the travel by half a thumb at each end so the thumb never
  // overhangs, so its centre is `half + (v/max) * (width - thumbWidth)`. Placing
  // the filled range at bar centres while the thumbs used that other geometry
  // left a visible gap between thumb and fill that grew toward both ends.
  //
  // Rather than reposition the fill to match the input, the inputs are inset so
  // their thumb travel runs exactly from the first bar centre to the last. Then
  // thumb, fill and bar all agree, and the fill can stay in plain percentages.
  const n = bins.length;
  const pct = (i: number) => ((i + 0.5) / n) * 100;
  const THUMB_PX = 20; // must match the size-5 thumb below
  // Travel starts at bar-centre 0 and ends at bar-centre last; the +/- half a
  // thumb converts between "thumb centre" and the input box the browser insets.
  const inputInset = {
    left: `calc(${100 / (2 * n)}% - ${THUMB_PX / 2}px)`,
    width: `calc(${100 - 100 / n}% + ${THUMB_PX}px)`,
  };
  const thumb =
    "pointer-events-none absolute top-0 h-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white " +
    "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab " +
    "[&::-webkit-slider-thumb]:bg-[var(--thumb)] [&::-moz-range-thumb]:bg-[var(--thumb)] " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 " +
    "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full " +
    "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white " +
    "[&::-moz-range-thumb]:shadow-md";

  return (
    <div>
      <div className="flex h-14 items-end gap-[3px]" aria-hidden>
        {counts.map((n, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[2px] transition-all"
            style={{
              height: `${Math.max(3, (n / peak) * 100)}%`,
              backgroundColor: i >= loIdx && i <= hiIdx ? accent : `${accent}26`,
            }}
          />
        ))}
      </div>

      <div
        className="relative mt-2 h-5"
        style={{ ["--thumb" as string]: accent }}
      >
        {/* The unfilled track spans the same first-to-last bar-centre range the
            thumbs travel, so it starts and ends under them rather than running
            past into the gutter. */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted"
          style={{ left: `${pct(0)}%`, right: `${100 - pct(last)}%` }}
        />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${pct(loIdx)}%`,
            right: `${100 - pct(hiIdx)}%`,
            backgroundColor: accent,
          }}
        />
        <input
          type="range"
          aria-label={`${def.label} minimum`}
          min={0}
          max={last}
          value={loIdx}
          onChange={(e) => emit(Math.min(+e.target.value, hiIdx), hiIdx)}
          style={inputInset}
          className={thumb}
        />
        <input
          type="range"
          aria-label={`${def.label} maximum`}
          min={0}
          max={last}
          value={hiIdx}
          onChange={(e) => emit(loIdx, Math.max(+e.target.value, loIdx))}
          style={inputInset}
          className={thumb}
        />
      </div>

      <p className="mt-2 text-[13px] font-medium">
        {fmt(def, bins[loIdx].lo)} – {fmt(def, bins[hiIdx].hi)}
        {hiIdx === last && def.unit === "usd" ? "+" : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- sheet */

/**
 * The filter groups for ONE vendor type — whichever category tab is focused.
 * Filters are type-scoped, so only the focused type's controls are on screen;
 * the others keep their state and are one tap away.
 */
function TypeSection({
  vendorType,
  vendors,
  state,
  dateContext,
  onChange,
  onDateContextChange,
}: {
  vendorType: VendorType;
  vendors: Vendor[];
  state: FilterState;
  dateContext: DateContext;
  onChange: (next: FilterState) => void;
  onDateContextChange: (next: DateContext) => void;
}) {
  const meta = CATEGORIES[vendorType];
  const defs = filtersForType(vendorType);
  const hist = HIST[vendorType] ?? {};
  const pool = useMemo(
    () => vendors.filter((v) => v.vendor_type === vendorType),
    [vendors, vendorType],
  );
  const activeCount = Object.keys(state).length;

  const set = (key: string, v: unknown) => {
    const next = { ...state };
    if (v == null || (Array.isArray(v) && v.length === 0) || v === false) delete next[key];
    else next[key] = v;
    onChange(next);
  };

  /**
   * Bin counts for a price histogram under the current companion selection.
   * This is the rescale: pick "Day-of coordination" and the price bars redraw
   * to day-of planners only, because the distributions genuinely differ (the
   * 8k-plus tail is almost entirely full planning).
   */
  const rescaledCounts = (def: FilterDef): number[] | undefined => {
    if (!def.rescaledBy) return undefined;
    const h = hist[def.lo ?? def.key];
    if (!h) return undefined;

    const subset = pool.filter((v) => {
      if (def.rescaledBy === "date_context") return true;
      const picked = state[def.rescaledBy!] as string[] | undefined;
      if (!picked?.length) return true;
      const own = v.filters?.[def.rescaledBy!];
      return Array.isArray(own) && own.some((x) => picked.includes(String(x)));
    });
    if (subset.length === pool.length && def.rescaledBy !== "date_context") return undefined;

    return h.bins.map((b) =>
      subset.filter((v) => {
        const n = priceForContext(v, def, dateContext);
        return typeof n === "number" && n >= b.lo && n <= b.hi;
      }).length,
    );
  };

  const header = (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-[14px] font-semibold capitalize">
        {CATEGORY_PLURAL[vendorType]}
      </h3>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            onChange({});
            onDateContextChange({});
          }}
          className="text-[12px] text-muted-foreground underline underline-offset-2"
        >
          Clear {CATEGORY_PLURAL[vendorType]}
        </button>
      )}
    </div>
  );

  /** A short summary of what a group has selected, shown on its closed row. */
  const summarize = (def: FilterDef): string | null => {
    const v = state[def.key];
    if (v == null) return null;
    if (def.kind === "bool") return v === true ? "Yes" : null;
    if (def.kind === "multi") {
      const picked = v as string[];
      if (!picked.length) return null;
      const labels = picked.map(
        (x) => def.options?.find((o) => o.value === x)?.label ?? x,
      );
      return labels.length <= 2
        ? labels.join(", ")
        : `${labels[0]} +${labels.length - 1}`;
    }
    const r = v as { min?: number; max?: number };
    if (r.min == null && r.max == null) return null;
    const h = hist[def.lo ?? def.key];
    const lo = r.min ?? h?.min ?? 0;
    const hi = r.max ?? h?.max ?? 0;
    return `${fmt(def, lo)} – ${fmt(def, hi)}`;
  };

  const groups = (
    <Accordion
      defaultValue={defs.length ? [defs[0].key] : []}
      multiple
      className="divide-y divide-border"
    >
      {defs.map((def) => {
        const h = hist[def.lo ?? def.key];
        const isPriceWithDate =
          def.rescaledBy === "date_context" && vendorType === "venue";
        const summary = summarize(def);

        return (
          <AccordionItem key={def.key} value={def.key} className="border-none">
            <AccordionTrigger
              className="py-3 hover:no-underline"
              style={{ color: meta.textHex }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-semibold">{def.label}</span>
                {def.rare && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                    Rare
                  </span>
                )}
                {summary && (
                  <span
                    className="truncate rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: meta.lightHex,
                      color: meta.textHex,
                    }}
                  >
                    {summary}
                  </span>
                )}
              </span>
            </AccordionTrigger>

            <AccordionContent className="pb-4">
              {def.hint && (
                <p className="mb-2 text-[12px] text-muted-foreground">{def.hint}</p>
              )}

              {def.kind === "multi" && (
                <ChipGroup
                  def={def}
                  meta={meta}
                  value={(state[def.key] as string[]) ?? []}
                  onChange={(v) => set(def.key, v)}
                />
              )}

              {def.kind === "bool" && (
                <Chip
                  on={state[def.key] === true}
                  meta={meta}
                  onClick={() => set(def.key, state[def.key] === true ? null : true)}
                >
                  {def.label}
                </Chip>
              )}

              {def.kind === "range" && h && (
                <div>
                  {/* The rescale control sits directly above the histogram it
                      rescales, inside the same group, so the two read as one
                      thing (Kiara, 2026-08-05). */}
                  {isPriceWithDate && (
                    <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {SEASONS.map((se) => (
                          <Chip
                            key={se.value}
                            size="sm"
                            meta={meta}
                            on={dateContext.season === se.value}
                            onClick={() =>
                              onDateContextChange({
                                ...dateContext,
                                season:
                                  dateContext.season === se.value
                                    ? undefined
                                    : se.value,
                              })
                            }
                          >
                            {se.label} · {se.months}
                          </Chip>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {DAY_TYPES.map((d) => (
                          <Chip
                            key={d.value}
                            size="sm"
                            meta={meta}
                            on={dateContext.day === d.value}
                            onClick={() =>
                              onDateContextChange({
                                ...dateContext,
                                day:
                                  dateContext.day === d.value ? undefined : d.value,
                              })
                            }
                          >
                            {d.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}

                  <RangeControl
                    def={def}
                    hist={h}
                    value={state[def.key] as { min?: number; max?: number }}
                    accent={meta.colorHex}
                    onChange={(v) => set(def.key, v)}
                    scaled={rescaledCounts(def)}
                  />

                  {def.unit === "usd" &&
                    vendorType === "venue" &&
                    def.key === "price" && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Venues quoting per person are shown at{" "}
                        {VENUE_PRICE_ASSUMPTIONS.guests} guests, per hour at{" "}
                        {VENUE_PRICE_ASSUMPTIONS.hours} hours.
                      </p>
                    )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  return (
    <div>
      {header}
      {groups}
    </div>
  );
}

/**
 * ONE sheet for the whole filtering decision: which categories to show, and how
 * to narrow each of them.
 *
 * It replaced a two-sheet flow — pick categories in one, close it, open a
 * separate Filters sheet, scroll to find each category's section. That made a
 * single decision feel like an errand (Kiara, 2026-08-05).
 *
 * The category chips do two jobs at once, which is the only subtle part. They
 * choose which types appear on the map (multi-select, changes results) AND which
 * type's filters are on screen (single, navigation). A plain tab bar conflates
 * those, so the rule is: tapping a chip always SELECTS and FOCUSES it, and a
 * selected chip carries an explicit clear button to remove it. Tapping is
 * therefore always additive and safe — there is no "tap again to remove" gesture
 * that could silently discard the filters you just set.
 */
export function VendorFilterSheet({
  selectedTypes,
  onSelectedTypesChange,
  vendors,
  visibleTotal,
  visiblePartial,
  states,
  dateContexts,
  onChangeType,
  onDateContextChange,
  onClearAll,
  onClose,
}: {
  selectedTypes: VendorType[];
  onSelectedTypesChange: (next: VendorType[]) => void;
  /**
   * Rows the map holds. Used ONLY to rescale histograms, never to count:
   * it spans the padded fetch box, which reaches well beyond the viewport.
   */
  vendors: Vendor[];
  /**
   * On-screen totals, straight from the map. The footer counts these rather
   * than counting `vendors` itself, so the sheet and the results pill can never
   * disagree - they are literally the same numbers.
   */
  visibleTotal: number;
  visiblePartial: number;
  states: Partial<Record<VendorType, FilterState>>;
  dateContexts: Partial<Record<VendorType, DateContext>>;
  onChangeType: (t: VendorType, next: FilterState) => void;
  onDateContextChange: (t: VendorType, next: DateContext) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState<VendorType | null>(
    selectedTypes[0] ?? null,
  );

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const matched = Math.max(0, visibleTotal - visiblePartial);
  const totalActive = selectedTypes.reduce(
    (n, t) => n + Object.keys(states[t] ?? {}).length,
    0,
  );

  // Focus follows selection: the focused type must always be one that is
  // actually shown, or the panel would be editing filters for a hidden category.
  const focusedType =
    focused && selectedTypes.includes(focused) ? focused : (selectedTypes[0] ?? null);

  const select = (t: VendorType) => {
    if (!selectedTypes.includes(t)) onSelectedTypesChange([...selectedTypes, t]);
    setFocused(t);
  };

  const deselect = (t: VendorType) => {
    onSelectedTypesChange(selectedTypes.filter((x) => x !== t));
    if (focused === t) setFocused(null);
  };

  const body = (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* A FIXED height, not max-height. With max-height the sheet resized every
          time its contents changed — picking a category grew it from a stub to
          nearly full screen, and collapsing an accordion group shrank it again,
          so the whole panel lurched under the thumb. A fixed box scrolls
          internally instead and never moves (Kiara, 2026-08-05). Height is set
          so the map stays visible above it: this is a filter over the map, not
          a page of its own. */}
      <div className="relative flex h-[68vh] flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <h2 className="text-[15px] font-semibold">Show me</h2>
          {totalActive > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[13px] text-muted-foreground underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full p-1.5 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Category tabs. Wrapping rather than a horizontal scroller so every
            category — and the pin colour legend — stays visible at a glance;
            inside a sheet the rows are affordable in a way they were not on the
            map. */}
        <div
          role="group"
          aria-label="Vendor categories"
          className="flex shrink-0 flex-wrap gap-1.5 border-b border-border px-4 pb-3"
        >
          <button
            type="button"
            aria-pressed={selectedTypes.length === 0}
            onClick={() => {
              onSelectedTypesChange([]);
              setFocused(null);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              selectedTypes.length === 0
                ? "border-foreground bg-foreground font-medium text-background"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            All
          </button>

          {VENDOR_TYPES.map((t) => {
            const m = CATEGORIES[t];
            const on = selectedTypes.includes(t);
            const isFocused = on && focusedType === t;
            const count = Object.keys(states[t] ?? {}).length;
            const Icon = m.icon;
            return (
              <span
                key={t}
                style={
                  on
                    ? { backgroundColor: m.colorHex, borderColor: m.colorHex }
                    : { borderColor: `${m.colorHex}40` }
                }
                className={cn(
                  "inline-flex items-center rounded-full border text-[13px] transition-colors",
                  on ? "text-white" : "bg-background",
                  // Two states have to stay separable here: which categories are
                  // ON THE MAP (filled) and which one's filters are ON SCREEN
                  // (ringed). Without an explicit ring colour Tailwind inherits
                  // currentColor, which on a filled chip is white on white and
                  // vanishes. A foreground ring reads on every category hue.
                  isFocused &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  // A selected but unfocused tab is dimmed, so the focused one
                  // is obvious even where the ring is clipped by scrolling.
                  on && !isFocused && "opacity-70",
                )}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => select(t)}
                  style={on ? undefined : { color: m.textHex }}
                  className={cn(
                    "flex items-center gap-1.5 py-1.5 pl-3",
                    on ? "pr-1.5 font-medium" : "pr-3",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {m.label}
                  {count > 0 && (
                    <span className="rounded-full bg-white/25 px-1.5 text-[11px]">
                      {count}
                    </span>
                  )}
                </button>
                {on && (
                  <button
                    type="button"
                    onClick={() => deselect(t)}
                    aria-label={`Remove ${m.label}`}
                    className="mr-1 rounded-full p-1 hover:bg-white/20"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {focusedType ? (
            filtersForType(focusedType).length > 0 ? (
              <TypeSection
                key={focusedType}
                vendorType={focusedType}
                vendors={vendors}
                state={states[focusedType] ?? {}}
                dateContext={dateContexts[focusedType] ?? {}}
                onChange={(next) => onChangeType(focusedType, next)}
                onDateContextChange={(next) =>
                  onDateContextChange(focusedType, next)
                }
              />
            ) : (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                No detail filters for {CATEGORY_PLURAL[focusedType]} yet.
              </p>
            )
          ) : (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Showing every category. Pick one above to narrow it down.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-foreground py-3 text-[14px] font-semibold text-background"
          >
            Show {matched} {matched === 1 ? "match" : "matches"} on screen
            {visiblePartial > 0 && (
              <span className="font-normal opacity-80">
                {" "}
                · {visiblePartial} missing some info
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(body, document.body) : null;
}

/** The number a price histogram should bin this vendor under. */
function priceForContext(
  v: Vendor,
  def: FilterDef,
  dc: DateContext,
): number | undefined {
  const f = v.filters;
  if (!f) return undefined;
  if (def.rescaledBy === "date_context" && (dc.season || dc.day) && Array.isArray(f.price_tiers)) {
    const hits = (f.price_tiers as Array<Record<string, unknown>>).filter(
      (t) =>
        (!dc.season || t.season == null || t.season === dc.season) &&
        (!dc.day || t.day_type == null || t.day_type === dc.day),
    );
    const mins = hits.map((t) => t.min).filter((n): n is number => typeof n === "number");
    if (mins.length) return Math.min(...mins);
  }
  const n = f[def.lo ?? def.key];
  return typeof n === "number" ? n : undefined;
}

/* ----------------------------------------------------------------- trigger */

/**
 * The single Explore control. It summarizes the whole filter state — which
 * categories, how many detail filters — and opens the one sheet that edits all
 * of it. There used to be two controls here (a category chip and a separate
 * Filters button) for what is really one decision.
 */
export function FilterButton({
  selectedTypes,
  activeCount,
  onClick,
  className,
}: {
  selectedTypes: VendorType[];
  activeCount: number;
  onClick: () => void;
  className?: string;
}) {
  // Tint by the single chosen category; stay neutral for "All" or several,
  // where no one hue is honest.
  const meta = selectedTypes.length === 1 ? CATEGORIES[selectedTypes[0]] : null;
  const Icon = meta?.icon ?? SlidersHorizontal;
  const label =
    selectedTypes.length === 0
      ? "All vendors"
      : selectedTypes.length === 1
        ? meta!.label
        : `${selectedTypes.length} categories`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] shadow-sm transition-colors",
        meta
          ? "font-medium text-white"
          : selectedTypes.length > 0
            ? "border-foreground bg-foreground font-medium text-background"
            : "border-border bg-background/95 backdrop-blur",
        className,
      )}
      style={
        meta
          ? { backgroundColor: meta.colorHex, borderColor: meta.colorHex }
          : undefined
      }
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
      {activeCount > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px]",
            meta || selectedTypes.length > 0 ? "bg-white/25" : "bg-foreground/10",
          )}
        >
          {activeCount}
        </span>
      )}
      <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
    </button>
  );
}
