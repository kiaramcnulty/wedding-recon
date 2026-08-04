import { normalizeRegion } from "@/lib/normalize-region";

/**
 * "City, ST" for a vendor — the subtitle under the name on every vendor preview
 * card (map peek, cluster feed, on-screen results feed, Planning Hub).
 *
 * The `city` / `region` columns are the source of truth and are populated for
 * essentially every row the launch pipelines and the Google-Places Add path
 * write. `address_text` is only consulted to fill a gap, because the rows that
 * have one missing are precisely the hand-added ones whose address still carries
 * the answer.
 */

/** The fields the locality is derived from. */
export interface LocalityFields {
  city?: string | null;
  region?: string | null;
  address_text?: string | null;
}

/**
 * A 2-letter USPS code, or null. normalizeRegion() maps full names ("Colorado")
 * and Google's "ST ZIP" segments ("CO 80202") onto codes and returns anything it
 * cannot place unchanged — so requiring a clean 2-letter result is what turns it
 * into a reliable "is this a state?" test.
 */
function toStateCode(raw: string | null | undefined): string | null {
  const code = normalizeRegion(raw);
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Pull "City, ST" out of a formatted address. Handles both shapes we store:
 * a full Google address ("1400 Larimer St, Denver, CO 80202, USA") and the
 * centroid fallback the launch pipeline writes ("Littleton, CO").
 *
 * Scans from the END, and only accepts a state found in the last two segments.
 * US addresses put the state there, and the guard is what stops a street name
 * that happens to contain a state abbreviation ("Mt Vernon Rd" -> MT) from
 * hijacking the parse and dragging a junk city along with it.
 */
function parseAddress(addressText: string | null | undefined): {
  city: string | null;
  region: string | null;
} {
  const segments = (addressText ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = segments.length - 1; i >= 0 && i >= segments.length - 2; i--) {
    const code = toStateCode(segments[i]);
    if (!code) continue;
    return { city: segments[i - 1] ?? null, region: code };
  }
  return { city: null, region: null };
}

/**
 * Render a vendor's locality, or null when there is nothing worth showing. A
 * bare state with no city ("CO") is treated as nothing — it reads as a data
 * glitch rather than a location, and an absent subtitle is tidier than a
 * meaningless one.
 */
export function formatVendorLocality(vendor: LocalityFields): string | null {
  let city = vendor.city?.trim() || null;
  let region = toStateCode(vendor.region) ?? vendor.region?.trim() ?? null;

  if (!city || !region) {
    const parsed = parseAddress(vendor.address_text);
    city ??= parsed.city;
    region ??= parsed.region;
  }

  if (!city) return null;
  return region ? `${city}, ${region}` : city;
}
