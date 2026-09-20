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
  /** Vendor Verification badge — same predicate as the map and vendor page. */
  verified: boolean;
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

  // Which of these are verified vendors. Resolved HERE rather than by a second
  // client round trip, so the badge is present on first paint instead of
  // popping in under the user's cursor. One RPC over the <=6 ids already
  // matched; skipped entirely when nothing matched. Same SECURITY DEFINER set
  // function the map and the vendor page use (migration 0044), and the same
  // never-throw stance as searchVendors: an error (the RPC not yet applied)
  // reads as "nobody verified" and the bar behaves exactly as it does today.
  const verifiedIds = new Set<string>();
  if (matches.length > 0) {
    const { data } = await supabase.rpc("verified_vendor_ids", {
      p_ids: matches.map((v) => v.id),
    });
    for (const r of (data ?? []) as { vendor_id: string }[]) {
      verifiedIds.add(r.vendor_id);
    }
  }

  const results: VendorSearchSuggestion[] = matches.map((v) => ({
    vendorId: v.id,
    vendorType: v.vendorType,
    source: v.source,
    name: v.name,
    secondaryText: v.addressText ?? v.city ?? "",
    // requireCoords guarantees both are present.
    lng: v.lng as number,
    lat: v.lat as number,
    verified: verifiedIds.has(v.id),
  }));

  return NextResponse.json(results);
}
