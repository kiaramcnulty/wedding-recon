// Canonicalize a vendor's `region` to a 2-letter USPS state code.
//
// The column is meant to hold a 2-letter state code ("CO") — that's what the bulk
// importer writes and what every reader filters on (`.eq("region", "CO")`). The two
// interactive "Add Recon" paths, however, feed it non-canonical values:
//   • Google Places path parses the formatted address and grabs the "ST ZIP"
//     comma-segment  ->  "CO 80513"
//   • Manual path uses Nominatim's `address.state`, the full name  ->  "Colorado"
// Normalizing at the write chokepoint keeps the column canonical without making every
// read query fuzzy. It is deliberately conservative: any value it cannot confidently
// map to a known state is returned unchanged, so it can never corrupt an unexpected
// value — worst case a row stays exactly as it would have before this helper existed.

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
};

const STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

export function normalizeRegion(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;

  // Already a canonical 2-letter code (also fixes casing, e.g. "co" -> "CO").
  const upper = s.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && STATE_CODES.has(upper)) return upper;

  // Full state name, e.g. "Colorado" (Nominatim `address.state`).
  const byName = STATE_NAME_TO_CODE[s.toLowerCase()];
  if (byName) return byName;

  // Embedded state-code token, e.g. "CO 80513" (Google "ST ZIP" address segment).
  const token = (upper.match(/\b[A-Z]{2}\b/g) ?? []).find((t) => STATE_CODES.has(t));
  if (token) return token;

  // Unknown shape — leave untouched rather than risk corrupting a real value.
  return s;
}
