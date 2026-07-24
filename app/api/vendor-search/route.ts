import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
 * Lightweight name-match relevance (shared shape with /api/places) so results
 * rank by how closely the vendor name matches the query. Runs in-memory on a
 * handful of rows, so it's effectively free.
 */
function scoreMatch(name: string, query: string): number {
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

type VendorRow = {
  id: string;
  name: string;
  vendor_type: string;
  city: string | null;
  address_text: string | null;
  source: "google" | "user" | "seed";
  lng: number;
  lat: number;
};

/**
 * GET /api/vendor-search?q=<query>
 *   Vendor-only autocomplete for the Explore search bar: matches the community
 *   vendor directory by name, street address, or city so a couple can jump
 *   straight to a specific vendor (e.g. "Spruce Mountain Ranch") — the Explore
 *   bar flies the map to the returned pin. Google Places is deliberately NOT
 *   queried here (Explore searches *our* directory; area navigation stays with
 *   /api/geocode). Returns VendorSearchSuggestion[] ranked by name relevance.
 *
 *   Backed by the search_vendors RPC (migration 0018; token-aware since 0019),
 *   which returns coordinates flattened from the PostGIS geography. The RPC
 *   splits the query into tokens, drops stop words, and requires every token to
 *   appear in name/address/city, so "the sanctuary" resolves "Sanctuary Golf
 *   Course" (see lib/search/tokens.ts). If neither migration has been applied
 *   the RPC errors and this route degrades to no vendor results — the bar's
 *   Areas group is unaffected.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([] as VendorSearchSuggestion[]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_vendors", {
    q,
    max_rows: 24,
  });

  if (error || !data) {
    if (error) console.error("[vendor-search] rpc error", error.message);
    return NextResponse.json([] as VendorSearchSuggestion[]);
  }

  const results: VendorSearchSuggestion[] = (data as VendorRow[])
    .map((v) => {
      // Rank by name relevance; the RPC only returns rows that matched name,
      // address, or city, so a name score of 0 means it matched on address/city
      // — give it a modest floor so "type the address" still surfaces it.
      const nameScore = scoreMatch(v.name, q);
      const score = nameScore > 0 ? nameScore : 25;
      return {
        score,
        s: {
          vendorId: v.id,
          vendorType: v.vendor_type,
          source: v.source,
          name: v.name,
          secondaryText: v.address_text ?? v.city ?? "",
          lng: v.lng,
          lat: v.lat,
        } as VendorSearchSuggestion,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.s);

  return NextResponse.json(results);
}
