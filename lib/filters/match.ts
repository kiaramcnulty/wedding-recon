import type { FilterDef } from "@/lib/constants/vendor-filters";

/**
 * Attribute matching for the Explore filters. **This is the only
 * implementation** — matching is entirely client-side.
 *
 * There is no SQL twin to keep in step, despite what an older comment here
 * claimed: `vendor_filter_rank` was never shipped, and `vendors_in_bbox` takes
 * no `p_filters`. Migration `0033` sets out why the RPC sends attributes rather
 * than matching on them — the map caches a fetched area and skips refetching
 * while panning inside it, so a filter-specific row set would strand stale pins
 * on screen.
 *
 * `scripts/test-filter-match.mjs` runs this over the real 2,163-vendor dataset
 * and is the only executable check on the rules. Run it after any change here.
 *
 * **The one rule everything else follows: silence NEVER excludes.** A vendor is
 * only ruled out by positively contradicting a filter. Missing data means
 * nobody wrote the fact down, so it demotes the vendor into the list view's
 * partial tier — under its own divider, graded by how much of the ask it did
 * meet — where the couple can still see it and judge for themselves.
 */

/** One selected filter, built from the UI state by `buildSelection`. */
export type FilterSpec =
  | { kind: "multi"; values: string[] }
  | { kind: "bool"; value: boolean }
  | {
      kind: "range";
      mode: "point" | "overlap";
      lo: string;
      hi?: string;
      min?: number;
      max?: number;
      basis?: string;
      season?: string;
      day?: string;
    };

export type FilterSelection = Record<string, FilterSpec>;
export type VendorFilters = Record<string, unknown> | null | undefined;

/**
 * One selection per vendor type, applied only to vendors OF that type.
 *
 * Attribute filters are type-scoped — a venue has no cuisine — but that scopes
 * which filters apply to a vendor, it does not mean only one type can be
 * filtered at a time. A couple shops for a venue and a photographer in the same
 * session, so "mountain venues AND documentary photographers" has to be one
 * query. A type with no entry here is unfiltered and every vendor of it ranks 1.
 */
export type FilterSelections = Partial<Record<string, FilterSelection>>;

/**
 * A rank plus the arithmetic behind it: how many of the active filters the
 * vendor was SILENT on, and how many were active at all.
 *
 * `filterRank` collapses this to the three-way verdict, which is all the pin
 * dimming and the divider need. The list view needs the counts too, so it can
 * order the partial tier by how much of the couple's ask a vendor actually met.
 */
export interface FilterMatchDetail {
  rank: -1 | 0 | 1;
  /** Filters this vendor says nothing about. Always 0 when `rank` is 1. */
  unknown: number;
  /** Filters active for this vendor's type. 0 means the type is unfiltered. */
  active: number;
}

/**
 * The share of the active filters a vendor actually matched, 0..1.
 *
 * Deliberately a FRACTION rather than a count of misses, because a mixed-type
 * search is one query: a venue judged on 3 attributes and a photographer judged
 * on 2 are not comparable by "missing 1" (that is 67% against 50%), and the
 * feed interleaves both. With a single type filtered — the common case — the
 * two orderings are identical, since every vendor shares the same denominator.
 *
 * An unfiltered type scores 1: nothing was asked, so nothing is missing.
 */
export function matchedFraction(detail: FilterMatchDetail): number {
  return detail.active === 0
    ? 1
    : (detail.active - detail.unknown) / detail.active;
}

/** Rank a vendor against its OWN type's filters. */
export function filterRankFor(
  vendorType: string,
  filters: VendorFilters,
  selections: FilterSelections | undefined,
): -1 | 0 | 1 {
  return filterMatchFor(vendorType, filters, selections).rank;
}

/** As `filterRankFor`, but keeping the counts behind the verdict. */
export function filterMatchFor(
  vendorType: string,
  filters: VendorFilters,
  selections: FilterSelections | undefined,
): FilterMatchDetail {
  const sel = selections?.[vendorType];
  if (!sel || Object.keys(sel).length === 0) {
    return { rank: 1, unknown: 0, active: 0 };
  }
  return filterMatch(filters, sel);
}

/** Whether any type carries a filter at all — lets callers skip the work. */
export function hasAnySelection(selections: FilterSelections | undefined): boolean {
  if (!selections) return false;
  return Object.values(selections).some((s) => s && Object.keys(s).length > 0);
}

/** Total number of active filters across every type, for the trigger badge. */
export function countSelections(selections: FilterSelections | undefined): number {
  if (!selections) return 0;
  return Object.values(selections).reduce(
    (n, s) => n + (s ? Object.keys(s).length : 0),
    0,
  );
}

/** Matches the SQL sentinel; far above any real wedding price. */
const OPEN_HI = 1_000_000_000;

/**
 * -1 excluded (positively contradicts), 0 partial (silent on something),
 * 1 full match. Silence demotes rather than excludes — coverage is low mostly
 * because nobody wrote the fact down, not because the vendor lacks the thing.
 * There is no exception to that: see the module header.
 */
export function filterRank(
  filters: VendorFilters,
  selection: FilterSelection,
): -1 | 0 | 1 {
  return filterMatch(filters, selection).rank;
}

/**
 * As `filterRank`, but counting the silences instead of collapsing them to a
 * flag. `unknown` rises by at most 1 per filter — every branch that notices a
 * silence also ends that filter's turn — so it can never exceed `active`.
 */
export function filterMatch(
  filters: VendorFilters,
  selection: FilterSelection,
): FilterMatchDetail {
  const keys = Object.keys(selection);
  const active = keys.length;
  if (active === 0) return { rank: 1, unknown: 0, active: 0 };
  // No attributes at all: silent on every one of them. Bottom of the partial
  // tier, since it met none of the ask, but still visible.
  if (!filters) return { rank: 0, unknown: active, active };

  let unknown = 0;

  for (const key of keys) {
    const spec = selection[key];

    if (spec.kind === "multi") {
      const v = filters[key];
      if (!Array.isArray(v) || v.length === 0) {
        unknown++;
      } else if (!v.some((x) => spec.values.includes(String(x)))) {
        return { rank: -1, unknown, active };
      }
      continue;
    }

    if (spec.kind === "bool") {
      const v = filters[key];
      if (typeof v !== "boolean") {
        unknown++;
      } else if (v !== spec.value) {
        return { rank: -1, unknown, active };
      }
      continue;
    }

    // range
    const basis = filters["price_basis"];
    if (spec.basis && typeof basis === "string" && basis !== spec.basis) {
      // Another unit is not comparable, so it reads as silence, not a miss.
      unknown++;
      continue;
    }

    let lo = num(filters[spec.lo]);
    let hi = num(filters[spec.hi ?? spec.lo]);

    if ((spec.season || spec.day) && Array.isArray(filters["price_tiers"])) {
      const tiers = (filters["price_tiers"] as Array<Record<string, unknown>>).filter(
        (t) =>
          (!spec.season || t.season == null || t.season === spec.season) &&
          (!spec.day || t.day_type == null || t.day_type === spec.day) &&
          (t.min != null || t.max != null),
      );
      if (tiers.length) {
        const mins = tiers.map((t) => num(t.min)).filter(isNum);
        const maxs = tiers.map((t) => num(t.max)).filter(isNum);
        const tLo = mins.length ? Math.min(...mins) : undefined;
        const tHi = maxs.length ? Math.max(...maxs) : undefined;
        if (tLo !== undefined || tHi !== undefined) {
          lo = tLo ?? tHi;
          hi = tHi ?? tLo;
        }
      }
    }

    if (lo === undefined && hi === undefined) {
      unknown++;
      continue;
    }

    const vLo = (lo ?? hi) as number;
    let vHi = hi;
    if (vHi === undefined) {
      // "starting at 5000" is a floor, not an exact figure: reading it as
      // exactly 5000 would wrongly drop it from any search above that.
      vHi =
        filters["price_kind"] === "starting_at" && spec.mode === "overlap"
          ? OPEN_HI
          : vLo;
    }

    if (spec.mode === "point") {
      if ((spec.min != null && vLo < spec.min) || (spec.max != null && vLo > spec.max)) {
        return { rank: -1, unknown, active };
      }
    } else if (
      (spec.max != null && vLo > spec.max) ||
      (spec.min != null && vHi < spec.min)
    ) {
      return { rank: -1, unknown, active };
    }
  }

  return { rank: unknown ? 0 : 1, unknown, active };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function isNum(v: number | undefined): v is number {
  return v !== undefined;
}

/** Build the RPC argument from the UI state plus the type config. */
export function buildSelection(
  defs: FilterDef[],
  state: Record<string, unknown>,
  dateContext?: { season?: string; day?: string },
): FilterSelection {
  const out: FilterSelection = {};
  for (const d of defs) {
    const v = state[d.key];
    if (v == null) continue;

    if (d.kind === "multi" && Array.isArray(v) && v.length) {
      out[d.key] = { kind: "multi", values: v as string[] };
    } else if (d.kind === "bool" && v === true) {
      out[d.key] = { kind: "bool", value: true };
    } else if (d.kind === "range" && typeof v === "object") {
      const r = v as { min?: number; max?: number };
      if (r.min == null && r.max == null) continue;
      out[d.key] = {
        kind: "range",
        mode: d.mode ?? "overlap",
        lo: d.lo ?? d.key,
        ...(d.hi && { hi: d.hi }),
        ...(r.min != null && { min: r.min }),
        ...(r.max != null && { max: r.max }),
        ...(d.basis && { basis: d.basis }),
        ...(d.rescaledBy === "date_context" && dateContext?.season && { season: dateContext.season }),
        ...(d.rescaledBy === "date_context" && dateContext?.day && { day: dateContext.day }),
      };
    }
  }
  return out;
}
