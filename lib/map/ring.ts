/**
 * The search-radius ring on the journey map: a real geographic circle, drawn
 * as a GeoJSON polygon. Not a MapLibre `circle` layer, whose radius is in
 * screen pixels, so it would show the same size at every zoom and match no
 * real distance (docs/customer-journey-implementation-plan.md, Milestone 5).
 *
 * Pure and dependency-free so `scripts/test-guided-search.mjs` can check it.
 */

const EARTH_RADIUS_MILES = 3958.8;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const METERS_PER_MILE = 1609.344;
/** MapLibre lays the world out on 512-pixel tiles. */
const TILE_PX = 512;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Points on the great circle `miles` from the centre, every 360/steps degrees
 * of bearing. Closed (first point repeated last), as a GeoJSON ring must be.
 */
export function ringCoordinates(
  lng: number,
  lat: number,
  miles: number,
  steps = 72,
): [number, number][] {
  const d = miles / EARTH_RADIUS_MILES;
  const lat1 = rad(lat);
  const lng1 = rad(lng);
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const brg = rad((360 * (i % steps)) / steps);
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );
    // Normalise to [-180, 180) so a ring near the antimeridian stays valid.
    out.push([((deg(lng2) + 540) % 360) - 180, deg(lat2)]);
  }
  return out;
}

export function ringFeature(lng: number, lat: number, miles: number): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ringCoordinates(lng, lat, miles)] },
  };
}

/**
 * The zoom at which a `miles` ring fits inside a `widthPx` x `heightPx` map
 * with `padRatio` breathing room (1.15 = 15% wider than the ring). Web
 * Mercator: metres per pixel = circumference * cos(lat) / (512 * 2^zoom).
 */
export function zoomToFitRing(
  lat: number,
  miles: number,
  widthPx: number,
  heightPx: number,
  padRatio = 1.15,
): number {
  const fitPx = Math.max(1, Math.min(widthPx, heightPx));
  const diameterM = 2 * miles * METERS_PER_MILE * padRatio;
  const z = Math.log2((EARTH_CIRCUMFERENCE_M * Math.cos(rad(lat)) * fitPx) / (TILE_PX * diameterM));
  return Math.min(14, Math.max(3, z));
}
