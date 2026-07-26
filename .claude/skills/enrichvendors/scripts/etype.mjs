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
  dress: {
    key: 'dress',
    vendorType: 'dress',
    label: 'BRIDAL SHOP',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // most are storefronts — shop city/metro is a fine sourced fallback
    refs: refsFor('dress'),
    hasInstagram: true,                // vendors.instagram is pipeline-populated for this type (migration 0016)
    subpage: /(pric|appoint|book|designer|collection|gown|dress|bridal|bridesmaid|trunk|sample|about|faq|service)/i,
    priceLine: /\$\s?\d|gowns?|dress(es)?|designer|trunk show|sample sale|off.the.rack|made.to.(order|measure)|special order|alteration|appointment|deposit|budget|price range|starting (at|price)|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/designer lines',
    portraitFilter: false,             // the GOWN is the product but it's worn — gown-on-model/mannequin shots are keepers, don't pre-drop "bride" URLs
    photoCap: 2,
    notFlag: 'NOTDRESS',
  },
  beauty: {
    key: 'beauty',
    vendorType: 'beauty',
    label: 'HAIR & MAKEUP ARTIST',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // mobile artists travel to the couple — where they'll go IS the product
    refs: refsFor('hairmakeup'),
    hasInstagram: true,                // vendors.instagram is pipeline-populated for this type (migration 0016);
                                       // these vendors often have a thin site and a rich IG, so the handle matters
    subpage: /(pric|package|rate|invest|servic|wedding|bridal|book|faq|about|hair|makeup|beauty|glam|gallery|portfolio|team|travel)/i,
    // This type USUALLY POSTS its rate card (Kiara, 2026-07): bride hair / bride makeup /
    // combined, per-person bridal-party rates, trial fee, add-ons, and — the one couples get
    // surprised by — travel/mileage/minimum/early-start terms. Cast wide enough to catch all of it.
    priceLine: /\$\s?\d|per (person|service|head)|packag|bride|bridal (hair|makeup|party|beauty)|bridesmaids?|mother of the|flower girl|trial|preview|touch.?up|lash(es)?|extensions?|updo|blowout|airbrush|veil|travel fee|mileage|on.?(site|location)|minimum|deposit|retainer|early (start|morning)|starting (at|price)|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/package lines',
    portraitFilter: false,             // the FACE is the product — a bride's hair/makeup close-up is the portfolio, not junk
    photoCap: 3,                       // 2-3 close-ups of brides / bridal party (Kiara, 2026-07)
    notFlag: 'NOTBEAUTY',
  },
  hotel: {
    key: 'hotel',
    vendorType: 'hotel',
    label: 'HOTEL (GUEST ROOM BLOCKS)',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // fixed property — its city/metro is the sourced fallback
    refs: refsFor('hotelblocks'),
    subpage: /(wedding|group|block|room|rate|reserv|book|meeting|event|faq|amenit|parking|shuttle|breakfast|accommodat|stay|about)/i,
    // Block economics, not nightly-rate marketing: the courtesy-vs-attrition distinction,
    // contract minimums, who pays, and how the block rate compares to the going rate are
    // what couples need (Kiara, 2026-07). Amenity words are here too because parking and
    // shuttle costs are part of what a guest actually pays.
    priceLine: /\$\s?\d|per night|nightly|room block|group (rate|block|booking|sales)|courtesy block|attrition|guaranteed|cut.?off|rack rate|discount|complimentary|comp\b|minimum|contract|deposit|prepay|reimburs|room rate|parking|shuttle|breakfast|resort fee|facility fee|tax|suites?|king|queen|double queen/i,
    dossierPriceTitle: 'site room-block/rate lines',
    portraitFilter: true,              // rooms and the property are the product; couple portraits are junk here
    photoCap: 2,
    notFlag: 'NOTHOTEL',
  },
  planner: {
    key: 'planner',
    vendorType: 'planner',
    label: 'PLANNER',
    headers: [...BASE_HEADERS, 'service_region'],
    serviceRegionRequired: true,       // service-area vendor; default to the run's state, note travel fees (Kiara, 2026-07)
    refs: refsFor('planner'),
    subpage: /(pric|package|rate|invest|service|wedding|event|about|process|experience|coordinat|plann|portfolio|gallery|faq|book|contact)/i,
    // Planner pricing shapes: full/partial planning, day-of & month-of coordination, hourly,
    // flat fee, or a PERCENTAGE of the total wedding budget (10-15% is a real model — keep % lines).
    priceLine: /\$\s?\d|packag|full (service|planning|wedding)|partial (planning|service)|day.of|month.of|coordinat|starting (at|price)|invest|retainer|deposit|hourly|per hour|flat (fee|rate)|percent|% of|travel fee|pric(e|ing)|\brates?\b/i,
    dossierPriceTitle: 'site pricing/package lines',
    portraitFilter: false,             // a planner's portfolio IS the styled wedding they produced — couples, ceremonies, tablescapes are the work, not junk; don't pre-drop portrait URLs
    photoCap: 2,
    notFlag: 'NOTPLANNER',
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
    dress: 'dress', dresses: 'dress', bridal: 'dress', bridals: 'dress', gown: 'dress', gowns: 'dress',
    planner: 'planner', planners: 'planner', planning: 'planner', coordinator: 'planner', coordinators: 'planner', coordination: 'planner',
    // Hair & makeup is ONE joint type — every hair-ish and makeup-ish alias lands on it.
    beauty: 'beauty', hairmakeup: 'beauty', 'hair-makeup': 'beauty', 'hair+makeup': 'beauty', 'hair&makeup': 'beauty',
    hair: 'beauty', makeup: 'beauty', 'make-up': 'beauty', hmua: 'beauty', hmu: 'beauty',
    stylist: 'beauty', stylists: 'beauty', glam: 'beauty',
    // Hotel room blocks for guests (stay-only properties — a hotel with event space is a venue).
    hotel: 'hotel', hotels: 'hotel', hotelblock: 'hotel', hotelblocks: 'hotel',
    'hotel-block': 'hotel', 'hotel-blocks': 'hotel', block: 'hotel', blocks: 'hotel',
    lodging: 'hotel', accommodation: 'hotel', accommodations: 'hotel', rooms: 'hotel',
  };
  const key = alias[raw];
  if (!key) { console.error(`unknown --type "${raw}" — known: venue, photographer, caterer, music, flowers, dress, planner, hairmakeup, hotelblocks`); process.exit(1); }
  return ETYPES[key];
}
