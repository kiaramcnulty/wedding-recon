// Per-vendor-type profiles for the /enrichvendors pipeline (mechanical config only —
// judgment config lives in ../references/<type>/*.md). The venue profile encodes the
// original /enrichvenues behavior exactly: same 11 CSV columns, same regexes, so
// in-flight venue backfills and old batch artifacts keep working byte-for-byte.
import { argValue } from '../../launchvendors/scripts/lib.mjs';

const BASE_HEADERS = ['venue', 'vendor_id', 'recon_type', 'month', 'year', 'price_text', 'price_details', 'notes', 'photos', 'sources', 'bot'];

export const ETYPES = {
  venue: {
    key: 'venue',
    vendorType: 'venue',
    label: 'VENUE',                    // call-file block label ("=== VENUE: ... ===")
    headers: BASE_HEADERS,             // first column is 'venue' for ALL types (historical name = vendor name)
    serviceRegionRequired: false,      // venues: service_region stays null (column absent from CSV)
    // reference files inlined into every call file, relative to ../references/
    refs: ['venue/draft-call-header.md', 'venue/entry-rules.md', 'voice-cards.md'],
    // harvest: which same-host subpages are worth crawling for text
    subpage: /(pric|package|rate|invest|wedding|event|faq|rental|tour|book|venue|capacit)/i,
    // dossier: which site-text lines count as pricing/spec content
    priceLine: /\$\s?\d|per\s+(person|plate|guest|head)|packag|rental|site fee|venue fee|minimum|deposit|capacit|(\d{2,4}\s+(guests?|seated|standing))|all.inclusive|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/capacity lines',
    // photos.mjs: venues drop couple-portrait URLs (people-as-subject is a junk signal there)
    portraitFilter: true,
    // photos-map: max keeper photos mapped per vendor
    photoCap: 2,
    // worker reply flag for "this row is a different vendor type, mis-seeded"
    notFlag: 'NOTAVENUE',
  },
  photos: {
    key: 'photos',
    vendorType: 'photos',
    label: 'PHOTOGRAPHER',
    headers: [...BASE_HEADERS, 'service_region'],   // appended LAST so venue column indexes are untouched
    serviceRegionRequired: true,       // REQUIRED on every photographer entry (Kiara, 2026-07)
    refs: ['photographer/draft-call-header.md', 'photographer/entry-rules.md', 'voice-cards.md'],
    subpage: /(pric|package|rate|invest|wedding|elope|engag|faq|book|about|service|collection|experience)/i,
    priceLine: /\$\s?\d|per\s+hour|hourly|packag|collection|starting (at|price)|invest|hours? of coverage|second (shooter|photographer)|engagement session|album|travel fee|elopement|deposit|retainer|pric(e|ing)|\brates?\b|full day|half day/i,
    dossierPriceTitle: 'site pricing/package lines',
    portraitFilter: false,             // portfolio couple portraits ARE the product for photographers
    photoCap: 3,                       // photos are critical for this type (Kiara, 2026-07): target ~3/vendor
    notFlag: 'NOTPHOTOG',
  },
};

/** Resolve --type (user-facing aliases accepted) to a profile; clear message on unknown. */
export function etype() {
  const raw = (argValue('type') || 'venue').toLowerCase();
  const alias = {
    venue: 'venue', venues: 'venue',
    photographer: 'photos', photographers: 'photos', photography: 'photos', photos: 'photos', photo: 'photos',
  };
  const key = alias[raw];
  if (!key) { console.error(`unknown --type "${raw}" — known: venue, photographer`); process.exit(1); }
  return ETYPES[key];
}
