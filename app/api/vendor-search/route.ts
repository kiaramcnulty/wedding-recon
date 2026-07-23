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
};

/**
 * GET /api/vendor-search?q=<query>
 *   Vendor-only autocomplete for the Explore search bar: matches the community
 *   vendor directory by name, street address, or city so a couple can jump
 *   straight to a specific vendor (e.g. "Spruce Mountain Ranch") instead of only
 *   panning the map to an area. Google Places is deliberately NOT queried here —
 *   Explore searches *our* vendors; area navigation stays with /api/geocode.
 *   Returns VendorSearchSuggestion[] ranked by name relevance.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([] as VendorSearchSuggestion[]);

  const supabase = await createClient();
  // Escape LIKE metacharacters so a stray % or _ in the query isn't a wildcard.
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const cols = "id, name, vendor_type, city, address_text, source";

  // Three parallel ilike lookups (name / address / city) rather than one .or():
  // a .or() embeds the raw query into its filter string and would break on a
  // comma in a typed address ("123 Main St, Larkspur"). Merged + deduped below.
  const [byName, byAddr, byCity] = await Promise.all([
    supabase.from("vendors").select(cols).ilike("name", pattern).limit(8),
    supabase.from("vendors").select(cols).ilike("address_text", pattern).limit(8),
    supabase.from("vendors").select(cols).ilike("city", pattern).limit(8),
  ]);

  const addrOrCityIds = new Set<string>();
  const byId = new Map<string, VendorRow>();
  for (const row of (byName.data ?? []) as VendorRow[]) byId.set(row.id, row);
  for (const res of [byAddr, byCity]) {
    for (const row of (res.data ?? []) as VendorRow[]) {
      addrOrCityIds.add(row.id);
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }

  const results: VendorSearchSuggestion[] = [...byId.values()]
    .map((v) => {
      // Rank by name relevance; an address/city-only hit (name score 0) still
      // surfaces with a modest floor so "type the address" finds the vendor.
      const nameScore = scoreMatch(v.name, q);
      const score = nameScore > 0 ? nameScore : addrOrCityIds.has(v.id) ? 25 : 0;
      return {
        score,
        s: {
          vendorId: v.id,
          vendorType: v.vendor_type,
          source: v.source,
          name: v.name,
          secondaryText: v.address_text ?? v.city ?? "",
        } as VendorSearchSuggestion,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.s);

  return NextResponse.json(results);
}
