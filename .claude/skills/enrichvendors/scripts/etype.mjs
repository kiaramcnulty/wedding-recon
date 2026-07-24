// Per-vendor-type profiles for the /enrichvendors pipeline (mechanical config only —
// judgment config lives in ../references/). Reference files inlined into every call
// file: shared common/draft-contract.md + common/entry-rules-core.md + the type's
// type-rules.md + voice-cards.md. The venue profile keeps the original 11 CSV columns
// so old venue batch artifacts keep working.
import { argValue } from '../../launchvendors/scripts/lib.mjs';

const BASE_HEADERS = ['venue', 'vendor_id', 'recon_type', 'month', 'year', 'price_text', 'price_details', 'notes', 'photos', 'sources', 'bot'];
const refsFor = (type) => ['common/draft-contract.md', 'common/entry-rules-core.md', `${type}/type-rules.md`, 'voice-cards.md'];

export const ETYPES = {
  venue: {
    key: 'venue',
    vendorType: 'venue',
    label: 'VENUE',                    // call-file block label ("=== VENUE: ... ===")
    headers: BASE_HEADERS,             // first column is 'venue' for ALL types (historical name = vendor name)
    serviceRegionRequired: false,      // venues: service_region stays null (column absent from CSV)
    refs: refsFor('venue'),
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
    refs: refsFor('photographer'),
    hasInstagram: true,                // vendors.instagram is pipeline-populated for this type (migration 0016)
    subpage: /(pric|package|rate|invest|wedding|elope|engag|faq|book|about|service|collection|experience)/i,
    priceLine: /\$\s?\d|per\s+hour|hourly|packag|collection|starting (at|price)|invest|hours? of coverage|second (shooter|photographer)|engagement session|album|travel fee|elopement|deposit|retainer|pric(e|ing)|\brates?\b|full day|half day/i,
    dossierPriceTitle: 'site pricing/package lines',
    portraitFilter: false,             // portfolio couple portraits ARE the product for photographers
    photoCap: 3,                       // photos are critical for this type (Kiara, 2026-07): target ~3/vendor
    notFlag: 'NOTPHOTOG',
  },
  food: {
    key: 'food',
    vendorType: 'food',
    label: 'CATERER',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // where + who they serve (Kiara, 2026-07)
    refs: refsFor('food'),
    subpage: /(pric|package|rate|invest|wedding|event|cater|menu|faq|book|service|tasting|about)/i,
    priceLine: /\$\s?\d|per\s+(person|guest|head|plate)|packag|minimum|deposit|buffet|plated|family.style|stations?|food truck|tasting|service (charge|fee)|staffing|bartend|menu|entr[ée]e|appetizer|hors d|passed|dessert|cuisine|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/menu lines',
    portraitFilter: true,              // food shots are the product; couple portraits are junk here
    photoCap: 2,
    notFlag: 'NOTCATERER',
  },
  music: {
    key: 'music',
    // Music is split across TWO vendor_types in the DB: 'dj' and 'band' ("Live music").
    // One `--type music` run still enriches BOTH — vendor selection reads vendorTypes, and
    // recon content is subtype-agnostic ("say what they are" already covers DJ vs band).
    // Enrich never writes vendor_type (only recon_entries), so no per-row typing is needed.
    vendorType: 'band',
    vendorTypes: ['dj', 'band'],
    label: 'MUSIC ACT',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // multi-state service is common — state it exactly (Kiara, 2026-07)
    refs: refsFor('music'),
    subpage: /(pric|package|rate|invest|wedding|event|faq|book|service|band|dj|ensemble|showcase|entertainment|music|about)/i,
    priceLine: /\$\s?\d|per\s+hour|hourly|packag|minimum|deposit|retainer|add.on|piece\b|ceremony|cocktail|reception|late.night|after.party|showcase|uplight|emcee|\bmc\b|dance floor|travel fee|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/package lines',
    portraitFilter: false,             // the performers ARE the product — band/DJ shots have people as subject
    photoCap: 2,
    notFlag: 'NOTMUSIC',
  },
  flowers: {
    key: 'flowers',
    vendorType: 'flowers',
    label: 'FLORIST',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // shop city/metro is an acceptable sourced fallback (Kiara, 2026-07)
    refs: refsFor('flowers'),
    subpage: /(pric|package|rate|invest|wedding|event|faq|book|service|floral|deliver|collection|gallery|portfolio|about)/i,
    priceLine: /\$\s?\d|packag|minimum|deposit|la carte|deliver|pick.?up|install|bouquet|boutonniere|centerpiece|arch|arbor|arrangement|consult|full.service|stems?|bloom|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/offering lines',
    portraitFilter: true,              // arrangement shots are the product; couple portraits are junk here
    photoCap: 2,
    notFlag: 'NOTFLORIST',
  },
};

/** Resolve --type (user-facing aliases accepted) to a profile; clear message on unknown. */
export function etype() {
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
  return ETYPES[key];
}
