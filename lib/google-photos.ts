import { createServiceRoleClient } from "@/lib/supabase/server";
import type { GooglePhotoRef } from "@/lib/types";

// SERVER-ONLY. Reads GOOGLE_PLACES_API_KEY and writes vendors via the service
// role — only import from Route Handlers / Server Components, never client code.

/** Minimal shape needed to resolve + cache a vendor's Google photos. */
export interface VendorPhotoRow {
  id: string;
  google_place_id: string | null;
  google_photos: GooglePhotoRef[] | null;
  google_photos_fetched_at: string | null;
}

interface PlacesPhoto {
  name?: string;
  authorAttributions?: { displayName?: string; uri?: string }[];
}

const MAX_PHOTOS = 3;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // re-resolve photo refs at most monthly

// A well-formed Places photo resource name. Anything with path/query metachars is
// rejected so a stored name can't reshape the media URL it gets spliced into.
const PHOTO_NAME_RE = /^places\/[^/?#%\s]+\/photos\/[^/?#%\s]+$/;

/** True if `name` is a well-formed Places photo resource name. */
export function isValidPhotoName(name: string): boolean {
  return PHOTO_NAME_RE.test(name);
}

/**
 * The vendor's top ≤3 Google Places photo *references* (not bytes). Returns the
 * cached refs when fresh; otherwise resolves them from Place Details and stores
 * them on the row. Cheap on the common path (a cache read); only hits Google on
 * a cache miss (first view, or once the stamp is >30d old).
 *
 * Photo bytes are served on demand by /api/vendor-photo and CDN-cached — never
 * stored — so this stays within Google's no-caching terms and uses no Supabase
 * Storage.
 */
export async function getVendorGooglePhotos(
  vendor: VendorPhotoRow,
): Promise<GooglePhotoRef[]> {
  if (!vendor.google_place_id) return [];

  const fresh =
    vendor.google_photos != null &&
    vendor.google_photos_fetched_at != null &&
    Date.now() - new Date(vendor.google_photos_fetched_at).getTime() < TTL_MS;
  if (fresh) return vendor.google_photos as GooglePhotoRef[];

  return refreshVendorGooglePhotos(vendor.id, vendor.google_place_id);
}

/**
 * Force a re-resolve from Place Details and persist it. Used on a cache miss and
 * when a cached photo name has rotated (the media fetch 404s).
 */
export async function refreshVendorGooglePhotos(
  vendorId: string,
  placeId: string,
): Promise<GooglePhotoRef[]> {
  const photos = await fetchGooglePhotoRefs(placeId);

  // Service role: vendor UPDATE is owner-restricted under RLS, and these rows are
  // often bot/seed-owned. A missing-column error (migration 0014 not yet applied)
  // is swallowed — the feature still works, just uncached, until the migration runs.
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("vendors")
    .update({
      google_photos: photos,
      google_photos_fetched_at: new Date().toISOString(),
    })
    .eq("id", vendorId);
  if (error) console.error("[google-photos] cache write failed:", error.message);

  return photos;
}

/** One Place Details call (photos field only), mapped to our ≤3 stored refs. */
async function fetchGooglePhotoRefs(placeId: string): Promise<GooglePhotoRef[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,photos" },
        cache: "no-store", // we do our own 30-day cache on the row
      },
    );
    if (!res.ok) {
      console.error("[google-photos] details error", res.status);
      return [];
    }

    const data = (await res.json()) as { photos?: PlacesPhoto[] };
    const raw = Array.isArray(data.photos) ? data.photos : [];
    return raw
      .slice(0, MAX_PHOTOS)
      .map((p): GooglePhotoRef => {
        const a = p.authorAttributions?.[0];
        return {
          name: typeof p.name === "string" ? p.name : "",
          attrib: a?.displayName ?? null,
          attribUri: a?.uri ?? null,
        };
      })
      .filter((p) => isValidPhotoName(p.name));
  } catch (e) {
    console.error("[google-photos] details fetch failed", e);
    return [];
  }
}
