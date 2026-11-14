import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ALL_VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import { MAP_CACHE_TAG } from "@/lib/map/purge";

/**
 * GET /api/map/vendors?min_lng&min_lat&max_lng&max_lat&type&max_rows[&attrs=1]
 *
 * `attrs=1` also merges each vendor's EFFECTIVE filter attributes
 * (`vendor_filters_in_bbox`: evidence quotes stripped, verified overrides on
 * top) onto its row as `filters`. The guided search needs them for every
 * visitor's first result, which made them unsafe to keep fetching from the
 * browser uncached; riding on this route puts them behind the same edge cache.
 * Without the flag the response is unchanged, so the map's callers are too.
 *
 * Edge-cacheable proxy for ONE vendor type's pins in a bounding box — the
 * per-type split the Explore map already does. Returns the raw `vendors_in_bbox`
 * rows, the same shape the browser used to get calling the RPC directly, so the
 * map is unchanged downstream.
 *
 * The point is the cache (CPU as well as the DB pool: each miss is a billed
 * function invocation). The map fans a bbox query out to ~12 of these per
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

  // Number(null) is 0, NOT NaN — so reading a MISSING max_rows through
  // Number() made the "fall back to the ceiling" branch unreachable and
  // clamped the response to a single row instead. The map always sends the
  // param (vendor-map.tsx), so the app never saw it; every other caller got
  // one pin per type and no error. Read the raw param and branch on absence.
  const rawMaxRows = sp.get("max_rows");
  const requested = rawMaxRows === null ? NaN : Math.trunc(Number(rawMaxRows));
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

  const args = {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    p_types: [type as VendorType],
    max_rows: maxRows,
  };
  const withAttrs = sp.get("attrs") === "1";
  const [pins, attrs] = await Promise.all([
    supabase.rpc("vendors_in_bbox", args),
    withAttrs ? supabase.rpc("vendor_filters_in_bbox", args) : null,
  ]);
  const error = pins.error ?? attrs?.error;
  let data: Record<string, unknown>[] | null = pins.data;
  if (attrs && data) {
    // Vendors with no attributes at all are absent from the second RPC; they
    // come back with `filters: null`, which the matcher reads as silence.
    const byId = new Map<string, unknown>(
      (attrs.data ?? []).map((r: { id: string; filters: unknown }) => [r.id, r.filters]),
    );
    data = data.map((row) => ({ ...row, filters: byId.get(row.id as string) ?? null }));
  }

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
      // Vercel edge (and any CDN honoring the standard): one cached copy for an
      // hour, then served stale for up to one more hour while ONE background
      // request refreshes it -- so no visitor sees rows older than ~2 hours.
      // (The stale window was a day at first; cut to an hour 2026-11-14, Kiara:
      // after a quiet stretch the first visitor got day-old rows. The cost is
      // that a visitor after 2+ quiet hours waits for a fresh miss.) This is the layer that collapses a spike of identical
      // viewports into one DB hit, and -- the reason it is an hour, not the
      // original 60s -- the layer that keeps the map off the function CPU
      // bill: a map load is ~13 of these, and at 60s any two visitors more
      // than a minute apart each paid for all 13 (docs/notes/function-cpu.md).
      // The cost is that a
      // new vendor, a new verification or a new recon count can take up to an
      // hour to reach the map; the vendor page itself is always live. A new
      // deployment starts the cache over regardless. On error above we send
      // no-store instead, so failures never stick in the cache.
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
      // Lets a verification change drop every cached copy at once instead of
      // waiting out the hour (lib/map/purge.ts). Success responses only.
      "Vercel-Cache-Tag": MAP_CACHE_TAG,
    },
  });
}
