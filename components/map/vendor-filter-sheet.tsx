"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_PLURAL,
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

  // Thumb centres sit at bin centres, so a thumb lines up with the bar it selects.
  const pct = (i: number) => ((i + 0.5) / bins.length) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-0 h-full w-full appearance-none bg-transparent " +
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
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
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
          className={thumb}
        />
        <input
          type="range"
          aria-label={`${def.label} maximum`}
          min={0}
          max={last}
          value={hiIdx}
          onChange={(e) => emit(loIdx, Math.max(+e.target.value, loIdx))}
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
 * The filter groups for ONE vendor type. Split out so the sheet can stack a
 * section per selected type: filters are type-scoped, but that scopes which
 * filters apply to a vendor, not how many types you may filter at once.
 */
function TypeSection({
  vendorType,
  vendors,
  state,
  dateContext,
  onChange,
  onDateContextChange,
  collapsible,
  open,
  onToggleOpen,
}: {
  vendorType: VendorType;
  vendors: Vendor[];
  state: FilterState;
  dateContext: DateContext;
  onChange: (next: FilterState) => void;
  onDateContextChange: (next: DateContext) => void;
  collapsible: boolean;
  open: boolean;
  onToggleOpen: () => void;
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
    <div className="flex items-center gap-2">
      <meta.icon className="size-4 shrink-0" style={{ color: meta.colorHex }} />
      <h3 className="text-[14px] font-semibold capitalize">
        {CATEGORY_PLURAL[vendorType]}
      </h3>
      {activeCount > 0 && (
        <span
          className="rounded-full px-1.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: meta.colorHex }}
        >
          {activeCount}
        </span>
      )}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange({});
            onDateContextChange({});
          }}
          className="text-[12px] text-muted-foreground underline underline-offset-2"
        >
          Clear
        </button>
      )}
      {collapsible && (
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      )}
    </div>
  );

  const groups = (
    <div className="flex flex-col gap-5">
      {defs.map((def) => {
        const h = hist[def.lo ?? def.key];
        const isPriceWithDate =
          def.rescaledBy === "date_context" && vendorType === "venue";

        return (
          <section key={def.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <h4 className="text-[13px] font-semibold">{def.label}</h4>
              {def.rare && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Rare
                </span>
              )}
            </div>
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
              <div className={cn(def.rescaledBy && "rounded-xl border border-border p-3")}>
                {/* The rescale control lives INSIDE the price card so the two
                    read as one thing (Kiara, 2026-08-05). */}
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
                                dateContext.season === se.value ? undefined : se.value,
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
                              day: dateContext.day === d.value ? undefined : d.value,
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

                {def.unit === "usd" && vendorType === "venue" && def.key === "price" && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Venues quoting per person are shown at{" "}
                    {VENUE_PRICE_ASSUMPTIONS.guests} guests, per hour at{" "}
                    {VENUE_PRICE_ASSUMPTIONS.hours} hours.
                  </p>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );

  if (!collapsible) {
    return (
      <div>
        <div className="mb-3">{header}</div>
        {groups}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="w-full px-3 py-2.5 text-left"
      >
        {header}
      </button>
      {open && <div className="border-t border-border px-3 py-3">{groups}</div>}
    </div>
  );
}

export function VendorFilterSheet({
  vendorTypes,
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
  /** Every selected category. One section each. */
  vendorTypes: VendorType[];
  /**
   * Rows the map holds. Used ONLY to rescale histograms, never to count:
   * it spans the padded fetch box, which reaches well beyond the viewport.
   */
  vendors: Vendor[];
  /**
   * On-screen totals, straight from the map. The footer counts these rather
   * than counting `vendors` itself, so the sheet and the results pill can never
   * disagree - they are literally the same numbers. Counting the fetched rows
   * instead reported "55 matches" next to a pill saying "93 on screen".
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
  // With several categories chosen the sections collapse, so the sheet opens on
  // a scannable list of categories rather than a wall of every filter at once.
  // The first is open because with one category that IS the whole sheet.
  const [openType, setOpenType] = useState<VendorType | null>(
    vendorTypes[0] ?? null,
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

  const filterable = vendorTypes.filter((t) => filtersForType(t).length > 0);
  const multi = filterable.length > 1;
  const matched = Math.max(0, visibleTotal - visiblePartial);
  const totalActive = filterable.reduce(
    (n, t) => n + Object.keys(states[t] ?? {}).length,
    0,
  );

  const body = (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">Filters</h2>
          {totalActive > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[13px] text-muted-foreground underline underline-offset-2"
            >
              Clear all
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {filterable.map((t) => (
              <TypeSection
                key={t}
                vendorType={t}
                vendors={vendors}
                state={states[t] ?? {}}
                dateContext={dateContexts[t] ?? {}}
                onChange={(next) => onChangeType(t, next)}
                onDateContextChange={(next) => onDateContextChange(t, next)}
                collapsible={multi}
                open={!multi || openType === t}
                onToggleOpen={() => setOpenType(openType === t ? null : t)}
              />
            ))}
          </div>
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

export function FilterButton({
  vendorTypes,
  activeCount,
  onClick,
  className,
}: {
  vendorTypes: VendorType[];
  activeCount: number;
  onClick: () => void;
  className?: string;
}) {
  const filterable = vendorTypes.filter((t) => filtersForType(t).length > 0);
  // Nothing to filter until at least one category is chosen: with "All" showing
  // every type, a sheet of ten collapsed sections is a worse starting point than
  // asking which category you are shopping for. Hidden rather than disabled,
  // since a permanently dead control in a one-row bar reads as broken.
  if (filterable.length === 0) return null;

  // Tint by the single chosen category; stay neutral across several, where no
  // one hue is honest.
  const meta = filterable.length === 1 ? CATEGORIES[filterable[0]] : null;
  const on = activeCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={
        meta
          ? on
            ? { backgroundColor: meta.colorHex, borderColor: meta.colorHex }
            : { borderColor: `${meta.colorHex}59`, color: meta.textHex }
          : undefined
      }
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] shadow-sm transition-colors",
        on
          ? meta
            ? "font-medium text-white"
            : "border-foreground bg-foreground font-medium text-background"
          : "bg-background/95 backdrop-blur",
        !meta && !on && "border-border",
        className,
      )}
    >
      <SlidersHorizontal className="size-3.5" aria-hidden />
      Filters
      {on && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px]",
            meta ? "bg-white/25" : "bg-background/25",
          )}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}
