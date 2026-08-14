import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ALL_VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";

/**
 * GET /api/map/vendors?min_lng&min_lat&max_lng&max_lat&type&max_rows
 *
 * Edge-cacheable proxy for ONE vendor type's pins in a bounding box — the
 * per-type split the Explore map already does. Returns the raw `vendors_in_bbox`
 * rows, the same shape the browser used to get calling the RPC directly, so the
 * map is unchanged downstream.
 *
 * The point is the cache. The map fans a bbox query out to ~12 of these per
 * load, and a Reddit traffic spike on 2026-08-14 had every visitor's dozen calls
 * hit Postgres directly, exhausting the free-tier pool (503 storm). Snapping the
 * bbox to a shared grid client-side (lib/map/viewport.ts) makes near-identical
 * viewports resolve to one URL, and this route marks the response cacheable, so
 * the Vercel edge serves one copy to every visitor looking at the same area
 * instead of one DB query each.
 *
 * Two things keep it cacheable and must stay true:
 *   - it is EXCLUDED from the auth middleware (proxy.ts matcher), so no
 *     Set-Cookie ever lands on the response; and
 *   - it uses a plain anon client with NO cookies, so nothing varies per user.
 * The client also fetches it with `credentials: "omit"`. Anon RLS already allows
 * public vendor reads, so none of this loses data — same reasoning as
 * app/sitemap.ts.
 */

// Reads the bbox from the query, so it runs at request time; the RESPONSE is
// what gets cached, via the headers below — not Next's route cache.
export const dynamic = "force-dynamic";

// Never let a hand-crafted max_rows ask Postgres for more than the map needs.
// Mirrors MAX_ROWS_PER_TYPE (POSTGREST_MAX_ROWS - 1) on the client.
const MAX_ROWS_CEILING = 1000;

function bad(message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;

  const minLng = Number(sp.get("min_lng"));
  const minLat = Number(sp.get("min_lat"));
  const maxLng = Number(sp.get("max_lng"));
  const maxLat = Number(sp.get("max_lat"));
  if (![minLng, minLat, maxLng, maxLat].every((n) => Number.isFinite(n))) {
    return bad("bbox must be four finite numbers");
  }
  if (
    minLng < -180 ||
    maxLng > 180 ||
    minLat < -90 ||
    maxLat > 90 ||
    minLng >= maxLng ||
    minLat >= maxLat
  ) {
    return bad("bbox out of range");
  }

  const type = sp.get("type");
  if (!type || !(ALL_VENDOR_TYPES as readonly string[]).includes(type)) {
    return bad("unknown vendor type");
  }

  const requested = Math.trunc(Number(sp.get("max_rows")));
  const maxRows = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_ROWS_CEILING)
    : MAX_ROWS_CEILING;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.rpc("vendors_in_bbox", {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    p_types: [type as VendorType],
    max_rows: maxRows,
  });

  if (error) {
    // Surface upstream trouble as a transient 503 the client retries on, and
    // NEVER cache an error.
    return NextResponse.json(
      { error: error.message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(data ?? [], {
    headers: {
      // Browser holds nothing — vendor data changes, and the shared cache is
      // where the win is. Always revalidate against the edge.
      "Cache-Control": "public, max-age=0, must-revalidate",
      // Vercel edge (and any CDN honoring the standard): one cached copy for
      // 60s, then serve stale up to 5 more minutes while revalidating. This is
      // the layer that collapses a spike of identical viewports into ~1 DB
      // hit/min. On error above we send no-store instead, so failures never
      // stick in the cache.
      "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
