/**
 * The Explore map's remembered view, per tab (sessionStorage). Explore writes
 * it on every settled move and reads it once when it mounts, so returning to
 * the map lands where the couple left it.
 *
 * Other screens can hand Explore a starting view by writing it here just before
 * they link to /explore: the guided journey does this so "Browse the map
 * instead" opens on the couple's venue or town, not on Denver. Deliberately not
 * a URL parameter: page URLs go to analytics, and the journey keeps a couple's
 * location out of analytics.
 */
export const MAP_VIEW_KEY = "wr:mapView";

export type MapView = { center: [number, number]; zoom: number };

export function writeMapView(view: MapView): void {
  try {
    sessionStorage.setItem(MAP_VIEW_KEY, JSON.stringify(view));
  } catch {
    // sessionStorage unavailable (e.g. private mode): the map opens on its default.
  }
}

/**
 * The place Explore searches around (the centre of its radius ring), per tab.
 * `label` names it in the search bar ("Venues near Vail"); null for a spot
 * picked with "Search this area". Same handoff rule as the map view: the
 * journey writes it before linking to /explore, never as a URL parameter.
 */
export const EXPLORE_ANCHOR_KEY = "wr:exploreAnchor";
/** Explore's distance setting, per tab. A new anchor resets it to automatic. */
export const EXPLORE_RADIUS_KEY = "wr:exploreRadius";

export type ExploreAnchor = { lat: number; lng: number; label: string | null };

export function writeExploreAnchor(anchor: ExploreAnchor): void {
  try {
    sessionStorage.setItem(EXPLORE_ANCHOR_KEY, JSON.stringify(anchor));
    // A manual distance belonged to the old place: back to automatic.
    sessionStorage.removeItem(EXPLORE_RADIUS_KEY);
  } catch {
    // sessionStorage unavailable: Explore searches around the journey or Denver.
  }
}

export function readExploreAnchor(): ExploreAnchor | null {
  try {
    const raw = sessionStorage.getItem(EXPLORE_ANCHOR_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Partial<ExploreAnchor>;
    if (typeof a.lat !== "number" || typeof a.lng !== "number" || !Number.isFinite(a.lat) || !Number.isFinite(a.lng)) {
      return null;
    }
    return { lat: a.lat, lng: a.lng, label: typeof a.label === "string" ? a.label : null };
  } catch {
    return null;
  }
}
