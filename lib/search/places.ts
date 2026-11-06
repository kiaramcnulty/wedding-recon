/**
 * The places a couple can pick as their search area when they have no booked
 * venue yet. A fixed Colorado list rather than geocoder type-ahead: the app
 * only covers Colorado, it costs nothing, it answers instantly, and Nominatim
 * (`/api/geocode`) does not permit as-you-type autocomplete.
 *
 * Coordinates are town centres, to two decimals (well under a mile), which is
 * all a 25-mile search needs. Mountain towns are listed on purpose: the
 * question is where the couple wants to marry, not where they live.
 *
 * The list is the fast path, not the whole state: a town that is not on it
 * (Marble was the first one reported, 2026-11-06) is found by the one-shot
 * Colorado lookup in the city step, which calls `/api/geocode` on a tap or
 * Enter, never per keystroke.
 */

/** Case- and accent-insensitive form for matching ("canon" finds Cañon City). */
export function foldPlaceName(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export interface PlaceOption {
  label: string;
  region: "Denver metro" | "Front Range" | "Mountains" | "Western & southern CO";
  lat: number;
  lng: number;
}

export const COLORADO_PLACES: readonly PlaceOption[] = [
  { label: "Denver", region: "Denver metro", lat: 39.74, lng: -104.99 },
  { label: "Arvada", region: "Denver metro", lat: 39.8, lng: -105.09 },
  { label: "Aurora", region: "Denver metro", lat: 39.73, lng: -104.83 },
  { label: "Brighton", region: "Denver metro", lat: 39.99, lng: -104.82 },
  { label: "Broomfield", region: "Denver metro", lat: 39.92, lng: -105.09 },
  { label: "Castle Rock", region: "Denver metro", lat: 39.37, lng: -104.86 },
  { label: "Centennial", region: "Denver metro", lat: 39.58, lng: -104.88 },
  { label: "Elizabeth", region: "Denver metro", lat: 39.36, lng: -104.6 },
  { label: "Englewood", region: "Denver metro", lat: 39.65, lng: -104.99 },
  { label: "Golden", region: "Denver metro", lat: 39.76, lng: -105.22 },
  { label: "Highlands Ranch", region: "Denver metro", lat: 39.55, lng: -104.97 },
  { label: "Lakewood", region: "Denver metro", lat: 39.7, lng: -105.08 },
  { label: "Larkspur", region: "Denver metro", lat: 39.23, lng: -104.89 },
  { label: "Littleton", region: "Denver metro", lat: 39.61, lng: -105.02 },
  { label: "Morrison", region: "Denver metro", lat: 39.65, lng: -105.19 },
  { label: "Parker", region: "Denver metro", lat: 39.52, lng: -104.76 },
  { label: "Sedalia", region: "Denver metro", lat: 39.44, lng: -104.96 },
  { label: "Thornton", region: "Denver metro", lat: 39.87, lng: -104.97 },
  { label: "Westminster", region: "Denver metro", lat: 39.84, lng: -105.04 },
  { label: "Berthoud", region: "Front Range", lat: 40.31, lng: -105.08 },
  { label: "Boulder", region: "Front Range", lat: 40.01, lng: -105.27 },
  { label: "Cañon City", region: "Front Range", lat: 38.44, lng: -105.24 },
  { label: "Colorado Springs", region: "Front Range", lat: 38.83, lng: -104.82 },
  { label: "Erie", region: "Front Range", lat: 40.05, lng: -105.05 },
  { label: "Fort Collins", region: "Front Range", lat: 40.59, lng: -105.08 },
  { label: "Greeley", region: "Front Range", lat: 40.42, lng: -104.71 },
  { label: "Lafayette", region: "Front Range", lat: 39.99, lng: -105.09 },
  { label: "Longmont", region: "Front Range", lat: 40.17, lng: -105.1 },
  { label: "Louisville", region: "Front Range", lat: 39.98, lng: -105.13 },
  { label: "Loveland", region: "Front Range", lat: 40.4, lng: -105.07 },
  { label: "Lyons", region: "Front Range", lat: 40.22, lng: -105.27 },
  { label: "Manitou Springs", region: "Front Range", lat: 38.86, lng: -104.92 },
  { label: "Monument", region: "Front Range", lat: 39.09, lng: -104.87 },
  { label: "Pueblo", region: "Front Range", lat: 38.25, lng: -104.61 },
  { label: "Superior", region: "Front Range", lat: 39.95, lng: -105.17 },
  { label: "Windsor", region: "Front Range", lat: 40.48, lng: -104.9 },
  { label: "Aspen", region: "Mountains", lat: 39.19, lng: -106.82 },
  { label: "Avon", region: "Mountains", lat: 39.63, lng: -106.52 },
  { label: "Bailey", region: "Mountains", lat: 39.41, lng: -105.47 },
  { label: "Beaver Creek", region: "Mountains", lat: 39.6, lng: -106.52 },
  { label: "Black Hawk", region: "Mountains", lat: 39.8, lng: -105.49 },
  { label: "Breckenridge", region: "Mountains", lat: 39.48, lng: -106.04 },
  { label: "Buena Vista", region: "Mountains", lat: 38.84, lng: -106.13 },
  { label: "Central City", region: "Mountains", lat: 39.8, lng: -105.51 },
  { label: "Conifer", region: "Mountains", lat: 39.52, lng: -105.3 },
  { label: "Crested Butte", region: "Mountains", lat: 38.87, lng: -106.99 },
  { label: "Cripple Creek", region: "Mountains", lat: 38.75, lng: -105.18 },
  { label: "Dillon", region: "Mountains", lat: 39.63, lng: -106.04 },
  { label: "Edwards", region: "Mountains", lat: 39.64, lng: -106.59 },
  { label: "Estes Park", region: "Mountains", lat: 40.38, lng: -105.52 },
  { label: "Evergreen", region: "Mountains", lat: 39.63, lng: -105.32 },
  { label: "Fairplay", region: "Mountains", lat: 39.22, lng: -106 },
  { label: "Fraser", region: "Mountains", lat: 39.94, lng: -105.82 },
  { label: "Frisco", region: "Mountains", lat: 39.57, lng: -106.1 },
  { label: "Georgetown", region: "Mountains", lat: 39.71, lng: -105.7 },
  { label: "Granby", region: "Mountains", lat: 40.09, lng: -105.94 },
  { label: "Grand Lake", region: "Mountains", lat: 40.25, lng: -105.82 },
  { label: "Gunnison", region: "Mountains", lat: 38.55, lng: -106.93 },
  { label: "Idaho Springs", region: "Mountains", lat: 39.74, lng: -105.51 },
  { label: "Keystone", region: "Mountains", lat: 39.6, lng: -105.97 },
  { label: "Leadville", region: "Mountains", lat: 39.25, lng: -106.29 },
  { label: "Nederland", region: "Mountains", lat: 39.96, lng: -105.51 },
  { label: "Salida", region: "Mountains", lat: 38.53, lng: -105.99 },
  { label: "Silverthorne", region: "Mountains", lat: 39.63, lng: -106.07 },
  { label: "Snowmass Village", region: "Mountains", lat: 39.21, lng: -106.95 },
  { label: "Steamboat Springs", region: "Mountains", lat: 40.48, lng: -106.83 },
  { label: "Telluride", region: "Mountains", lat: 37.94, lng: -107.81 },
  { label: "Vail", region: "Mountains", lat: 39.64, lng: -106.37 },
  { label: "Winter Park", region: "Mountains", lat: 39.89, lng: -105.76 },
  { label: "Woodland Park", region: "Mountains", lat: 38.99, lng: -105.06 },
  { label: "Alamosa", region: "Western & southern CO", lat: 37.47, lng: -105.87 },
  { label: "Basalt", region: "Western & southern CO", lat: 39.37, lng: -107.03 },
  { label: "Carbondale", region: "Western & southern CO", lat: 39.4, lng: -107.21 },
  { label: "Cortez", region: "Western & southern CO", lat: 37.35, lng: -108.59 },
  { label: "Crestone", region: "Western & southern CO", lat: 37.99, lng: -105.7 },
  { label: "Delta", region: "Western & southern CO", lat: 38.74, lng: -108.07 },
  { label: "Durango", region: "Western & southern CO", lat: 37.28, lng: -107.88 },
  { label: "Fruita", region: "Western & southern CO", lat: 39.16, lng: -108.73 },
  { label: "Glenwood Springs", region: "Western & southern CO", lat: 39.55, lng: -107.32 },
  { label: "Grand Junction", region: "Western & southern CO", lat: 39.06, lng: -108.55 },
  { label: "Lake City", region: "Western & southern CO", lat: 38.03, lng: -107.32 },
  { label: "Mancos", region: "Western & southern CO", lat: 37.35, lng: -108.29 },
  { label: "Marble", region: "Western & southern CO", lat: 39.07, lng: -107.19 },
  { label: "Montrose", region: "Western & southern CO", lat: 38.48, lng: -107.88 },
  { label: "Ouray", region: "Western & southern CO", lat: 38.02, lng: -107.67 },
  { label: "Pagosa Springs", region: "Western & southern CO", lat: 37.27, lng: -107.01 },
  { label: "Palisade", region: "Western & southern CO", lat: 39.11, lng: -108.35 },
  { label: "Paonia", region: "Western & southern CO", lat: 38.87, lng: -107.59 },
  { label: "Redstone", region: "Western & southern CO", lat: 39.18, lng: -107.24 },
  { label: "Ridgway", region: "Western & southern CO", lat: 38.15, lng: -107.76 },
  { label: "Rifle", region: "Western & southern CO", lat: 39.53, lng: -107.78 },
  { label: "Silverton", region: "Western & southern CO", lat: 37.81, lng: -107.66 },
  { label: "Trinidad", region: "Western & southern CO", lat: 37.17, lng: -104.51 },
  { label: "Westcliffe", region: "Western & southern CO", lat: 38.13, lng: -105.47 },
];
