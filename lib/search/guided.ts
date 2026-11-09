import { VENDOR_TYPES, usesServiceRegion, type VendorType } from "@/lib/constants/categories";
import {
  DAY_TYPES,
  PRICE_ASSUMPTIONS,
  filtersForType,
  type FilterDef,
} from "@/lib/constants/vendor-filters";
import {
  buildSelection,
  filterMatchFor,
  type FilterSelection,
  type FilterSpec,
  type VendorFilters,
} from "@/lib/filters/match";
import { compareRanked, type RankedVendor } from "@/lib/map/rank";
import type { ViewportBbox } from "@/lib/map/viewport";

/**
 * The guided search: matching + radius + ranking for the first-visit journey
 * (`/start`). Pure functions only, so `scripts/test-guided-search.mjs` can run
 * them without a map, a network or React.
 *
 * Everything below is an ADAPTER onto the existing rules, never a second copy
 * of them. Verdicts come from `filterMatchFor` (lib/filters/match.ts) and order
 * from `compareRanked` (lib/map/rank.ts). What is new is only what the map has
 * no notion of: a search anchor that is not the camera, a radius ladder, and
 * banded distance. See docs/customer-journey-implementation-plan.md.
 */

/**
 * Every selectable vendor type is in the journey. What differs per type is
 * only which questions it asks (`GUIDED_CONTROLS`, below); a type with none
 * goes straight from the type grid to its results.
 */
export const GUIDED_TYPES = VENDOR_TYPES;
export type GuidedType = (typeof GUIDED_TYPES)[number];

export function isGuidedType(t: unknown): t is GuidedType {
  return (GUIDED_TYPES as readonly unknown[]).includes(t);
}

/**
 * The questions each type asks, in screen order: an optional budget, the
 * venue capacity check on the shared guest count, multi-select chip groups and "must have"
 * checkboxes. Every key is an existing filter in lib/constants/vendor-filters.ts
 * and every answer is optional: empty means no filter, an unticked box means
 * "don't care", never "must not have".
 *
 * This is the "Default controls per category" table in
 * docs/customer-journey-implementation-plan.md. Everything else a type can be
 * filtered on belongs under Advanced, which the journey does not have yet.
 */
export interface GuidedControls {
  budget?: {
    /** The range filter the budget fills. */
    key: string;
    label: string;
    placeholder: string;
    /** Pill text for the couple's answer: "Up to $75/guest". */
    pill: (amount: string) => string;
  };
  /**
   * Judge on the shared guest count (venue capacity). The count itself is
   * asked once, on the location step, not on this type's screen.
   */
  guests?: boolean;
  /** Multi-select filters, by key. The label defaults to the filter's own. */
  picks: readonly { key: string; label?: string }[];
  /** Bool filters shown as one checkbox each, by key. */
  flags: readonly { key: string; label?: string }[];
}

const upTo = (a: string) => `Up to ${a}`;

export const GUIDED_CONTROLS: Record<GuidedType, GuidedControls> = {
  venue: {
    budget: { key: "price", label: "Venue budget", placeholder: "8,000", pill: upTo },
    guests: true,
    picks: [{ key: "setting" }],
    flags: [],
  },
  food: {
    budget: { key: "price", label: "Budget per guest", placeholder: "75", pill: (a) => `Up to ${a}/guest` },
    picks: [{ key: "cuisine" }, { key: "service_style" }],
    flags: [],
  },
  dj: {
    budget: { key: "price", label: "DJ budget", placeholder: "1,500", pill: upTo },
    picks: [],
    flags: [{ key: "includes_mc" }],
  },
  band: {
    budget: { key: "price", label: "Music budget", placeholder: "2,500", pill: upTo },
    picks: [{ key: "genre" }],
    flags: [],
  },
  flowers: {
    budget: { key: "price", label: "Flower budget", placeholder: "3,000", pill: upTo },
    picks: [{ key: "style" }, { key: "engagement_model", label: "Full service or à la carte" }],
    flags: [],
  },
  dress: {
    budget: { key: "price", label: "Dress budget", placeholder: "2,000", pill: upTo },
    picks: [],
    flags: [{ key: "in_house_alterations" }],
  },
  beauty: {
    budget: {
      key: "bride_price",
      label: "Bride's hair & makeup budget",
      placeholder: "350",
      pill: (a) => `Bride up to ${a}`,
    },
    picks: [{ key: "work_mode" }],
    flags: [],
  },
  hotel: { picks: [], flags: [] },
  planner: {
    budget: { key: "price", label: "Planner budget", placeholder: "3,000", pill: upTo },
    picks: [{ key: "service_tier" }],
    flags: [],
  },
  photos: {
    budget: { key: "price", label: "Photography budget", placeholder: "4,000", pill: upTo },
    picks: [{ key: "style" }],
    flags: [],
  },
  other: { picks: [], flags: [] },
};

/** Whether a type has a questions screen at all (hotel blocks and Other do not). */
export function hasGuidedQuestions(t: GuidedType): boolean {
  const c = GUIDED_CONTROLS[t];
  return !!c.budget || c.picks.length > 0 || c.flags.length > 0;
}

/** Confirmed matches needed before the automatic radius stops widening. */
export const MIN_CONFIRMED = 5;
/** Cards on the suggestions screen. */
export const SUGGESTION_COUNT = 3;
/**
 * Distance is ranked in bands of this many miles, not exact miles. A vendor
 * whose pin sits on a city centroid would otherwise measure 0.0 miles from a
 * search anchored on that same city and outrank every vendor whose real street
 * address we know, purely because we know LESS about where it is.
 */
export const DISTANCE_BAND_MILES = 10;

/**
 * The automatic radius steps, in miles. Fixed-location types (a venue, a dress
 * shop) are where the couple goes, so 50 miles is already a long way. Every
 * other type travels to the wedding and its pin is only a home base: from a
 * Vail venue the nearest Denver photographers are 74 miles away.
 */
export function radiusLadder(t: VendorType): readonly number[] {
  return usesServiceRegion(t) ? [25, 50, 100, 150] : [25, 50];
}

/** Top of the slider for a type: the last ladder step. */
export function maxRadius(t: VendorType): number {
  const l = radiusLadder(t);
  return l[l.length - 1];
}

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle (straight-line) distance in miles. Not driving distance. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A lat/lng box that contains every point within `miles` of `center`. Slightly
 * generous (a box around a circle), which is the safe direction: the exact
 * distance check runs afterwards on every row.
 */
export function envelopeFor(center: LatLng, miles: number): ViewportBbox {
  const dLat = miles / 69;
  const cos = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  const dLng = miles / (69 * cos);
  return {
    minLng: Math.max(-180, center.lng - dLng),
    minLat: Math.max(-90, center.lat - dLat),
    maxLng: Math.min(180, center.lng + dLng),
    maxLat: Math.min(90, center.lat + dLat),
  };
}

/** Month (1-12) onto the SEASONS vocabulary in lib/constants/vendor-filters.ts. */
export function seasonForMonth(month: number): "peak" | "shoulder" | "off" | undefined {
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  if (month >= 5 && month <= 10) return "peak";
  if (month === 4 || month === 11) return "shoulder";
  return "off";
}

/** What the couple answered on the preferences screen, per type. */
export interface GuidedPrefs {
  /** Ceiling in dollars, in the type's own unit (see `GUIDED_CONTROLS`). */
  budget?: number;
  /**
   * Multi-select answers by filter key: venue `setting`, caterer `cuisine`...
   * Any multi filter of the type, the default controls and Advanced alike.
   */
  picks?: Record<string, string[]>;
  /** Ticked "must have" boxes by filter key. Only `true` is ever stored. */
  flags?: Record<string, true>;
  /**
   * Advanced "up to" limits on the type's other range filters, by key: the
   * per-bridesmaid price, a photographer's delivery weeks. A ceiling only,
   * like the budget.
   */
  limits?: Record<string, number>;
  /** Venue price day of week (Advanced), on the `DAY_TYPES` vocabulary. */
  day?: string;
}

export interface GuidedContext {
  guestCount?: number;
  weddingMonth?: number;
  /**
   * With no guest count, convert venue per-person and caterer package prices
   * at the assumed 100 (`PRICE_ASSUMPTIONS.guests`) instead of reading them as
   * unknown. Explore does (Kiara, 2026-11-06); the journey does not, since it
   * asks for the real number.
   */
  assumeGuests?: boolean;
}

/**
 * The filters a type offers under Advanced: everything it can be filtered on
 * that is not one of its default controls. Two are left out because a default
 * control already covers them: venue capacity (the shared guest count) and
 * florist minimum spend (folded into the flower budget).
 */
export function advancedDefs(type: GuidedType): FilterDef[] {
  const c = GUIDED_CONTROLS[type];
  const shown = new Set<string>([
    ...(c.budget ? [c.budget.key] : []),
    ...c.picks.map((p) => p.key),
    ...c.flags.map((f) => f.key),
    "capacity_max",
    ...(type === "flowers" ? ["minimum_spend"] : []),
  ]);
  return filtersForType(type).filter((d) => !shown.has(d.key));
}

/** Whether a venue price can be judged by day of week (Advanced). */
export function asksDay(type: GuidedType): boolean {
  return filtersForType(type).some((d) => d.rescaledBy === "date_context");
}

/** How many Advanced answers are set, for the "More · n" chip. */
export function advancedCount(type: GuidedType, prefs: GuidedPrefs): number {
  let n = 0;
  for (const d of advancedDefs(type)) {
    if (d.kind === "multi" && prefs.picks?.[d.key]?.length) n++;
    else if (d.kind === "bool" && prefs.flags?.[d.key]) n++;
    else if (d.kind === "range" && positive(prefs.limits?.[d.key])) n++;
  }
  if (asksDay(type) && prefs.day) n++;
  return n;
}

function positive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Florist structure: ticking both Full service and A la carte means either,
 * exactly like ticking neither, so neither restricts the search. Kept as a
 * multi filter it would only demote the 50 florists who never said which.
 */
const EITHER_MEANS_ANY: Record<string, number> = { engagement_model: 2 };

/**
 * The couple's answers as a matcher selection, built through the same
 * `buildSelection` the map's filter sheet uses so the two can never read a
 * budget differently. What the sheet cannot know is patched on:
 *
 *  - venue: the per-person conversion uses the couple's REAL guest count, not
 *    the sheet's assumed 100. With no guest count the per-person basis is
 *    dropped from the scale, so those venues read as unknown (partial) rather
 *    than being judged at an invented headcount;
 *  - caterers: the mirror image. A package or minimum is divided across the
 *    real guest count when the couple gave one (on the location step), and is
 *    otherwise unknown, since the caterer screen does not ask (requirement 6);
 *  - florists: the budget is judged against a comparable floor, not the raw
 *    price (see `floralFloor`);
 *  - a wedding month picks the season tier.
 *
 * A budget is a ceiling: a vendor matches when its starting price is at or
 * below it (`overlap` with only `max` set), so $5,000 fits a $5,000 budget.
 */
export function guidedSelection(
  type: GuidedType,
  prefs: GuidedPrefs,
  ctx: GuidedContext = {},
): FilterSelection {
  const controls = GUIDED_CONTROLS[type];
  const defs = filtersForType(type);
  const budgetKey = controls.budget?.key;
  const state: Record<string, unknown> = {};
  if (budgetKey && positive(prefs.budget)) state[budgetKey] = { max: prefs.budget };
  // Every multi / bool / range filter of the type, default and Advanced: one
  // adapter for the journey's questions and Explore's chips and sheets.
  for (const d of defs) {
    if (d.kind === "multi") {
      const v = prefs.picks?.[d.key];
      if (!v?.length) continue;
      if (EITHER_MEANS_ANY[d.key] && new Set(v).size >= EITHER_MEANS_ANY[d.key]) continue;
      state[d.key] = v;
    } else if (d.kind === "bool") {
      if (prefs.flags?.[d.key] === true) state[d.key] = true;
    } else if (d.key !== budgetKey && d.key !== "capacity_max") {
      const max = prefs.limits?.[d.key];
      if (positive(max)) state[d.key] = { max };
    }
  }
  if (controls.guests && positive(ctx.guestCount)) {
    state.capacity_max = { min: Math.round(ctx.guestCount) };
  }
  // Planner tiers scope the budget (`priceScopedBy`), so they must reach
  // buildSelection alongside it, which they do: they are a pick above.
  const season = ctx.weddingMonth ? seasonForMonth(ctx.weddingMonth) : undefined;
  const day = prefs.day && DAY_TYPES.some((d) => d.value === prefs.day) ? prefs.day : undefined;
  const sel = buildSelection(defs, state, { ...(season && { season }), ...(day && { day }) });

  const guests = positive(ctx.guestCount)
    ? Math.round(ctx.guestCount)
    : ctx.assumeGuests
      ? PRICE_ASSUMPTIONS.guests
      : undefined;
  const price = sel.price as Extract<FilterSpec, { kind: "range" }> | undefined;
  if (type === "venue" && price) {
    const scale: Record<string, number> = { per_hour: PRICE_ASSUMPTIONS.hours };
    if (guests) scale.per_person = guests;
    sel.price = { ...price, scale };
  }
  if (type === "food" && price) {
    const scale: Record<string, number> = {};
    if (guests) scale.package = 1 / guests;
    sel.price = { ...price, scale };
  }
  if (type === "flowers" && price?.max != null) {
    // A point check on a derived floor; `comparableFilters` writes the field.
    sel.price = { kind: "range", mode: "point", lo: FLORAL_FLOOR, max: price.max };
  }
  return sel;
}

/**
 * The transient field the florist budget is judged on. Never stored: it is
 * written onto a copy of the vendor's filters for the comparison only.
 */
export const FLORAL_FLOOR = "guided_floral_floor";

function amount(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * The lowest total a florist's wedding flowers can cost, when the data can say
 * it, judged against the couple's total flower budget. Requirement 9 and the
 * Milestone 2 "first release" rule in the implementation plan:
 *
 *  - the floor is the larger of the starting price and the minimum spend (a
 *    $500 starting price under a $3,000 minimum costs $3,000);
 *  - a price counts only when its scope is plain, i.e. the florist works ONE
 *    way (full service only, or a la carte only). A florist doing both lists
 *    one flattened price that is very often a single bouquet ($27.50, $175),
 *    which says nothing about a whole wedding. That price can still rule the
 *    florist OUT when even it is over budget, but never in;
 *  - a per-person or per-item price is not a total, and a $0 minimum does not
 *    prove anything is free: both are silence.
 *
 * Returns the floor to compare, or undefined for silence (partial).
 */
export function floralFloor(filters: VendorFilters, budget: number): number | undefined {
  if (!filters) return undefined;
  const basis = filters.price_basis;
  const price = basis == null || basis === "package" ? amount(filters.price_min) ?? amount(filters.price_max) : undefined;
  const minimum = amount(filters.minimum_spend);
  const floors = [price, minimum].filter((x): x is number => x !== undefined);
  if (!floors.length) return undefined;
  const floor = Math.max(...floors);
  const models = Array.isArray(filters.engagement_model) ? new Set(filters.engagement_model.map(String)) : new Set();
  if (models.size === 1) return floor;
  return floor > budget ? floor : undefined;
}

/**
 * The vendor's filters as the guided selection compares them: the stored
 * attributes, plus any transient comparison field the selection reads.
 */
export function comparableFilters(
  type: string,
  filters: VendorFilters,
  selection: FilterSelection,
): VendorFilters {
  const price = selection.price;
  if (type !== "flowers" || price?.kind !== "range" || price.lo !== FLORAL_FLOOR || price.max == null) {
    return filters;
  }
  const floor = floralFloor(filters, price.max);
  return { ...(filters ?? {}), [FLORAL_FLOOR]: floor };
}

/** One row from `/api/map/vendors?attrs=1`. */
export interface GuidedCandidate {
  id: string;
  vendor_type: string;
  lat: number;
  lng: number;
  approximate?: boolean | null;
  has_price?: boolean | null;
  has_photo?: boolean | null;
  verified?: boolean | null;
  filters: VendorFilters;
}

export interface GuidedRow {
  id: string;
  rank: 0 | 1;
  miles: number;
  approximate: boolean;
  verified: boolean;
}

export interface GuidedResult {
  /** Full matches first, then partials; excluded vendors are absent. */
  ranked: GuidedRow[];
  confirmedCount: number;
  partialCount: number;
  radiusMiles: number;
  /** The automatic radius widened past the first step. */
  expanded: boolean;
}

export type RadiusSetting = { mode: "auto" } | { mode: "manual"; miles: number };

/**
 * Match, pick the radius, rank. The radius is chosen on CONFIRMED matches
 * only, before the three-card cap: a ladder step is accepted as soon as it
 * holds `MIN_CONFIRMED`, else the top step is used. A manual radius is
 * honoured as given and never widened.
 */
export function runGuidedSearch(
  candidates: readonly GuidedCandidate[],
  type: GuidedType,
  selection: FilterSelection,
  anchor: LatLng,
  radius: RadiusSetting,
): GuidedResult {
  const scored: (GuidedRow & { ranked: RankedVendor })[] = [];
  for (const c of candidates) {
    if (c.vendor_type !== type) continue;
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const detail = filterMatchFor(type, comparableFilters(type, c.filters, selection), { [type]: selection });
    if (detail.rank === -1) continue;
    const miles = milesBetween(anchor, c);
    const rank = detail.rank;
    scored.push({
      id: c.id,
      rank,
      miles,
      approximate: c.approximate === true,
      verified: c.verified === true,
      ranked: {
        id: c.id,
        vendorType: type,
        rank,
        verified: c.verified === true,
        matched: detail.active === 0 ? 1 : (detail.active - detail.unknown) / detail.active,
        priced: c.has_price === true,
        photo: c.has_photo === true,
        d: Math.floor(miles / DISTANCE_BAND_MILES),
      },
    });
  }

  const confirmedWithin = (r: number) =>
    scored.filter((s) => s.rank === 1 && s.miles <= r).length;

  const ladder = radiusLadder(type);
  let radiusMiles: number;
  if (radius.mode === "manual") {
    radiusMiles = radius.miles;
  } else {
    radiusMiles = ladder.find((r) => confirmedWithin(r) >= MIN_CONFIRMED) ?? ladder[ladder.length - 1];
  }

  const inside = scored
    .filter((s) => s.miles <= radiusMiles)
    .sort((a, b) => compareRanked(a.ranked, b.ranked) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const ranked = inside.map(({ id, rank, miles, approximate, verified }) => ({
    id,
    rank,
    miles,
    approximate,
    verified,
  }));
  const confirmedCount = ranked.filter((r) => r.rank === 1).length;
  return {
    ranked,
    confirmedCount,
    partialCount: ranked.length - confirmedCount,
    radiusMiles,
    expanded: radius.mode === "auto" && radiusMiles > ladder[0],
  };
}

/** The suggestions: the first few CONFIRMED rows of the ranked set. */
export function suggestionsOf(result: GuidedResult): GuidedRow[] {
  return result.ranked.filter((r) => r.rank === 1).slice(0, SUGGESTION_COUNT);
}

/**
 * The best PARTIAL matches, shown under the suggestions (below a "Partial
 * matches" divider) when there are fewer confirmed matches than suggestion
 * slots: enough to bring the screen to `SUGGESTION_COUNT` cards. Never mixed
 * into the suggestions themselves, which are confirmed matches only.
 */
export function partialFillOf(result: GuidedResult): GuidedRow[] {
  const open = SUGGESTION_COUNT - Math.min(result.confirmedCount, SUGGESTION_COUNT);
  return open > 0 ? result.ranked.filter((r) => r.rank === 0).slice(0, open) : [];
}
