// Shared helpers for the /launchvenues pipeline. Node built-ins only.
import fs from 'node:fs';

export const HEADERS = ['name', 'address', 'city', 'state', 'website', 'lat', 'lng', 'place_id', 'provenance', 'flags'];

export function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/** Read venues.csv into objects keyed by HEADERS (column-order independent; extra cols ignored). */
export function readVenues(file) {
  if (!fs.existsSync(file)) return [];
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  if (!rows.length) return [];
  const hdr = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c && c.trim()))
    .map((r) => Object.fromEntries(HEADERS.map((h) => { const i = hdr.indexOf(h); return [h, i === -1 ? '' : (r[i] ?? '').trim()]; })));
}

export function writeVenues(file, venues) {
  const lines = [HEADERS.join(',')];
  for (const v of venues) lines.push(HEADERS.map((h) => esc(v[h])).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

export const norm = (s) => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

const STOP = new Set(['the', 'a', 'an', 'at', 'of', 'and', 'by', 'in', 'on', 'wedding', 'weddings', 'venue', 'venues', 'event', 'events', 'center', 'centre', 'co', 'llc', 'inc']);
export const sigTokens = (name) => norm(name).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
// Generic venue-type words: real tokens, but too common to be sole evidence of a match
// ("Zzyzx Imaginary Gardens" must not match "Denver Botanic Gardens" on "gardens" alone).
const WEAK = new Set(['garden', 'gardens', 'farm', 'farms', 'ranch', 'house', 'hall', 'club', 'park', 'hotel', 'inn', 'manor', 'barn', 'estate', 'estates', 'lodge', 'gallery', 'room', 'rooftop', 'studio', 'studios', 'castle', 'chapel', 'pavilion']);
/**
 * Match guard between a query name and a Places result name. Passes when:
 *  - every significant query token appears in the match (exact-name case), OR
 *  - at least half of them do AND at least one shared token is distinctive (non-generic).
 * Guards against wrong-business matches on a single generic word.
 */
export function tokensOverlap(a, b) {
  const qa = sigTokens(a);
  if (!qa.length) return false;
  const B = new Set(sigTokens(b));
  const shared = qa.filter((t) => B.has(t));
  if (shared.length === qa.length) return true;
  return shared.length / qa.length >= 0.5 && shared.some((t) => !WEAK.has(t));
}

/**
 * Split "street, city, ST zip[, country][, owner-note]" into { city, state, cleanAddress }.
 * Handles: owner notes appended after the zip (Google Maps quirk), trailing "USA",
 * no-comma "3358 York St. Denver" addresses, two-word cities, bare "City, ST".
 */
export function parseCityState(address, fallbackState) {
  let parts = (address || '').split(',').map((s) => s.trim()).filter(Boolean);
  const zipIdx = parts.findIndex((p) => /^[A-Z]{2}\s*\d{5}/.test(p));
  if (zipIdx !== -1 && zipIdx < parts.length - 1) parts = parts.slice(0, zipIdx + 1);
  if (parts.length && /^(usa|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  let city = '', state = fallbackState || '';
  if (parts.length) {
    const last = parts[parts.length - 1];
    const m = last.match(/\b([A-Z]{2})\b/);
    if (m && parts.length >= 2) { state = m[1]; city = parts[parts.length - 2]; }
    else if (!/\d/.test(last)) city = last;
    city = city.replace(/\s*\(.*$/, '').trim();
    if (/\d/.test(city) || city.length > 24) { const t = city.split(/\s+/); city = t[t.length - 1] || ''; }
  }
  return { city, state, cleanAddress: parts.join(', ') };
}

export async function placesSearch(query, pageToken) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,nextPageToken',
    },
    body: JSON.stringify(pageToken ? { textQuery: query, pageToken } : { textQuery: query }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Place Details (New) lookup by place_id. Field mask omits the `places.` prefix (single
 * place, not a search array). Used to recover fields Text Search leaves empty.
 */
export async function placeDetails(placeId, fields = 'id,displayName,formattedAddress,location,websiteUri') {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': fields },
  });
  if (!res.ok) throw new Error(`Place Details ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Website for a matched place, with a Place Details fallback. Text Search routinely omits
 * `websiteUri` even for places that have a site (Details returns it reliably), so callers
 * pass the value from their search hit and we only spend the extra Details call — and its
 * rate-limit sleep — for the venues that actually came back without one. Returns '' on any
 * failure so a missing website never aborts a sweep/resolve.
 */
export async function websiteWithFallback(placeId, searchWebsite) {
  if (searchWebsite) return searchWebsite;
  if (!placeId) return '';
  try {
    const d = await placeDetails(placeId, 'websiteUri');
    await sleep(120);
    return d.websiteUri || '';
  } catch { return ''; }
}

// Hosts that are never a venue's OWN website (social, maps, link aggregators). A listicle
// or scrape often lists one of these as a venue's "site"; we don't want them in the column.
const NON_WEBSITE_HOSTS = /(^|\.)(facebook|instagram|twitter|x|tiktok|pinterest|youtube|youtu|linktr|linktree|google|g|goo|yelp)\.(com|be|page|gl|ee)$/i;
/**
 * Normalize + validate a website URL sourced from RESEARCH or a SCRAPE (not Google's own
 * websiteUri, which is already canonical). Adds https:// if scheme-less, requires a dotted
 * host and http(s), and drops social/maps/aggregator hosts. Returns '' for anything that
 * doesn't cleanly parse so a junk listicle cell never lands in the DB. Backend-only.
 */
export function cleanWebsite(raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!/\.[a-z]{2,}$/i.test(u.hostname) || u.hostname.length < 4) return '';
    if (NON_WEBSITE_HOSTS.test(u.hostname)) return '';
    return u.toString().replace(/\/$/, '');
  } catch { return ''; }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function argValue(name) { const i = process.argv.indexOf(`--${name}`); return i === -1 ? null : process.argv[i + 1]; }
