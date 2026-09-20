import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES, VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import {
  PRICE_ASSUMPTIONS,
  VENDOR_FILTERS,
} from "@/lib/constants/vendor-filters";
import {
  buildSelection,
  filterMatch,
  matchedFraction,
  type FilterSelection,
} from "@/lib/filters/match";
import { scoreVendorMatch } from "@/lib/search/vendors";
import { searchTokens } from "@/lib/search/tokens";
import { formatVendorLocality } from "@/lib/vendor-locality";
import { SITE_URL } from "@/lib/site";
import { connectorLocation, distanceMiles } from "./locations";
import type { ParsedConnectorSearch } from "./validation";
import {
  acquireBoundedPages,
  budgetAssessment,
  compareConnectorRanked,
  effectivePublicFilters,
} from "./rules";

const MAX_CANDIDATES = 5_000;
const SCAN_PAGE = 1_000;
const NAME_CANDIDATE_LIMIT = 500;
export const CONNECTOR_RANKING_VERSION = "connector-rank-v1";

export class ConnectorQueryError extends Error {
  readonly code: "upstream_unavailable" | "scope_too_broad";

  constructor(message: string, code: "upstream_unavailable" | "scope_too_broad") {
    super(message);
    this.code = code;
  }
}

export interface ConnectorCandidateRow {
  id: string;
  name: string;
  vendor_type: VendorType;
  address_text: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
  instagram: string | null;
  source: "google" | "user" | "seed";
  google_place_id: string | null;
  created_at: string;
  lng: number | null;
  lat: number | null;
  approximate: boolean;
  base_filters: Record<string, unknown> | null;
  filters_meta: Record<string, unknown> | null;
  filters_updated_at: string | null;
  filters_dirty_at: string | null;
  filter_overrides: Record<string, unknown> | null;
  verified: boolean;
  has_price: boolean;
  has_photo: boolean;
}

export interface ConnectorVendorCard {
  vendor_id: string;
  name: string;
  category: { id: VendorType; label: string };
  locality: string | null;
  distance_miles: number | null;
  location_precision: "precise" | "approximate" | "unknown";
  reported_pricing: ReturnType<typeof reportedPricing>;
  match_status: "full" | "partial";
  matched_criteria: string[];
  unknown_criteria: string[];
  match_reason: string;
  verified_vendor: boolean;
  urls: { canonical: string; visit: string };
}

export interface ConnectorSearchResult {
  queryInterpretation: Record<string, unknown>;
  results: ConnectorVendorCard[];
  allResults: ConnectorVendorCard[];
  snapshot: string;
  warnings: string[];
}

function effectiveFilters(row: ConnectorCandidateRow): Record<string, unknown> | null {
  return effectivePublicFilters(row);
}

function selectionFor(input: ParsedConnectorSearch): {
  selection: FilterSelection;
  assumptions: string[];
} {
  if (!input.category) return { selection: {}, assumptions: [] };
  const state = { ...input.filters };
  if (input.guestCount != null && input.category === "venue") {
    const current = (state.capacity_max as Record<string, number> | undefined) ?? {};
    state.capacity_max = { ...current, min: Math.max(current.min ?? 0, input.guestCount) };
  }
  if (input.budgetMax != null) {
    const current = (state.price as Record<string, unknown> | undefined) ?? {};
    const currentMax = typeof current.max === "number" ? current.max : input.budgetMax;
    state.price = { ...current, max: Math.min(currentMax, input.budgetMax) };
  }

  const priceState = state.price as { season?: string; day?: string } | undefined;
  const selection = buildSelection(VENDOR_FILTERS[input.category] ?? [], state, {
    season: priceState?.season,
    day: priceState?.day,
  });
  for (const definition of VENDOR_FILTERS[input.category] ?? []) {
    if (definition.kind === "bool" && state[definition.key] === false) {
      selection[definition.key] = { kind: "bool", value: false };
    }
  }
  const assumptions: string[] = [];
  const price = selection.price;
  if (price?.kind === "range") {
    if (input.category === "venue") {
      const guests = input.guestCount ?? PRICE_ASSUMPTIONS.guests;
      const hours = input.durationHours ?? PRICE_ASSUMPTIONS.hours;
      price.scale = { ...(price.scale ?? {}), per_person: guests, per_hour: hours };
      assumptions.push(
        input.guestCount == null
          ? `Per-person venue prices use the published website default of ${guests} guests.`
          : `Per-person venue prices are converted using ${guests} guests.`,
      );
      assumptions.push(
        input.durationHours == null
          ? `Per-hour venue prices use the published website default of ${hours} hours.`
          : `Per-hour venue prices are converted using ${hours} hours.`,
      );
    } else if (input.category === "food") {
      const guests = input.guestCount ?? PRICE_ASSUMPTIONS.guests;
      price.scale = { ...(price.scale ?? {}), package: 1 / guests };
      assumptions.push(
        input.guestCount == null
          ? `Catering package or minimum prices use the published website default of ${guests} guests.`
          : `Catering package or minimum prices are divided across ${guests} guests.`,
      );
    }
  }
  return { selection, assumptions };
}

function criterionLabels(
  category: VendorType,
  filters: Record<string, unknown> | null,
  selection: FilterSelection,
): { matched: string[]; unknown: string[] } {
  const definitions = new Map((VENDOR_FILTERS[category] ?? []).map((definition) => [definition.key, definition.label]));
  const matched: string[] = [];
  const unknown: string[] = [];
  Object.entries(selection).forEach(([key, spec]) => {
    const label = definitions.get(key) ?? key;
    const detail = filterMatch(filters, { [key]: spec });
    if (detail.rank === 1) matched.push(label);
    else if (detail.rank === 0) unknown.push(label);
  });
  return { matched, unknown };
}

function publicFilterMeta(row: ConnectorCandidateRow): Record<string, { source: string | null; attribute_processed_at: string | null }> {
  if (row.filters_dirty_at) return {};
  return Object.fromEntries(Object.entries(row.filters_meta ?? {}).map(([key, value]) => {
    const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return [key, {
      source: typeof record.source === "string" ? record.source : null,
      attribute_processed_at: typeof record.updated_at === "string" ? record.updated_at : null,
    }];
  }));
}

function reportedPricing(
  filters: Record<string, unknown> | null,
  row: ConnectorCandidateRow,
  budgetMax?: number,
) {
  if (!filters) return null;
  const min = typeof filters.price_min === "number" ? filters.price_min : null;
  const max = typeof filters.price_max === "number" ? filters.price_max : null;
  if (min == null && max == null) return null;
  const overrideKeys = row.filter_overrides ?? {};
  const meta = publicFilterMeta(row);
  const priceMeta = meta.price_min ?? meta.price_max ?? meta.price_kind;
  const vendorPublished = ["price_min", "price_max", "price_kind", "price_basis"].some(
    (key) => overrideKeys[key] !== undefined,
  );
  return {
    price_min: min,
    price_max: max,
    price_kind: typeof filters.price_kind === "string" ? filters.price_kind : null,
    price_basis: typeof filters.price_basis === "string" ? filters.price_basis : null,
    confidence: typeof filters.price_confidence === "string" ? filters.price_confidence : null,
    source: vendorPublished ? "vendor_published" : priceMeta?.source ?? null,
    attribute_processed_at: vendorPublished ? null : priceMeta?.attribute_processed_at ?? null,
    interpretation:
      filters.price_kind === "starting_at"
        ? "Starting price; this is a floor, not a promised total."
        : min != null && max != null
          ? "Reported range; a budget match means the ranges overlap."
          : "Single reported price point; confirm the total and inclusions.",
    budget_assessment: budgetAssessment(min, max, filters.price_kind, budgetMax),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function snapshotFor(rows: ConnectorCandidateRow[]): string {
  return createHash("sha256")
    .update(canonicalJson(rows.map((row) => ({
      ...row,
      base_filters: effectiveFilters(row),
      filters_meta: publicFilterMeta(row),
    }))))
    .digest("hex");
}

async function rpcCandidates(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ConnectorCandidateRow[]> {
  const { data, error } = await supabase.rpc("connector_vendor_candidates", args);
  if (error) throw new ConnectorQueryError("Vendor data is temporarily unavailable", "upstream_unavailable");
  return (data ?? []) as ConnectorCandidateRow[];
}

async function acquireCandidates(
  supabase: SupabaseClient,
  input: ParsedConnectorSearch,
): Promise<ConnectorCandidateRow[]> {
  if (input.q) {
    const { data, error } = await supabase.rpc("search_vendors", {
      q: input.q,
      max_rows: NAME_CANDIDATE_LIMIT + 1,
    });
    if (error) throw new ConnectorQueryError("Vendor search is temporarily unavailable", "upstream_unavailable");
    const matches = (data ?? []) as { id: string; vendor_type: string }[];
    if (matches.length > NAME_CANDIDATE_LIMIT) {
      throw new ConnectorQueryError("Name search is too broad; add a category or a more specific name", "scope_too_broad");
    }
    const ids = matches
      .filter((row) =>
        (VENDOR_TYPES as readonly string[]).includes(row.vendor_type) &&
        (!input.category || row.vendor_type === input.category),
      )
      .map((row) => row.id);
    if (ids.length === 0) return [];
    const rows: ConnectorCandidateRow[] = [];
    for (let start = 0; start < ids.length; start += SCAN_PAGE) {
      rows.push(...(await rpcCandidates(supabase, {
        p_vendor_type: input.category ?? null,
        p_after_id: null,
        p_ids: ids.slice(start, start + SCAN_PAGE),
        p_limit: SCAN_PAGE,
      })));
    }
    return rows;
  }

  const acquired = await acquireBoundedPages<ConnectorCandidateRow>(
    (after, pageSize) => rpcCandidates(supabase, {
      p_vendor_type: input.category,
      p_after_id: after?.id ?? null,
      p_ids: null,
      p_limit: pageSize,
    }),
    SCAN_PAGE,
    MAX_CANDIDATES,
  );
  if (acquired.exceeded) {
    throw new ConnectorQueryError("Search scope exceeds 5,000 candidates; narrow the request", "scope_too_broad");
  }
  return acquired.rows;
}

export async function searchConnectorVendors(
  supabase: SupabaseClient,
  input: ParsedConnectorSearch,
): Promise<ConnectorSearchResult> {
  const rows = await acquireCandidates(supabase, input);
  const snapshot = snapshotFor(rows);
  const location = connectorLocation(input.locationId);
  const { selection, assumptions } = selectionFor(input);
  let missingCoordinates = 0;

  const scored = rows.flatMap((row) => {
    const filters = effectiveFilters(row);
    const priced = !!filters && Object.entries(filters).some(
      ([key, value]) => key.includes("price") && typeof value === "number",
    );
    let distance: number | null = null;
    if (location) {
      if (row.lat == null || row.lng == null) {
        missingCoordinates++;
        return [];
      }
      distance = distanceMiles(location, { lat: row.lat, lng: row.lng });
      if (distance > (input.radiusMiles ?? 25)) return [];
    }

    const detail = filterMatch(filters, selection);
    if (detail.rank === -1) return [];
    const criteria = criterionLabels(row.vendor_type, filters, selection);
    const matched = matchedFraction(detail);
    const qScore = input.q ? scoreVendorMatch(row.name, input.q) : 0;
    const tokens = input.q ? searchTokens(input.q) : [];
    const haystack = `${row.name} ${row.address_text ?? ""} ${row.city ?? ""}`.toLowerCase();
    const fuzzy = tokens.length > 0 && !tokens.every((token) => haystack.includes(token));
    const path = `/vendor/${row.id}`;
    const visit = new URL(path, SITE_URL);
    visit.searchParams.set("utm_source", "muse");
    visit.searchParams.set("utm_medium", "connector");
    visit.searchParams.set("utm_campaign", "launch");

    const card: ConnectorVendorCard = {
      vendor_id: row.id,
      name: row.name,
      category: { id: row.vendor_type, label: CATEGORIES[row.vendor_type].label },
      locality: formatVendorLocality(row),
      distance_miles: distance == null ? null : Number(distance.toFixed(1)),
      location_precision: row.lat == null || row.lng == null ? "unknown" : row.approximate ? "approximate" : "precise",
      reported_pricing: reportedPricing(filters, row, input.budgetMax),
      match_status: detail.rank === 1 ? "full" : "partial",
      matched_criteria: criteria.matched,
      unknown_criteria: criteria.unknown,
      match_reason:
        detail.rank === 1
          ? criteria.matched.length
            ? `Recorded information matches ${criteria.matched.join(", ")}.`
            : "Matches the requested directory scope."
          : `Possible match, but recorded information is missing for ${criteria.unknown.join(", ")}.`,
      verified_vendor: row.verified,
      urls: { canonical: new URL(path, SITE_URL).toString(), visit: visit.toString() },
    };
    return [{
      row,
      card,
      rank: detail.rank,
      matched,
      qScore: fuzzy ? 12 : qScore || (input.q ? 25 : 0),
      priced,
      distance: distance ?? Number.POSITIVE_INFINITY,
    }];
  });

  scored.sort((a, b) => compareConnectorRanked(
    { id: a.row.id, rank: a.rank, verified: a.row.verified, matched: a.matched, qScore: a.qScore, priced: a.priced, photo: a.row.has_photo, distance: a.distance },
    { id: b.row.id, rank: b.rank, verified: b.row.verified, matched: b.matched, qScore: b.qScore, priced: b.priced, photo: b.row.has_photo, distance: b.distance },
  ));

  const warnings = [
    "Results describe recorded information and do not certify suitability, availability, or service coverage.",
    "A vendor based near a location is not confirmed to serve that location; ask about travel availability and fees.",
    "Paid verification may affect ordering within the same match tier; it is not an independent quality certification.",
    "Attribute processing timestamps are not quote dates; collection dates appear only on recon entries.",
    ...assumptions,
  ];
  if (missingCoordinates > 0) warnings.push(`${missingCoordinates} candidates without recorded coordinates were outside this geographic result scope.`);
  const priceContext = input.filters.price as { season?: string; day?: string } | undefined;
  if (priceContext?.season || priceContext?.day) {
    warnings.push("When no recorded price tier matches the requested season/day, matching falls back to the overall reported range; that fallback is not date-specific evidence.");
  }

  const allResults = scored.map((item) => item.card);
  return {
    queryInterpretation: {
      mode: input.q ? "name_lookup" : "discovery",
      q: input.q ?? null,
      category: input.category ?? null,
      location: location
        ? { id: location.id, label: location.label, center: { lat: location.lat, lng: location.lng }, radius_miles: input.radiusMiles, distance: "straight_line" }
        : null,
      budget: input.budgetMax != null ? { max: input.budgetMax, basis: input.budgetBasis, meaning: "reported_price_overlap" } : null,
      guest_count: input.guestCount ?? null,
      duration_hours: input.durationHours ?? null,
      filters: input.filters,
      assumptions,
    },
    results: allResults.slice(0, input.limit),
    allResults,
    snapshot,
    warnings,
  };
}

export function connectorSearchSelection(input: ParsedConnectorSearch): FilterSelection {
  return selectionFor(input).selection;
}

export function effectiveConnectorFilters(row: ConnectorCandidateRow): Record<string, unknown> | null {
  return effectiveFilters(row);
}

export function connectorSnapshot(rows: ConnectorCandidateRow[]): string {
  return snapshotFor(rows);
}
