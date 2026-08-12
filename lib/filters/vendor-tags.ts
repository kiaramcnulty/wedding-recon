import {
  filtersForType,
  type FilterDef,
} from "@/lib/constants/vendor-filters";
import type { VendorType } from "@/lib/constants/categories";
import type { FilterSelection, VendorFilters } from "@/lib/filters/match";

/**
 * Human-readable "filter tags" for a vendor — the same attributes the Explore
 * filter sheet is built from (`lib/constants/vendor-filters.ts`), rendered as
 * pills on preview cards and the vendor page.
 *
 * **This is the single source of truth for the pills.** The presentational
 * component (`components/vendor/vendor-tags.tsx`) only lays out what this
 * returns; the ordering, wording and unit handling all live here so the map
 * preview cards, the Planning Hub cards and the vendor detail page can never
 * disagree about what a vendor "is".
 *
 * Three rules, straight out of the rest of the filter system:
 *
 * 1. **Positive facts only.** A `bool` becomes a pill only when it is literally
 *    `true`. A stored `false` ("not size inclusive") is rare, and a stored
 *    *absence* is the common case — the two are indistinguishable to a reader,
 *    so rendering a negative would assert something we cannot back. Same line
 *    the matcher draws with "silence never excludes".
 *
 * 2. **Ranges keep their unit.** A price pill reads in the vendor's OWN basis —
 *    `$8k–$12k` for a package, `$100/person`, `$500/hour` — because
 *    `filters.price_basis` is populated on 99.6% of priced rows. Capacity is a
 *    single ceiling in the data (`Up to 200 guests`, not a low–high), so it is
 *    rendered as such rather than inventing a floor.
 *
 * 3. **Order is: user-applied filters first, then importance.** Importance is
 *    the declaration order in `VENDOR_FILTERS` (already hand-curated — it is the
 *    order the filter sheet renders), with `rare` facets pushed last. A pill
 *    that matches an active filter floats ahead of everything else; for a
 *    `multi` facet that is per-value (filter "Mountain" → the Mountain pill
 *    leads that venue's other setting pills). Surfaces with no active
 *    selection (the Hub, the vendor page) just get the importance order.
 */

export interface VendorTag {
  /** Stable react key. For `multi` it is `"<facet>:<value>"`, else the facet key. */
  key: string;
  /** The pill text. */
  label: string;
  /** True when this tag satisfies one of the couple's active filters. */
  matched: boolean;
}

/** A vendor's own price basis → the suffix its pill carries. `package` is a
 * total, so it gets none. Anything unlisted falls back to no suffix. */
const BASIS_SUFFIX: Record<string, string> = {
  package: "",
  per_person: "/person",
  per_hour: "/hour",
  per_night: "/night",
  per_gown: "/gown",
  per_item: "/item",
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** `$8k`, `$8.5k`, `$150` — abbreviated only once it reaches the thousands, so
 * a per-person or per-hour figure stays legible ($100/person, not $0.1k). */
function fmtUsd(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `$${Number.isInteger(k) ? k : Number(k.toFixed(1))}k`;
  }
  return `$${Math.round(n)}`;
}

/** A usd low–high, collapsing to a single figure when the ends coincide or one
 * end is missing. */
function usdRange(loRaw: unknown, hiRaw: unknown): string | null {
  const lo = num(loRaw);
  const hi = num(hiRaw);
  const a = lo ?? hi;
  const b = hi ?? lo;
  if (a === undefined || b === undefined) return null;
  return a === b ? fmtUsd(a) : `${fmtUsd(a)}–${fmtUsd(b)}`;
}

/** The headline price of the main `price` facet, in the vendor's own basis. */
function formatPrice(filters: Record<string, unknown>): string | null {
  let lo = num(filters.price_min);
  let hi = num(filters.price_max);

  // Fall back to the seasonal/day tier table when there is no flat headline —
  // some venues publish only tiers. Min of the mins, max of the maxs.
  if (lo === undefined && hi === undefined && Array.isArray(filters.price_tiers)) {
    const tiers = filters.price_tiers as Array<Record<string, unknown>>;
    const mins = tiers.map((t) => num(t.min)).filter((x): x is number => x !== undefined);
    const maxs = tiers.map((t) => num(t.max)).filter((x): x is number => x !== undefined);
    if (mins.length) lo = Math.min(...mins);
    if (maxs.length) hi = Math.max(...maxs);
  }

  const a = lo ?? hi;
  const b = hi ?? lo;
  if (a === undefined || b === undefined) return null;

  const basis = typeof filters.price_basis === "string" ? filters.price_basis : "package";
  const suffix = BASIS_SUFFIX[basis] ?? "";

  if (filters.price_kind === "starting_at") return `From ${fmtUsd(a)}${suffix}`;
  if (filters.price_kind === "single_figure" || a === b) return `${fmtUsd(a)}${suffix}`;
  return `${fmtUsd(a)}–${fmtUsd(b)}${suffix}`;
}

/** Format a `range` facet into pill text, or null when the vendor is silent. */
function formatRange(def: FilterDef, filters: Record<string, unknown>): string | null {
  switch (def.key) {
    case "price":
      return formatPrice(filters);
    case "bride_price": {
      const r = usdRange(filters.bride_price_min, filters.bride_price_max);
      return r && `Bride ${r}`;
    }
    case "party_price": {
      const r = usdRange(filters.party_price_min, filters.party_price_max);
      return r && `Bridesmaid ${r}`;
    }
    case "minimum_spend": {
      const v = num(filters.minimum_spend);
      return v === undefined ? null : `${fmtUsd(v)} minimum`;
    }
    case "capacity_max": {
      const v = num(filters.capacity_max);
      // Stored as a single ceiling — there is no floor in the data to show.
      return v === undefined ? null : `Up to ${v} guests`;
    }
    case "turnaround_weeks": {
      const v = num(filters.turnaround_weeks);
      return v === undefined ? null : `~${v} wk delivery`;
    }
    default: {
      // Generic usd range for any future range facet.
      if (def.unit === "usd") return usdRange(filters[def.lo ?? def.key], filters[def.hi ?? def.lo ?? def.key]);
      return null;
    }
  }
}

/**
 * Build the ordered pill list for one vendor. `selection` is the couple's
 * active filters for THIS vendor's type (undefined on surfaces with no filter,
 * e.g. the Hub and the vendor page), and only decides ordering — it never adds
 * or removes a pill.
 */
export function vendorTags(
  vendorType: string,
  filters: VendorFilters,
  selection?: FilterSelection,
): VendorTag[] {
  if (!filters) return [];
  const defs = filtersForType(vendorType as VendorType);

  // Pushed in importance order already (declaration order, options in their own
  // declaration order), so the array index doubles as the importance rank below.
  const built: Array<VendorTag & { rare: boolean }> = [];

  for (const def of defs) {
    const rare = !!def.rare;

    if (def.kind === "multi") {
      const raw = filters[def.key];
      if (!Array.isArray(raw)) continue;
      const present = new Set(raw.map(String));
      const sel = selection?.[def.key];
      const selValues = sel?.kind === "multi" ? new Set(sel.values) : null;
      for (const opt of def.options ?? []) {
        if (!present.has(opt.value)) continue;
        built.push({
          key: `${def.key}:${opt.value}`,
          label: opt.label,
          matched: !!selValues?.has(opt.value),
          rare,
        });
      }
      continue;
    }

    if (def.kind === "bool") {
      // Positive facts only — see rule 1 in the module header.
      if (filters[def.key] !== true) continue;
      built.push({
        key: def.key,
        label: def.label,
        matched: !!selection?.[def.key],
        rare,
      });
      continue;
    }

    // range
    const label = formatRange(def, filters);
    if (!label) continue;
    built.push({
      key: def.key,
      label,
      matched: !!selection?.[def.key],
      rare,
    });
  }

  // Stable sort: user-applied first, then rare last, then importance (index).
  return built
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      if (a.t.matched !== b.t.matched) return a.t.matched ? -1 : 1;
      if (a.t.rare !== b.t.rare) return a.t.rare ? 1 : -1;
      return a.i - b.i;
    })
    .map(({ t }) => ({ key: t.key, label: t.label, matched: t.matched }));
}
