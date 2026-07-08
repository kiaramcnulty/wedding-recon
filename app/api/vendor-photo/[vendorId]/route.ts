import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  getVendorGooglePhotos,
  refreshVendorGooglePhotos,
  isValidPhotoName,
  type VendorPhotoRow,
} from "@/lib/google-photos";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// One representative size for both the strip thumbnail (CSS-scaled) and the
// lightbox, so each photo is a single billed Google fetch, not two.
const MAX_W = 1200;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Per-IP cap on *function invocations*. CDN hits never reach here, so this only
// meters cache misses + abuse: ~100 first-view photo fetches/min per IP is far
// above human browsing and well below a scraper. Needs migration 0015.
const RATE_MAX = 100;
const RATE_WINDOW_S = 60;

/**
 * GET /api/vendor-photo/<vendorId>?i=<0..2>
 *   -> Streams the i-th Google Places photo for a vendor. Resolves the cached
 *      photo *reference* to bytes on demand (references are cached on the vendor
 *      row by lib/google-photos; bytes are never stored). Success responses are
 *      CDN-cached ~30 days; "no image" responses are short-cached so a rotated,
 *      throttled, or missing photo doesn't re-hit Google on every view.
 *
 * Not an open image proxy: it only serves references already stored on our own
 * vendor rows, indexed 0..2 — callers can't fetch arbitrary Google photos — and
 * it's rate-limited per IP to cap Google billing from unauthenticated abuse.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ vendorId: string }> },
) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return empty(404);

  const { vendorId } = await ctx.params;
  if (!UUID_RE.test(vendorId)) return empty(404);

  // Only `i` is read; reject non-integer / out-of-range instead of clamping, so
  // ?i=0.9 / ?i=99 don't resolve to a valid photo under a distinct cache key.
  const i = Number(req.nextUrl.searchParams.get("i") ?? "0");
  if (!Number.isInteger(i) || i < 0 || i > 2) return empty(404);

  // Throttle before any DB read or Google call, keyed on client IP.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!(await checkRateLimit(`vphoto:${ip}`, RATE_MAX, RATE_WINDOW_S))) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(RATE_WINDOW_S) },
    });
  }

  const admin = createServiceRoleClient();
  const { data: vendor, error } = await admin
    .from("vendors")
    .select("id, google_place_id, google_photos, google_photos_fetched_at")
    .eq("id", vendorId)
    .maybeSingle();
  if (error) {
    console.error("[vendor-photo] vendor read failed:", error.message);
    return empty(404, 60);
  }
  if (!vendor || !vendor.google_place_id) return empty(404);

  let photos = await getVendorGooglePhotos(vendor as VendorPhotoRow);
  let ref = photos[i];
  if (!ref) return empty(404);

  let result = await fetchPhotoBytes(ref.name, key);
  if (result === "rotated") {
    // Genuine rotation (Google 404/403 on the media name) — re-resolve once.
    photos = await refreshVendorGooglePhotos(vendor.id, vendor.google_place_id);
    ref = photos[i];
    result = ref ? await fetchPhotoBytes(ref.name, key) : "transient";
  }
  if (result === "rotated" || result === "transient") return empty(404, 60);

  return new Response(result.buf, {
    headers: {
      "Content-Type": result.contentType,
      // Browser 1d, shared/CDN 30d — matches the reference cache TTL so Google is
      // billed roughly once per photo per month regardless of view volume.
      "Cache-Control":
        "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
    },
  });
}

/** A "no image" response, short-cached so failures don't re-hit Google per view. */
function empty(status: number, cacheSeconds = 300) {
  return new Response(null, {
    status,
    headers: { "Cache-Control": `public, max-age=60, s-maxage=${cacheSeconds}` },
  });
}

// Returns bytes on success, or a reason: "rotated" (Google says the name is
// gone — worth re-resolving once) vs "transient" (rate-limit / 5xx / network /
// malformed — do NOT re-resolve, it won't help and would waste a Details call).
async function fetchPhotoBytes(
  name: string,
  key: string,
): Promise<{ buf: ArrayBuffer; contentType: string } | "rotated" | "transient"> {
  if (!isValidPhotoName(name)) return "transient";
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${MAX_W}`,
      { headers: { "X-Goog-Api-Key": key }, cache: "no-store" },
    );
    if (!res.ok) {
      return res.status === 404 || res.status === 403 ? "rotated" : "transient";
    }
    return {
      buf: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    };
  } catch {
    return "transient";
  }
}
