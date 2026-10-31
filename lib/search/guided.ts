import { usesServiceRegion, type VendorType } from "@/lib/constants/categories";
import {
  PRICE_ASSUMPTIONS,
  filtersForType,
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

/** The types the first slice of the journey supports. */
export const GUIDED_TYPES = ["venue", "photos"] as const satisfies readonly VendorType[];
export type GuidedType = (typeof GUIDED_TYPES)[number];

export function isGuidedType(t: unknown): t is GuidedType {
  return (GUIDED_TYPES as readonly unknown[]).includes(t);
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
  /** Ceiling in dollars, in the type's own unit (venue/photo package). */
  budget?: number;
  /** Venue `setting` or photographer `style` values. */
  styles?: string[];
}

export interface GuidedContext {
  guestCount?: number;
  weddingMonth?: number;
}

const STYLE_KEY: Record<GuidedType, string> = { venue: "setting", photos: "style" };

function positive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * The couple's answers as a matcher selection, built through the same
 * `buildSelection` the map's filter sheet uses so the two can never read a
 * budget differently. Two things the sheet cannot know are patched on:
 *
 *  - the venue per-person conversion uses the couple's REAL guest count, not
 *    the sheet's assumed 100. With no guest count the per-person basis is
 *    dropped from the scale, so those venues read as unknown (partial) rather
 *    than being judged at an invented headcount;
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
  const state: Record<string, unknown> = {};
  if (positive(prefs.budget)) state.price = { max: prefs.budget };
  if (prefs.styles?.length) state[STYLE_KEY[type]] = prefs.styles;
  if (type === "venue" && positive(ctx.guestCount)) {
    state.capacity_max = { min: Math.round(ctx.guestCount) };
  }
  const season = ctx.weddingMonth ? seasonForMonth(ctx.weddingMonth) : undefined;
  const sel = buildSelection(filtersForType(type), state, season ? { season } : {});

  const price = sel.price as Extract<FilterSpec, { kind: "range" }> | undefined;
  if (type === "venue" && price) {
    const scale: Record<string, number> = { per_hour: PRICE_ASSUMPTIONS.hours };
    if (positive(ctx.guestCount)) scale.per_person = Math.round(ctx.guestCount);
    sel.price = { ...price, scale };
  }
  return sel;
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
    const detail = filterMatchFor(type, c.filters, { [type]: selection });
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
