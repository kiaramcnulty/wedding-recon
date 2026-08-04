/**
 * Location-precision heuristics shared by every surface that draws a vendor pin
 * — the Explore map (`components/map/vendor-map.tsx`) and the vendor page's
 * mini-map (`components/vendor/vendor-map-preview.tsx`). Kept out of both so the
 * two can never drift on what counts as an approximate pin.
 */

/** The subset of a vendor row the precision heuristic actually reads. */
export interface LocatableVendor {
  source?: string | null;
  google_place_id?: string | null;
  address_text?: string | null;
}

/**
 * Heuristic: does this vendor's pin sit on an *approximate* (city/region
 * centroid) location rather than a precise street address?
 *
 * Google-sourced vendors carry rooftop-precise coordinates. For user/seed
 * vendors we treat the absence of a street/building number in the address as
 * "approximate" — a city or region geocode (e.g. "Denver, Colorado") has no
 * house number, whereas a real address does. This is intentionally a front-end
 * heuristic so it works on existing rows; if we later capture geocode precision
 * at save time (Nominatim bbox / addresstype), swap this for that field.
 *
 * Known blind spot: numbered street names ("E 17th Ave") read as precise.
 */
export function isApproximateLocation(vendor: LocatableVendor): boolean {
  if (vendor.source === "google" || vendor.google_place_id) return false;
  const addr = (vendor.address_text ?? "").trim();
  return !/\d/.test(addr);
}
