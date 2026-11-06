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
