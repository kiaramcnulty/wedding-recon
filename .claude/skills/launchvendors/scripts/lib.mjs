// Shared helpers for the /launchvendors pipeline. Node built-ins only.
import fs from 'node:fs';

// `subtype` carries a per-row vendor-type refinement for types that split one sweep across
// several vendor_types (music → 'dj' | 'band'). Blank for every other type — appended LAST
// so column indexes for existing workdirs are untouched and old CSVs read it back as ''.
export const HEADERS = ['name', 'address', 'city', 'state', 'website', 'instagram', 'lat', 'lng', 'place_id', 'provenance', 'flags', 'subtype'];

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

/** Read the working CSV into objects keyed by HEADERS (column-order independent; extra cols
 *  ignored; files written before a column existed read fine — missing cols come back ''). */
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
// Kept as the tokensOverlap default so the original venue behavior is unchanged.
const VENUE_WEAK = new Set(['garden', 'gardens', 'farm', 'farms', 'ranch', 'house', 'hall', 'club', 'park', 'hotel', 'inn', 'manor', 'barn', 'estate', 'estates', 'lodge', 'gallery', 'room', 'rooftop', 'studio', 'studios', 'castle', 'chapel', 'pavilion']);
/**
 * Match guard between a query name and a Places result name. Passes when:
 *  - every significant query token appears in the match (exact-name case), OR
 *  - at least half of them do AND at least one shared token is distinctive (non-generic).
 * `weak` is the per-type set of trade/type words that can't be the sole shared token
 * (defaults to the venue set; pass profile.weak).
 */
export function tokensOverlap(a, b, weak = VENUE_WEAK) {
  const qa = sigTokens(a);
  if (!qa.length) return false;
  const B = new Set(sigTokens(b));
  const shared = qa.filter((t) => B.has(t));
  if (shared.length === qa.length) return true;
  return shared.length / qa.length >= 0.5 && shared.some((t) => !weak.has(t));
}

/**
 * Per-vendor-type MECHANICAL config (queries, dedup tokens, CSV name, columns).
 * Judgment-side guidance (research queries, extraction prompts, review bars) lives in
 * ../types/<card>.md — keep the two in sync. The venue profile encodes the original
 * /launchvenues behavior exactly; adding a type here must not change venue runs.
 */
// Cross-type name guard (Kiara 2026-07-18, after planners kept landing in photographer
// sweeps — e.g. "Belleview Weddings & Events" seeded as a photographer, caught only at
// enrichment as NOTPHOTOG). A row is pruned when its NAME unambiguously signals a
// DIFFERENT vendor type (wrongType) AND carries no own-type trade word (ownSignal).
// The own-signal override keeps hybrids: "Ever After Events Photography" stays a
// photographer, "The Rose Event Center & Catering" stays a venue. False prunes land in
// pruned.csv (humans skim it), missed ones still get the enrich-time NOT* flag — so this
// leans decisive on unambiguous names and silent on ambiguous ones.
export const wrongTypeByName = (profile, name) =>
  !!(profile.wrongType?.test(name) && !profile.ownSignal?.test(name));

// Music splits one sweep across two vendor_types: 'dj' and 'band' ("Live music" — the
// broad live-performer bucket). classifyMusic tags a swept act from its NAME, mirroring
// migration 0020's SQL heuristic so launch and the DB reclassification agree. Default is
// 'band' (live is the broad default); a row is 'dj' only on an explicit DJ word, OR a
// DJ-leaning company word with NO live-instrument word present. Best-effort — the CSV
// `subtype` column is human-reviewable (and overridable) before upload writes vendor_type.
const MUSIC_LIVE = /\b(bands?|quartets?|trios?|duos?|ensembles?|orchestras?|strings?|choir|acoustic|jazz|mariachi|bluegrass|pian(o|os|ist|ists)|guitars?|violins?|cellos?|harp|harpists?|sax|saxophone|vocals?|vocalist|singers?|symphony|a cappella)\b/i;
const MUSIC_DJ = /\bdjs?\b|\bdisc jockeys?\b/i;
const MUSIC_DJ_SOFT = /\b(sounds?|productions?|entertainment|mobile|spins?|mix(es)?)\b/i;
export function classifyMusic(name) {
  const n = name || '';
  if (MUSIC_DJ.test(n)) return 'dj';
  if (MUSIC_DJ_SOFT.test(n) && !MUSIC_LIVE.test(n)) return 'dj';
  return 'band';
}

export const TYPE_PROFILES = {
  venue: {
    vendorType: 'venue',
    csv: 'venues.csv',            // historical name — pre-rename venue workdirs stay re-runnable
    // "wedding venue" only — "event venue" pulls in meeting rooms / corporate banquet
    // space that isn't wedding-relevant. Keep the query intent tight.
    sweepQuery: (anchor) => `wedding venue near ${anchor}`,
    statewideQuery: (stateName) => `wedding venues in ${stateName}`,
    weak: VENUE_WEAK,
    dedupStop: new Set(),         // no trade words stripped — venue names dedupe on norm() alone
    captureInstagram: false,
    // NOTE "events" is NOT a wrong-signal for venues — "Grandview Events" is a plausible
    // venue name. Planners without planner-words slip through to the enrich-time flag.
    wrongType: /\b(photograph\w*|videograph\w*|plann(er|ers|ing)|coordinat\w*|cater\w*|florists?|florals?|dj|salon|makeup|beauty bar|bridal (shop|boutique)|tuxedo|jewel\w*|limo\w*|(party|event|tent) rentals?)\b/i,
    ownSignal: /\b(venue|barn|ranch|estate|manor|hall|lodge|garden|farm|inn|hotel|resort|club|chateau|château|villa|winery|vineyard|brewery|distillery|ballroom|center|centre|space|loft|museum|chapel|church|mansion|house|terrace|pavilion|park|room|gallery|homestead|orchard|meadow|grove)\b/i,
  },
  photos: {
    vendorType: 'photos',
    csv: 'vendors.csv',
    sweepQuery: (anchor) => `wedding photographer near ${anchor}`,
    // Service-area vendors brand statewide ("Colorado Wedding Photographer") and often
    // miss city-"near" queries — the statewide query is the primary net for this type.
    statewideQuery: (stateName) => `wedding photographer in ${stateName}`,
    // "X Photography" must never match "Y Photography" on the trade word alone.
    weak: new Set(['photography', 'photograph', 'photographs', 'photo', 'photos', 'photographer', 'photographers', 'studio', 'studios', 'film', 'films', 'media', 'imagery', 'image', 'images', 'creative', 'collective', 'productions', 'elopement', 'elopements']),
    // Sole-proprietor name variants: "Jane Doe Photography" ≡ "Jane Doe Photo LLC".
    // Includes company suffixes — nameKey works on norm(), which (unlike sigTokens) keeps them.
    dedupStop: new Set(['photography', 'photograph', 'photographs', 'photo', 'photos', 'photographer', 'photographers', 'studio', 'studios', 'film', 'films', 'llc', 'inc', 'co', 'the']),
    // Obvious sweep noise dropped by NAME before it ever enters the CSV (Kiara, 2026-07:
    // prune proactively — humans skim, they don't audit). "booth" alone is a surname; only
    // the full phrase is safe.
    junkName: /photo ?booths?\b/i,
    captureInstagram: true,       // requires vendors.instagram (migration 0016) at upload time
    // WEDDING photographers only (Kiara, 2026-07) — sweep queries have wedding intent but
    // Places pads results with general portrait/family studios. wedcheck.mjs keeps a sweep
    // row only when its name or website homepage matches this; otherwise flags for review.
    intent: /wedding|elopement|bridal/i,
    // "weddings & events"/trailing-"Events" names are planner-shaped; photo/film words rescue.
    wrongType: /\b(plann(er|ers|ing)|coordinat\w*|weddings? (&|and) events?|events?$|rentals?|cater\w*|florists?|florals?|venue|banquet|officiants?|salon|makeup|bridal (shop|boutique)|tuxedo|jewel\w*|cakes?|bakery|limo\w*)\b/i,
    ownSignal: /\b(photo\w*|pictures?|imag(e|es|ery)|studios?|films?|media|lens|captured?|visuals?|cinema\w*|portraits?|exposures?|shutter)\b/i,
  },
  food: {
    vendorType: 'food',
    csv: 'vendors.csv',
    sweepQuery: (anchor) => `wedding caterer near ${anchor}`,
    statewideQuery: (stateName) => `wedding catering in ${stateName}`,
    // "X Catering" must never match "Y Catering" on the trade word alone.
    weak: new Set(['catering', 'caterer', 'caterers', 'cuisine', 'kitchen', 'kitchens', 'food', 'foods', 'events', 'bbq', 'cafe', 'grill', 'chef', 'chefs', 'company', 'group', 'hospitality']),
    dedupStop: new Set(['catering', 'caterer', 'caterers', 'events', 'co', 'llc', 'inc', 'the']),
    junkName: /\b(grocery|supermarket|convenience|gas station|liquor store)\b/i,
    captureInstagram: false,
    // Wedding-specific results only (Kiara, 2026-07): a caterer with zero wedding evidence
    // on name/site is flagged; a reddit thread or Google review describing their wedding
    // work rescues the row at review even if the site never says "wedding".
    intent: /wedding|bridal/i,
    wrongType: /\b(photograph\w*|videograph\w*|plann(er|ers|ing)|coordinat\w*|florists?|florals?|venues?|dj|salon|makeup|tuxedo|jewel\w*|limo\w*)\b/i,
    ownSignal: /\b(cater\w*|cuisine|kitchens?|foods?|bbq|barbecue|cafe|grill|chefs?|bak(e|ery|ing|ed)|bistro|restaurant|taco|pizza|eats|dining|provisions|table|feast|roast|smoke\w*|spice|hospitality)\b/i,
  },
  music: {
    // One sweep, TWO output types: each row is tagged 'dj' or 'band' ("Live music") by
    // classifyMusic into the CSV `subtype` column (human-reviewable), and upload.mjs writes
    // vendor_type per-row from it. `vendorType` here is the DEFAULT for a blank subtype;
    // `vendorTypes` scopes dedup across both. (`--type music` still drives the whole run.)
    vendorType: 'band',
    vendorTypes: ['dj', 'band'],
    classify: classifyMusic,
    csv: 'vendors.csv',
    // Three nets per anchor (Kiara, 2026-07): bands and DJs brand differently, and
    // "wedding music" catches ceremony ensembles/pianists the other two miss.
    // place_id dedup collapses the heavy overlap for free.
    sweepQuery: (anchor) => [`wedding band near ${anchor}`, `wedding dj near ${anchor}`, `wedding music near ${anchor}`],
    statewideQuery: (stateName) => [`wedding band in ${stateName}`, `wedding dj in ${stateName}`, `wedding music in ${stateName}`],
    weak: new Set(['music', 'musicians', 'musician', 'band', 'bands', 'dj', 'djs', 'entertainment', 'events', 'productions', 'sound', 'sounds', 'strings', 'trio', 'quartet', 'ensemble', 'live', 'party', 'group', 'company']),
    dedupStop: new Set(['music', 'band', 'dj', 'djs', 'entertainment', 'events', 'productions', 'llc', 'inc', 'co', 'the']),
    // "wedding music" is the loosest sweep net — drop schools/lessons/AV/instrument shops
    // by name before they enter the CSV. Legit act names ("Elite DJ Productions") don't match.
    junkName: /\b(school|schools|academy|conservatory|lessons?|tuition|karaoke|instrument store|music store|guitar center|equipment rental|av rental|audio.?visual)\b/i,
    captureInstagram: false,
    intent: /wedding|bridal/i,
    wrongType: /\b(photograph\w*|videograph\w*|plann(er|ers|ing)|coordinat\w*|cater\w*|florists?|florals?|venues?|salon|makeup|tuxedo|jewel\w*|limo\w*)\b/i,
    ownSignal: /\b(music\w*|bands?|djs?|entertain\w*|sounds?|strings|trio|quartet|ensemble|sing\w*|piano|guitar|violin|cello|harp|orchestra|acoustic|beats|audio|vocal\w*|brass|jazz|keys)\b/i,
  },
  flowers: {
    vendorType: 'flowers',
    csv: 'vendors.csv',
    sweepQuery: (anchor) => `wedding florist near ${anchor}`,
    statewideQuery: (stateName) => `wedding florists in ${stateName}`,
    weak: new Set(['flower', 'flowers', 'floral', 'florals', 'florist', 'florists', 'bloom', 'blooms', 'blossom', 'blossoms', 'petal', 'petals', 'posy', 'stems', 'botanical', 'design', 'designs', 'studio', 'studios', 'shop', 'garden', 'gardens']),
    dedupStop: new Set(['floral', 'florals', 'florist', 'florists', 'flowers', 'flower', 'design', 'designs', 'studio', 'co', 'llc', 'inc', 'the']),
    // "farm"/"garden" alone are legit florist names — only the unambiguous phrases prune.
    junkName: /\b(nursery|nurseries|garden center|greenhouse|farm supply|landscap\w*)\b/i,
    captureInstagram: false,
    intent: /wedding|bridal/i,
    wrongType: /\b(photograph\w*|videograph\w*|plann(er|ers|ing)|coordinat\w*|cater\w*|venues?|djs?|salon|makeup|tuxedo|jewel\w*|limo\w*)\b/i,
    ownSignal: /\b(flowers?|florals?|florists?|blooms?|blossoms?|petals?|posy|stems?|botanic\w*|bouquets?|roses?|peon(y|ies)|lil(y|ies)|ivy|ferns?|greenery|gardens?|buds?|wildflower\w*|stemm\w*|sage|lavender)\b/i,
  },
};

/** Resolve --type (accepts user-facing aliases) to a profile; clear message on unknown. */
export function typeProfile() {
  const raw = (argValue('type') || 'venue').toLowerCase();
  const alias = {
    venue: 'venue', venues: 'venue',
    photographer: 'photos', photographers: 'photos', photography: 'photos', photos: 'photos', photo: 'photos',
    caterer: 'food', caterers: 'food', catering: 'food', food: 'food',
    music: 'music', musician: 'music', musicians: 'music', band: 'music', bands: 'music', dj: 'music', djs: 'music',
    flowers: 'flowers', flower: 'flowers', florist: 'flowers', florists: 'flowers', floral: 'flowers',
  };
  const key = alias[raw];
  if (!key) { console.error(`unknown --type "${raw}" — known: venue, photographer, caterer, music, flowers`); process.exit(1); }
  return { key, ...TYPE_PROFILES[key] };
}

/**
 * Name key for dedup. Venue: norm(name) — the original behavior. Types with dedupStop
 * strip trade words first so sole-proprietor variants collide ("Jane Doe Photography" ≡
 * "Jane Doe Photo"). Falls back to norm(name) when stripping would leave nothing
 * ("The Photography Studio").
 */
export function nameKey(name, profile) {
  if (!profile || !profile.dedupStop.size) return norm(name);
  const kept = norm(name).split(' ').filter((t) => t && !profile.dedupStop.has(t));
  return kept.length ? kept.join(' ') : norm(name);
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

// Domains that are never a vendor's OWN website — social, maps/search, and wedding/review
// DIRECTORIES. A listicle or scrape often lists one of these as a vendor's "site"; we only
// want the vendor's own domain, so a directory/social link is dropped rather than stored.
// (Instagram links are dropped HERE but captured separately via cleanInstagram for types
// with captureInstagram — an IG page is never a `website`.)
const NON_WEBSITE_DOMAINS = [
  // social / video / link aggregators
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'pinterest.com', 'youtube.com', 'youtu.be', 'linktr.ee', 'linktree.com',
  // maps / search
  'google.com', 'g.page', 'goo.gl',
  // review + wedding directories (vendor-specific pages, but not the vendor's own domain)
  'yelp.com', 'tripadvisor.com', 'theknot.com', 'weddingwire.com', 'zola.com',
  'weddingspot.com', 'wedding-spot.com', 'herecomestheguide.com', 'partyslate.com',
  'eventective.com', 'peerspace.com', 'weddingvenuemap.com', 'bridalguide.com',
];
/**
 * Normalize + validate a website URL sourced from RESEARCH or a SCRAPE (not Google's own
 * websiteUri, which is already canonical). Adds https:// if scheme-less, requires a dotted
 * host and http(s), and drops any non-vendor domain (social/maps/directory) so ONLY a
 * vendor's own domain is stored. Returns '' for anything that doesn't cleanly parse so a
 * junk listicle cell never lands in the DB. Backend-only.
 */
export function cleanWebsite(raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!/\.[a-z]{2,}$/i.test(u.hostname) || u.hostname.length < 4) return '';
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (NON_WEBSITE_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) return '';
    return u.toString().replace(/\/$/, '');
  } catch { return ''; }
}

/**
 * Normalize an Instagram reference ("@handle", "handle", or an instagram.com URL) to a
 * bare handle for vendors.instagram. Returns '' for anything that doesn't cleanly parse —
 * including instagram.com paths that aren't profiles (/p/, /reel/, /explore/). Backend-only.
 */
export function cleanInstagram(raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, '').replace(/\/+$/, '');
  const NOT_PROFILES = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'share']);
  if (NOT_PROFILES.has(s.toLowerCase())) return '';
  return /^[a-z0-9._]{2,30}$/i.test(s) ? s : '';
}

/**
 * Audit trail for proactively-removed rows (Kiara, 2026-07: prune noise mechanically —
 * humans skim large lists, they don't audit them). Pruned rows never reach the working
 * CSV / the DB, but live in <workdir>/pruned.csv (same columns, reason in `flags`) so a
 * skim can rescue one by moving the row back. Dedupes by place_id (else normalized name)
 * so re-runs don't stack duplicates.
 */
export function appendPruned(workdir, rows) {
  if (!rows.length) return;
  const file = `${workdir}/pruned.csv`;
  const existing = readVenues(file);
  const seen = new Set(existing.map((v) => v.place_id || norm(v.name)));
  for (const r of rows) {
    const k = r.place_id || norm(r.name);
    if (seen.has(k)) continue;
    seen.add(k);
    existing.push(r);
  }
  writeVenues(file, existing);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function argValue(name) { const i = process.argv.indexOf(`--${name}`); return i === -1 ? null : process.argv[i + 1]; }

// Supabase caps a plain .select() at 1000 rows, so counts/coverage silently
// under-report past 1000. Page through in 1000-row chunks. `make` must return a
// fresh, ORDERED query builder each call (order by a unique col for stable paging).
export async function selectAll(make) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await make().range(from, from + size - 1);
    if (error) return { data: null, error };
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return { data: out, error: null };
}
