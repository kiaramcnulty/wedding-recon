import type { VendorType } from "./categories";

/**
 * Vendor filter definitions — the single source of truth for the Explore filter
 * UI, the client-side matcher (`lib/filters/match.ts`), the backfill script, and
 * the shape of the `p_filters` argument sent to `vendors_in_bbox`.
 *
 * Attribute values were measured across all 2,163 CO vendors rather than
 * guessed; see `docs/vendor-filter-coverage.md` for per-attribute coverage and
 * `data/filter-extraction/vendor-filters.jsonl` for the dataset. Coverage drives
 * two UI behaviours that are wired through `rare` below.
 */

export type FilterKind = "multi" | "bool" | "range";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  /** Logical id. For `multi`/`bool` this is also the vendors.filters jsonb key. */
  key: string;
  label: string;
  kind: FilterKind;
  /** `multi` only. Order here is the order rendered. */
  options?: FilterOption[];
  /**
   * `range` only.
   * - `point`   — the vendor holds ONE number that must land inside the
   *               selected range (venue capacity: big enough for my party,
   *               not so big it swallows it).
   * - `overlap` — the vendor holds its own [lo, hi] range and matches when the
   *               two ranges intersect. Most prices are ranges (445 of 736
   *               priced rows), so "is the start price inside the band" would
   *               wrongly drop a venue quoting $4k-$12k from a $6k search.
   */
  mode?: "point" | "overlap";
  /** jsonb keys holding the vendor's range ends. Defaults to `key` for both. */
  lo?: string;
  hi?: string;
  unit?: "usd" | "guests" | "weeks";
  /**
   * `range` only. Only compare against vendors quoting in this basis; a vendor
   * priced per-person is not comparable to one priced per-package, so an
   * off-basis vendor reads as unknown (demoted) rather than as a miss.
   */
  basis?: string;
  /**
   * `range` only. Multipliers that convert an off-`basis` quote ONTO `basis`,
   * keyed by the vendor's own `price_basis`. A basis listed here is comparable
   * after scaling and is matched normally; one that is not stays unknown.
   *
   * This is what makes an assumption like "a per-person venue at 100 guests"
   * real rather than a claim in the copy. Both readers of a range — the matcher
   * in `lib/filters/match.ts` and the sheet's histogram — apply it, so a vendor
   * is binned under the same number it is judged by. Without it the two
   * disagreed: the histogram binned a $150-per-person venue in the $0-499 bar
   * while the matcher demoted that same venue into the partial tier for being
   * silent on a price it had published (Kiara, 2026-08-06).
   */
  basisScale?: Record<string, number>;
  /**
   * The sentence the sheet prints under the slider to state that conversion.
   * A `basisScale` without one is an assumption the couple is never told about,
   * so they travel together — and build the numbers from `PRICE_ASSUMPTIONS`
   * rather than typing them, or the copy starts lying the moment it is retuned.
   */
  basisNote?: string;
  /**
   * Coverage is low: few vendors have this recorded either way. Purely a UI
   * hint now — it paints the "Rare" badge on the filter in the sheet, warning
   * the couple that selecting it will not narrow much.
   *
   * It used to make the filter positive-only, EXCLUDING silent vendors rather
   * than demoting them, on the reasoning that a hotel running a shuttle would
   * say so. That is no longer the behaviour (Kiara, 2026-08-06): silence never
   * excludes anywhere now. The old rule was quietly deleting most of the map on
   * one tap — filtering photographers on "also shoots film" ruled out 233 of
   * 274 — and it was indefensible in the one case it most wanted to catch,
   * since a vendor is silent far more often because nobody extracted the fact
   * than because they lack the thing. Those vendors now land in the list view's
   * partial tier, under its divider and graded by how much of the ask they met,
   * where the couple can see them and judge. See "Two kinds of missing data" in
   * the coverage doc, which describes the superseded rule.
   */
  rare?: boolean;
  /** Companion filter id whose selection re-scales this range's histogram. */
  rescaledBy?: string;
  hint?: string;
}

/** Season vocabulary, normalized. The raw extraction used `peak`/`high` and
 * `low`/`off` interchangeably; the backfill collapses them to these three.
 * Named by MONTH, not by season word: a third of CO venues are ski-town
 * properties that peak in fall and bottom out in winter (Della Terra), so
 * "summer" would be actively wrong for them. */
export const SEASONS = [
  { value: "peak", label: "Peak", months: "May–Oct" },
  { value: "shoulder", label: "Shoulder", months: "Apr & Nov" },
  { value: "off", label: "Off-peak", months: "Dec–Mar" },
] as const;

export const DAY_TYPES = [
  { value: "weekday", label: "Weekday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

/**
 * The pricing assumptions, stated in the UI rather than hidden — a vendor
 * quoting on a different axis is converted onto the filter's so they can share
 * one slider. The numbers are Kiara's (2026-08-05).
 *
 * `guests` runs in BOTH directions and both filters use the same 100, which is
 * the point of one shared constant: venue multiplies a per-person quote up onto
 * its package axis, caterers divide a package down onto their per-person one
 * (Kiara, 2026-08-07). Two numbers here would let a $5,000 caterer and a
 * $5,000 venue imply different weddings. `hours` is venue-only.
 *
 * Declared above VENDOR_FILTERS because the price filters' `basisScale` is
 * built from it at module init — a `const` below would still be in its
 * temporal dead zone here.
 */
export const PRICE_ASSUMPTIONS = {
  guests: 100,
  hours: 5,
} as const;

const opt = (o: Record<string, string>): FilterOption[] =>
  Object.entries(o).map(([value, label]) => ({ value, label }));

const PRICE_CONFIDENCE_LABELS: Record<string, string> = {
  published: "Published by the vendor",
  listing: "From a listing site",
  inferred: "Estimated from reviews",
};

export { PRICE_CONFIDENCE_LABELS };

export const VENDOR_FILTERS: Partial<Record<VendorType, FilterDef[]>> = {
  venue: [
    {
      key: "capacity_max",
      label: "Guest count",
      kind: "range",
      mode: "point",
      unit: "guests",
      hint: "Venues that seat your party, without dwarfing it.",
    },
    {
      key: "setting",
      label: "Setting",
      kind: "multi",
      options: opt({
        mountain: "Mountain",
        ranch: "Ranch",
        garden: "Garden",
        barn_rustic: "Barn / rustic",
        waterfront: "Waterfront",
        historic_estate: "Historic estate",
        hotel_ballroom: "Hotel ballroom",
        urban_industrial: "Urban / industrial",
        golf_country_club: "Golf & country club",
        church_chapel: "Church / chapel",
        museum_gallery: "Museum / gallery",
        winery_brewery: "Winery / brewery",
      }),
    },
    {
      key: "price",
      label: "Venue fee",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      basis: "package",
      // The conversion the sheet's footnote promises the couple. Only these two
      // bases are convertible: `per_night` is a hotel room rate that happens to
      // sit on a venue row, and no guest count turns it into a venue fee.
      basisScale: {
        per_person: PRICE_ASSUMPTIONS.guests,
        per_hour: PRICE_ASSUMPTIONS.hours,
      },
      basisNote: `Venues quoting per person are shown at ${PRICE_ASSUMPTIONS.guests} guests, per hour at ${PRICE_ASSUMPTIONS.hours} hours.`,
      rescaledBy: "date_context",
    },
    {
      key: "ceremony_location",
      label: "Ceremony",
      kind: "multi",
      options: opt({ outdoor: "Outdoor", indoor: "Indoor" }),
    },
    {
      key: "catering_policy",
      label: "Catering",
      kind: "multi",
      options: opt({
        outside_allowed: "Outside caterers allowed",
        in_house_required: "In-house required",
        approved_list: "Approved list",
        byo_alcohol: "BYO alcohol",
      }),
    },
    { key: "has_lodging", label: "On-site lodging", kind: "bool" },
    {
      key: "has_getting_ready_suite",
      label: "Getting-ready suite",
      kind: "bool",
      rare: true,
    },
  ],

  photos: [
    {
      key: "style",
      label: "Style",
      kind: "multi",
      options: opt({
        documentary: "Documentary",
        adventure: "Adventure / elopement",
        editorial: "Editorial",
        classic: "Classic",
        film: "Film",
        fine_art: "Fine art",
        light_airy: "Light & airy",
        moody: "Moody",
      }),
    },
    {
      key: "price",
      label: "Package price",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      basis: "package",
    },
    { key: "does_elopements", label: "Elopements", kind: "bool" },
    { key: "travels_destination", label: "Destination weddings", kind: "bool" },
    { key: "includes_engagement", label: "Engagement session included", kind: "bool" },
    { key: "shoots_film", label: "Also shoots film", kind: "bool", rare: true },
    { key: "second_shooter", label: "Second shooter", kind: "bool" },
    {
      key: "turnaround_weeks",
      label: "Delivery time",
      kind: "range",
      mode: "point",
      unit: "weeks",
    },
  ],

  beauty: [
    {
      key: "work_mode",
      label: "Where they work",
      kind: "multi",
      options: opt({ on_location: "Comes to you", in_studio: "In studio" }),
    },
    {
      key: "services",
      label: "Services",
      kind: "multi",
      options: opt({ hair: "Hair", makeup: "Makeup" }),
    },
    {
      key: "bride_price",
      label: "Bride",
      kind: "range",
      mode: "overlap",
      lo: "bride_price_min",
      hi: "bride_price_max",
      unit: "usd",
    },
    {
      key: "party_price",
      label: "Per bridesmaid",
      kind: "range",
      mode: "overlap",
      lo: "party_price_min",
      hi: "party_price_max",
      unit: "usd",
    },
    {
      key: "trial_policy",
      label: "Trial",
      kind: "multi",
      options: opt({ included: "Included", paid: "Paid separately" }),
    },
    { key: "airbrush", label: "Airbrush", kind: "bool", rare: true },
    { key: "textured_hair", label: "Textured hair", kind: "bool", rare: true },
  ],

  band: [
    {
      key: "genre",
      label: "Genre",
      kind: "multi",
      options: opt({
        funk_soul: "Funk & soul",
        variety: "Variety / party",
        classical_strings: "Classical strings",
        rock_covers: "Rock covers",
        pop_top40: "Pop & Top 40",
        jazz_swing: "Jazz & swing",
        country_bluegrass: "Country & bluegrass",
        acoustic_folk: "Acoustic & folk",
        latin: "Latin",
      }),
    },
    {
      key: "ensemble",
      label: "Ensemble size",
      kind: "multi",
      options: opt({
        solo: "Solo",
        duo: "Duo",
        trio: "Trio",
        quartet: "Quartet",
        "5_8_piece": "5–8 piece",
        "9_plus": "9+ piece",
      }),
    },
    {
      key: "instruments",
      label: "Instruments",
      kind: "multi",
      options: opt({
        vocals: "Vocals",
        strings: "Strings",
        guitar: "Guitar",
        brass: "Brass",
        piano: "Piano",
        harp: "Harp",
      }),
    },
    {
      key: "price",
      label: "Price",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      basis: "package",
    },
    { key: "plays_ceremony", label: "Plays the ceremony", kind: "bool" },
    { key: "plays_cocktail", label: "Plays cocktail hour", kind: "bool" },
  ],

  dj: [
    { key: "includes_mc", label: "Emcee included", kind: "bool" },
    {
      key: "price",
      label: "Price",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      basis: "package",
    },
    {
      key: "production",
      label: "Lighting & production",
      kind: "multi",
      options: opt({
        uplighting: "Uplighting",
        dancefloor_lighting: "Dancefloor lighting",
        projection: "Projection",
        fog_haze: "Fog / haze",
        cold_sparks: "Cold sparks",
        live_instrument: "Live instrument add-on",
      }),
    },
    { key: "has_photobooth", label: "Photo booth", kind: "bool", rare: true },
    { key: "plays_ceremony", label: "Plays the ceremony", kind: "bool" },
  ],

  planner: [
    {
      key: "service_tier",
      label: "Service level",
      kind: "multi",
      options: opt({
        full_planning: "Full planning",
        partial_planning: "Partial planning",
        day_of: "Day-of coordination",
        month_of: "Month-of coordination",
        a_la_carte: "A la carte",
      }),
    },
    {
      key: "price",
      label: "Price",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      rescaledBy: "service_tier",
    },
    {
      key: "pricing_model",
      label: "How they charge",
      kind: "multi",
      options: opt({
        flat_fee: "Flat fee",
        hourly: "Hourly",
        percent_of_budget: "% of budget",
      }),
    },
    { key: "offers_design", label: "Design services", kind: "bool" },
  ],

  food: [
    {
      key: "cuisine",
      label: "Cuisine",
      kind: "multi",
      options: opt({
        bbq: "BBQ",
        mexican_latin: "Mexican & Latin",
        italian: "Italian",
        seafood: "Seafood",
        comfort: "Comfort food",
        grazing_charcuterie: "Grazing & charcuterie",
        new_american: "New American",
        asian: "Asian",
        farm_to_table: "Farm to table",
        mediterranean: "Mediterranean",
        french: "French",
        southern: "Southern",
        indian: "Indian",
      }),
    },
    {
      key: "service_style",
      label: "Service style",
      kind: "multi",
      options: opt({
        buffet: "Buffet",
        plated: "Plated",
        drop_off: "Drop-off",
        stations: "Stations",
        passed_apps: "Passed appetizers",
        family_style: "Family style",
        food_truck: "Food truck",
      }),
    },
    {
      key: "dietary",
      label: "Dietary",
      kind: "multi",
      options: opt({
        gluten_free: "Gluten free",
        vegetarian: "Vegetarian",
        vegan: "Vegan",
        allergen_aware: "Allergen aware",
        kosher: "Kosher",
        halal: "Halal",
      }),
    },
    {
      key: "price",
      label: "Per person",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      basis: "per_person",
      // The mirror of the venue conversion, on the same guest count: a caterer
      // quoting a whole-event minimum is divided down onto the per-head axis
      // (Kiara, 2026-08-07). Without it a package quote was simply dropped, so
      // 21 of 56 priced caterers were missing from their own slider.
      //
      // Read the bottom of this axis with care. A real minimum divides into a
      // believable per-head figure ($5,000 -> $50), but the extraction also
      // tags platter and small-order prices `package` — a charcuterie board at
      // $85 becomes $0.85 a head, which is not a wedding quote at any guest
      // count. Those are mis-tagged rows, not a fault in the assumption; the
      // fix belongs in the extraction, not in a floor here that would silently
      // hide them.
      basisScale: { package: 1 / PRICE_ASSUMPTIONS.guests },
      basisNote: `Caterers quoting a package or minimum are divided across ${PRICE_ASSUMPTIONS.guests} guests.`,
    },
    {
      key: "bar_service",
      label: "Bar service",
      kind: "multi",
      rare: true,
      options: opt({
        bartending_only: "Bartending only",
        full_bar: "Full bar",
        byo_allowed: "BYO allowed",
        beer_wine: "Beer & wine",
      }),
    },
    { key: "offers_tasting", label: "Tasting offered", kind: "bool", rare: true },
  ],

  flowers: [
    {
      key: "engagement_model",
      label: "How they work",
      kind: "multi",
      options: opt({
        full_service: "Full service",
        a_la_carte: "A la carte",
      }),
    },
    {
      key: "price",
      label: "Typical spend",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      rescaledBy: "engagement_model",
    },
    {
      key: "style",
      label: "Style",
      kind: "multi",
      options: opt({
        garden_organic: "Garden & organic",
        native_seasonal: "Native & seasonal",
        classic: "Classic",
        bold_colourful: "Bold & colourful",
        modern_minimal: "Modern & minimal",
        dried_preserved: "Dried & preserved",
      }),
    },
    { key: "delivers_installs", label: "Delivery & install", kind: "bool" },
    {
      key: "minimum_spend",
      label: "Minimum spend",
      kind: "range",
      mode: "point",
      unit: "usd",
      hint: "Florists at or below your ceiling.",
    },
    { key: "offers_rentals", label: "Rentals", kind: "bool", rare: true },
  ],

  dress: [
    {
      key: "price",
      label: "Gown price",
      kind: "range",
      mode: "overlap",
      lo: "price_min",
      hi: "price_max",
      unit: "usd",
      basis: "per_gown",
    },
    { key: "off_the_rack", label: "Off the rack", kind: "bool" },
    { key: "sample_sale", label: "Sample sales", kind: "bool", rare: true },
    { key: "size_inclusive", label: "Size inclusive", kind: "bool" },
    { key: "in_house_alterations", label: "In-house alterations", kind: "bool" },
    { key: "trunk_shows", label: "Trunk shows", kind: "bool", rare: true },
  ],

  hotel: [
    {
      key: "block_type",
      label: "Block type",
      kind: "multi",
      options: opt({
        courtesy: "Courtesy (no minimum)",
        guaranteed: "Guaranteed (attrition applies)",
      }),
    },
    {
      key: "parking",
      label: "Parking",
      kind: "multi",
      options: opt({ free: "Free", paid: "Paid", valet: "Valet" }),
    },
    { key: "breakfast_included", label: "Breakfast included", kind: "bool" },
    { key: "has_shuttle", label: "Shuttle", kind: "bool", rare: true },
    { key: "pet_friendly", label: "Pet friendly", kind: "bool", rare: true },
  ],
};

/** Filters for a type, or [] for types with no extraction (currently `other`). */
export function filtersForType(t: VendorType | undefined): FilterDef[] {
  return (t && VENDOR_FILTERS[t]) || [];
}

