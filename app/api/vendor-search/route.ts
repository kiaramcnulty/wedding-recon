import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MIN_SEARCH_QUERY_LENGTH, searchVendors } from "@/lib/search/vendors";

export const dynamic = "force-dynamic";

export interface VendorSearchSuggestion {
  vendorId: string;
  vendorType: string;
  source: "google" | "user" | "seed";
  name: string;
  /** Address (preferred) or city — the line rendered under the vendor name. */
  secondaryText: string;
  /** Pin coordinates, so the Explore bar can fly the map straight to it. */
  lng: number;
  lat: number;
}

/**
 * GET /api/vendor-search?q=<query>
 *   Vendor-only autocomplete for the Explore search bar: matches the community
 *   vendor directory by name, street address, or city so a couple can jump
 *   straight to a specific vendor (e.g. "Spruce Mountain Ranch") — the Explore
 *   bar flies the map to the returned pin. Google Places is deliberately NOT
 *   queried here (Explore searches *our* directory; area navigation stays with
 *   /api/geocode). Returns VendorSearchSuggestion[] ranked by name relevance.
 *
 *   Matching + ranking live in `lib/search/vendors.ts` (over the `search_vendors`
 *   RPC), shared with the Add Recon box so both bars behave identically;
 *   `requireCoords` is this surface's one extra rule — a vendor with no location
 *   has no pin to fly to. If the RPC's migrations haven't been applied the
 *   helper returns no matches and the bar's Areas group is unaffected.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < MIN_SEARCH_QUERY_LENGTH) {
    return NextResponse.json([] as VendorSearchSuggestion[]);
  }

  const supabase = await createClient();
  const matches = await searchVendors(supabase, q, {
    limit: 6,
    requireCoords: true,
  });

  const results: VendorSearchSuggestion[] = matches.map((v) => ({
    vendorId: v.id,
    vendorType: v.vendorType,
    source: v.source,
    name: v.name,
    secondaryText: v.addressText ?? v.city ?? "",
    // requireCoords guarantees both are present.
    lng: v.lng as number,
    lat: v.lat as number,
  }));

  return NextResponse.json(results);
}
