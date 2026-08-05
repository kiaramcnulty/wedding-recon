"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, SlidersHorizontal } from "lucide-react";
import { CATEGORY_PLURAL, type VendorType } from "@/lib/constants/categories";
import {
  filtersForType,
  SEASONS,
  DAY_TYPES,
  VENUE_PRICE_ASSUMPTIONS,
  type FilterDef,
} from "@/lib/constants/vendor-filters";
import { filterRank, buildSelection } from "@/lib/filters/match";
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

function ChipGroup({
  def,
  value,
  onChange,
}: {
  def: FilterDef;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {def.options?.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- histogram */

/**
 * Bin-indexed dual slider. The handles select a bin RANGE; the value handed
 * back is the bin edge, so the numbers shown are always real observed values.
 */
function RangeControl({
  def,
  hist,
  value,
  onChange,
  scaled,
}: {
  def: FilterDef;
  hist: Hist;
  value: { min?: number; max?: number } | undefined;
  onChange: (next: { min?: number; max?: number } | undefined) => void;
  /** Bin counts under the current companion selection, for the rescale. */
  scaled?: number[];
}) {
  const bins = hist.bins;
  const counts = scaled ?? bins.map((b) => b.n);
  const peak = Math.max(1, ...counts);

  const loIdx = value?.min == null ? 0 : Math.max(0, bins.findIndex((b) => b.hi > value.min!));
  const hiIdxRaw = value?.max == null ? bins.length - 1 : bins.findIndex((b) => b.hi >= value.max!);
  const hiIdx = hiIdxRaw < 0 ? bins.length - 1 : hiIdxRaw;

  const emit = (lo: number, hi: number) => {
    const full = lo === 0 && hi === bins.length - 1;
    onChange(full ? undefined : { min: bins[lo].lo, max: bins[hi].hi });
  };

  return (
    <div>
      <div className="flex h-14 items-end gap-[3px]" aria-hidden>
        {counts.map((n, i) => {
          const inRange = i >= loIdx && i <= hiIdx;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-t-[2px] transition-all",
                inRange ? "bg-foreground/70" : "bg-foreground/15",
              )}
              style={{ height: `${Math.max(3, (n / peak) * 100)}%` }}
            />
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="text-[11px] text-muted-foreground">
          Min
          <input
            type="range"
            min={0}
            max={bins.length - 1}
            value={loIdx}
            onChange={(e) => emit(Math.min(+e.target.value, hiIdx), hiIdx)}
            className="mt-0.5 w-full accent-foreground"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Max
          <input
            type="range"
            min={0}
            max={bins.length - 1}
            value={hiIdx}
            onChange={(e) => emit(loIdx, Math.max(+e.target.value, loIdx))}
            className="mt-0.5 w-full accent-foreground"
          />
        </label>
      </div>

      <p className="mt-1 text-[13px] font-medium">
        {fmt(def, bins[loIdx].lo)} – {fmt(def, bins[hiIdx].hi)}
        {hiIdx === bins.length - 1 && def.unit === "usd" ? "+" : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- sheet */

export function VendorFilterSheet({
  vendorType,
  vendors,
  state,
  dateContext,
  onChange,
  onDateContextChange,
  onClose,
}: {
  vendorType: VendorType;
  /** Rows currently in view, for the live "N match" count. */
  vendors: Vendor[];
  state: FilterState;
  dateContext: DateContext;
  onChange: (next: FilterState) => void;
  onDateContextChange: (next: DateContext) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
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

  const defs = filtersForType(vendorType);
  const hist = HIST[vendorType] ?? {};
  const pool = useMemo(
    () => vendors.filter((v) => v.vendor_type === vendorType),
    [vendors, vendorType],
  );

  const selection = useMemo(
    () => buildSelection(defs, state, dateContext),
    [defs, state, dateContext],
  );

  const { matched, partial } = useMemo(() => {
    let m = 0, p = 0;
    for (const v of pool) {
      const r = filterRank(v.filters, selection);
      if (r === 1) m++;
      else if (r === 0) p++;
    }
    return { matched: m, partial: p };
  }, [pool, selection]);

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
   * $8k+ tail is almost entirely full planning).
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

  const activeCount = Object.keys(state).length;

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
          <h2 className="text-[15px] font-semibold">
            Filter {CATEGORY_PLURAL[vendorType]}
          </h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange({});
                onDateContextChange({});
              }}
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
          <div className="flex flex-col gap-5">
            {defs.map((def) => {
              const h = hist[def.lo ?? def.key];
              const isPriceWithDate =
                def.rescaledBy === "date_context" && vendorType === "venue";

              return (
                <section key={def.key}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h3 className="text-[13px] font-semibold">{def.label}</h3>
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
                      value={(state[def.key] as string[]) ?? []}
                      onChange={(v) => set(def.key, v)}
                    />
                  )}

                  {def.kind === "bool" && (
                    <button
                      type="button"
                      aria-pressed={state[def.key] === true}
                      onClick={() => set(def.key, state[def.key] === true ? null : true)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                        state[def.key] === true
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      {def.label}
                    </button>
                  )}

                  {def.kind === "range" && h && (
                    <div
                      className={cn(
                        def.rescaledBy && "rounded-xl border border-border p-3",
                      )}
                    >
                      {/* The rescale control lives INSIDE the price card so the
                          two read as one thing (Kiara, 2026-08-05). */}
                      {isPriceWithDate && (
                        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
                          <div className="flex flex-wrap gap-1.5">
                            {SEASONS.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                aria-pressed={dateContext.season === s.value}
                                onClick={() =>
                                  onDateContextChange({
                                    ...dateContext,
                                    season: dateContext.season === s.value ? undefined : s.value,
                                  })
                                }
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[12px]",
                                  dateContext.season === s.value
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border hover:bg-muted",
                                )}
                              >
                                {s.label} · {s.months}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {DAY_TYPES.map((d) => (
                              <button
                                key={d.value}
                                type="button"
                                aria-pressed={dateContext.day === d.value}
                                onClick={() =>
                                  onDateContextChange({
                                    ...dateContext,
                                    day: dateContext.day === d.value ? undefined : d.value,
                                  })
                                }
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[12px]",
                                  dateContext.day === d.value
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border hover:bg-muted",
                                )}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <RangeControl
                        def={def}
                        hist={h}
                        value={state[def.key] as { min?: number; max?: number }}
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
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-foreground py-3 text-[14px] font-semibold text-background"
          >
            Show {matched} {matched === 1 ? "match" : "matches"}
            {partial > 0 && (
              <span className="font-normal opacity-70"> · {partial} with info missing</span>
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
  vendorType,
  activeCount,
  onClick,
}: {
  vendorType: VendorType | null;
  activeCount: number;
  onClick: () => void;
}) {
  const enabled = vendorType != null && filtersForType(vendorType).length > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      title={enabled ? undefined : "Pick one category to filter it"}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
        activeCount > 0
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background",
        !enabled && "opacity-40",
      )}
    >
      <SlidersHorizontal className="size-3.5" />
      Filters
      {activeCount > 0 && (
        <span className="rounded-full bg-background/25 px-1.5 text-[11px]">
          {activeCount}
        </span>
      )}
    </button>
  );
}
