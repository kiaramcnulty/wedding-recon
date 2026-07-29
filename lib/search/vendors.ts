import type { SupabaseClient } from "@supabase/supabase-js";
import { searchTokens } from "./tokens";

/**
 * Shared vendor search — the ONE implementation behind both search surfaces:
 *
 *   - Explore bar   → `/api/vendor-search` (vendors group, flies to the pin)
 *   - Add Recon box → `/api/places`        (existing vendors, blended w/ Google)
 *
 * The two used to match differently: Explore went through the `search_vendors`
 * RPC (token-AND over name + address + city) while Add Recon built its own
 * per-token `ilike` chain over **name only** — and each route carried its own
 * copy of the relevance scorer. Same bug fixed twice, two places to drift.
 *
 * Matching now lives in exactly two coupled places: the `search_vendors` RPC
 * (SQL, migration `0024`) and this module (query guard + ranking). Change the
 * rule here or there and both bars move together; per-surface presentation
 * (which fields render, how many rows, whether Google is blended in) stays in
 * the routes.
 */

/** Shortest query worth a lookup — 1 character matches half the directory. */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/**
 * Score for a row that matched on address/city but not on name. The RPC only
 * returns rows that matched *something*, so a name score of 0 means the hit
 * came from the address or city — worth surfacing (typing an address should
 * find the vendor), but below every real name match.
 */
const ADDRESS_MATCH_SCORE = 25;

/** Rows to ask the RPC for before ranking. Ranking then trims to `limit`. */
const DEFAULT_MAX_ROWS = 24;

/** A vendor row that matched the query, with its relevance score. */
export interface VendorMatch {
  id: string;
  name: string;
  vendorType: string;
  city: string | null;
  addressText: string | null;
  googlePlaceId: string | null;
  source: "google" | "user" | "seed";
  /** Pin coordinates (flattened from PostGIS); null when the row has no location. */
  lng: number | null;
  lat: number | null;
  /** Name-match relevance, 0–100. See `scoreVendorMatch`. */
  score: number;
}

/** The `search_vendors` RPC row shape (migration `0024`). */
interface SearchVendorsRow {
  id: string;
  name: string;
  vendor_type: string;
  address_text: string | null;
  city: string | null;
  google_place_id: string | null;
  source: "google" | "user" | "seed";
  lng: number | null;
  lat: number | null;
}

export interface SearchVendorsOptions {
  /** Max rows returned after ranking. */
  limit?: number;
  /** Rows to fetch before ranking (raises recall for broad queries). */
  maxRows?: number;
  /** Drop rows with no coordinates (Explore needs a pin to fly to). */
  requireCoords?: boolean;
}

/**
 * Lightweight name-match relevance. Source-agnostic on purpose: Google
 * predictions expose no numeric score, so scoring their display name with the
 * same function is what lets `/api/places` blend both sources into one list.
 * Runs in-memory on a couple dozen candidates, so it's effectively free.
 */
export function scoreVendorMatch(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}`).test(n)) return 60;
  if (n.includes(q)) return 40;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const matched = tokens.filter((t) => n.includes(t)).length;
  return (matched / tokens.length) * 30;
}

/**
 * Search the vendor directory by name, street address, or city.
 *
 * Backed by the `search_vendors` RPC (migrations `0018` → `0019` token-aware →
 * `0024` shared shape), which splits the query into tokens, drops stop words,
 * and requires every remaining token to appear in name/address/city — so "the
 * sanctuary" resolves "Sanctuary Golf Course" (`lib/search/tokens.ts` mirrors
 * the stop-word list).
 *
 * Never throws: a missing or erroring RPC (e.g. a migration not yet hand-applied)
 * logs and returns no matches, so the calling surface degrades to its other
 * result groups rather than failing the request.
 */
export async function searchVendors(
  supabase: SupabaseClient,
  query: string,
  options: SearchVendorsOptions = {},
): Promise<VendorMatch[]> {
  const { limit = 6, maxRows = DEFAULT_MAX_ROWS, requireCoords = false } = options;
  const q = query.trim();
  if (q.length < MIN_SEARCH_QUERY_LENGTH) return [];
  // Only punctuation/wildcards typed → the RPC would match everything, so skip
  // the round trip entirely.
  if (searchTokens(q).length === 0) return [];

  const { data, error } = await supabase.rpc("search_vendors", {
    q,
    max_rows: maxRows,
  });

  if (error || !data) {
    if (error) console.error("[search] search_vendors rpc error", error.message);
    return [];
  }

  return (data as SearchVendorsRow[])
    .filter((v) => !requireCoords || (v.lng != null && v.lat != null))
    .map((v) => {
      const nameScore = scoreVendorMatch(v.name, q);
      return {
        id: v.id,
        name: v.name,
        vendorType: v.vendor_type,
        city: v.city,
        addressText: v.address_text,
        // `undefined` (not null) means the pre-0024 RPC is still installed —
        // normalize so callers only ever see a handle or null.
        googlePlaceId: v.google_place_id ?? null,
        source: v.source,
        lng: v.lng ?? null,
        lat: v.lat ?? null,
        score: nameScore > 0 ? nameScore : ADDRESS_MATCH_SCORE,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
