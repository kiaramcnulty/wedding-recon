import type { FilterDef } from "@/lib/constants/vendor-filters";

/**
 * Client-side twin of the `vendor_filter_rank` SQL function (migration 0033).
 *
 * The map filters server-side — it has to, because `vendors_in_bbox` caps a
 * fetch and would otherwise filter an arbitrary sample. This module exists for
 * the surfaces that never touch that RPC (the Hub) and as the executable
 * specification the SQL is tested against: `scripts/test-filter-match.mjs` runs
 * this over the real dataset, so a semantic change here that is not mirrored in
 * the migration shows up as a diff in the counts.
 *
 * **Keep the two in lockstep.** If you change a rule here, change 0033.
 */

/** Wire format sent as the RPC `p_filters` argument. */
export type FilterSpec =
  | { kind: "multi"; values: string[]; rare?: boolean }
  | { kind: "bool"; value: boolean; rare?: boolean }
  | {
      kind: "range";
      mode: "point" | "overlap";
      lo: string;
      hi?: string;
      min?: number;
      max?: number;
      basis?: string;
      rare?: boolean;
      season?: string;
      day?: string;
    };

export type FilterSelection = Record<string, FilterSpec>;
export type VendorFilters = Record<string, unknown> | null | undefined;

/** Matches the SQL sentinel; far above any real wedding price. */
const OPEN_HI = 1_000_000_000;

/**
 * -1 excluded (positively contradicts), 0 partial (silent on something),
 * 1 full match. Silence demotes rather than excludes — coverage is low mostly
 * because nobody wrote the fact down, not because the vendor lacks the thing.
 * A `rare` filter inverts that: there, silence really does mean no.
 */
export function filterRank(
  filters: VendorFilters,
  selection: FilterSelection,
): -1 | 0 | 1 {
  const keys = Object.keys(selection);
  if (keys.length === 0) return 1;
  if (!filters) {
    return keys.some((k) => selection[k].rare) ? -1 : 0;
  }

  let unknown = false;

  for (const key of keys) {
    const spec = selection[key];

    if (spec.kind === "multi") {
      const v = filters[key];
      if (!Array.isArray(v) || v.length === 0) {
        if (spec.rare) return -1;
        unknown = true;
      } else if (!v.some((x) => spec.values.includes(String(x)))) {
        return -1;
      }
      continue;
    }

    if (spec.kind === "bool") {
      const v = filters[key];
      if (typeof v !== "boolean") {
        if (spec.rare) return -1;
        unknown = true;
      } else if (v !== spec.value) {
        return -1;
      }
      continue;
    }

    // range
    const basis = filters["price_basis"];
    if (spec.basis && typeof basis === "string" && basis !== spec.basis) {
      // Another unit is not comparable, so it reads as silence, not a miss.
      unknown = true;
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
      if (spec.rare) return -1;
      unknown = true;
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
        return -1;
      }
    } else if (
      (spec.max != null && vLo > spec.max) ||
      (spec.min != null && vHi < spec.min)
    ) {
      return -1;
    }
  }

  return unknown ? 0 : 1;
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
      out[d.key] = { kind: "multi", values: v as string[], ...(d.rare && { rare: true }) };
    } else if (d.kind === "bool" && v === true) {
      out[d.key] = { kind: "bool", value: true, ...(d.rare && { rare: true }) };
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
