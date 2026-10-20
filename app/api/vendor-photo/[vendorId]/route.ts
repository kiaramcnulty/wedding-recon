import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  getVendorGooglePhotos,
  refreshVendorGooglePhotos,
  isValidPhotoName,
  type VendorPhotoRow,
} from "@/lib/google-photos";
import { checkRateLimit } from "@/lib/rate-limit";

// Keep vendor reads and rate limits dynamic while allowing the media fetch to
// opt into Next's persistent Data Cache. Do not use force-no-store here.
export const revalidate = 0;

/**
 * Allowlisted render widths, picked to match the surfaces that use them:
 *   300  — legacy card URLs
 *   600  — cards and the vendor-page photo strip
 *  1200  — the full-screen lightbox
 *
 * An allowlist rather than a free-form number so the CDN cache-key space stays
 * small and a caller cannot mint unlimited distinct (billed) Google fetches.
 * Defaults to 1200, so a caller that omits `w` behaves exactly as before.
 *
 * Each width is a separate billed fetch on a cache miss. The CDN freshness
 * lifetime is 90 days. A second, upstream Data Cache survives deployments, so
 * a new deployment's CDN miss can reuse bytes without another Google call.
 * Regional caches, size limits, and eviction still prevent a billing ceiling.
 */
const WIDTHS: readonly number[] = [300, 600, 1200];
const DEFAULT_W = 1200;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Per-IP cap on *function invocations*. CDN hits never reach here, so this only
// meters cache misses + abuse: ~100 first-view photo fetches/min per IP is far
// above human browsing and well below a scraper. Needs migration 0015.
const RATE_MAX = 100;
const RATE_WINDOW_S = 60;

/**
 * GET /api/vendor-photo/<vendorId>?i=<0..1>&w=<300|600|1200>
 *   -> Streams the i-th Google Places photo for a vendor. Resolves the cached
 *      photo *reference* to bytes on demand (references are cached on the vendor
 *      row by lib/google-photos; bytes use Next's persistent Data Cache).
 *      Success responses are CDN-cached up to 90 days;
 *      "no image" responses are short-cached so a rotated,
 *      throttled, or missing photo doesn't re-hit Google on every view.
 *
 * Not an open image proxy: it only serves references already stored on our own
 * vendor rows, indexed 0..1 — callers can't fetch arbitrary Google photos — and
 * it's rate-limited per IP to slow unauthenticated abuse.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ vendorId: string }> },
) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return empty(404);

  const { vendorId } = await ctx.params;
  if (!UUID_RE.test(vendorId)) return empty(404);

  // Ambiguous duplicate parameters must never reach Google.
  if (
    req.nextUrl.searchParams.getAll("i").length > 1 ||
    req.nextUrl.searchParams.getAll("w").length > 1
  ) return empty(404);

  // Only `i` is read; reject non-integer / out-of-range instead of clamping, so
  // ?i=0.9 / ?i=99 don't resolve to a valid photo under a distinct cache key.
  const i = Number(req.nextUrl.searchParams.get("i") ?? "0");
  if (!Number.isInteger(i) || i < 0 || i > 1) return empty(404);

  // Same reasoning as `i`: reject anything off the allowlist rather than
  // clamping, so a junk width can't alias onto a valid photo's cache entry.
  const rawW = req.nextUrl.searchParams.get("w");
  const w = rawW === null ? DEFAULT_W : Number(rawW);
  if (!WIDTHS.includes(w)) return empty(404);

  // Vercel keys dynamic responses by the entire URL. Collapse extra params,
  // parameter order, omitted defaults, numeric aliases, and UUID casing onto
  // one URL BEFORE rate-limit/DB/upstream calls. Only that URL serves bytes.
  const canonical = `/api/vendor-photo/${vendorId.toLowerCase()}?i=${i}&w=${w}`;
  if (`${req.nextUrl.pathname}${req.nextUrl.search}` !== canonical) {
    return new Response(null, {
      status: 308,
      headers: {
        Location: canonical,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

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

  let result = await fetchPhotoBytes(ref.name, key, w);
  if (result === "rotated") {
    // Genuine rotation (Google 404/403 on the media name) — re-resolve once.
    photos = await refreshVendorGooglePhotos(vendor.id, vendor.google_place_id);
    ref = photos[i];
    result = ref ? await fetchPhotoBytes(ref.name, key, w) : "transient";
  }
  if (result === "rotated" || result === "transient") return empty(404, 60);

  return new Response(result.buf, {
    headers: {
      "Content-Type": result.contentType,
      // Browser 1d, shared/CDN up to 90d. A TTL is not guaranteed retention.
      "Cache-Control":
        "public, max-age=86400, s-maxage=7776000, stale-while-revalidate=604800",
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
  maxWidth: number,
): Promise<{ buf: ArrayBuffer; contentType: string } | "rotated" | "transient"> {
  if (!isValidPhotoName(name)) return "transient";
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidth}`,
      {
        headers: { "X-Goog-Api-Key": key },
        // Unlike CDN entries, Vercel's Data Cache survives app deployments.
        // Keyed by the stable Google resource URL, width, and API key, never
        // the incoming request URL or deployment. Only 200s are cached by Next.
        // Entries over the platform's 2 MB limit cannot be retained.
        cache: "force-cache",
        next: { revalidate: 7776000 }, // 90 days
      },
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
