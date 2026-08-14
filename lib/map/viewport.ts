/**
 * Web Mercator viewport math, so the Explore map can ask for its vendors BEFORE
 * MapLibre exists.
 *
 * The map used to fetch inside `map.on("load")`, which put the vendor query at
 * the end of a long serial chain: download the ~1 MB MapLibre chunk, construct
 * the map, fetch the basemap style from a third-party CDN, parse it, fire
 * `load`, and only then ask Supabase for pins. Measured on a 4x-CPU / 1.6 Mbps
 * / 150 ms profile, the style request had not even STARTED until +5.9 s.
 *
 * None of that is a real dependency — the query only needs a bounding box, and
 * the box is a pure function of the initial center, zoom and container size,
 * all of which are known at mount. Computing it here lets the request go out in
 * parallel with the MapLibre download instead of behind it.
 *
 * MapLibre's transform uses 512 px tiles, so the world is `512 * 2^zoom` CSS
 * pixels across. These match `map.getBounds()` closely enough that the caller's
 * padding (half a viewport on each side) absorbs any residual difference.
 */

const TILE_SIZE = 512;
/** Mercator cannot represent the poles; MapLibre clamps latitude here too. */
const MAX_LAT = 85.051129;

/** Latitude -> normalized Mercator y in [0, 1] (0 at the north edge). */
function mercatorYFromLat(lat: number): number {
  const clamped = Math.min(Math.max(lat, -MAX_LAT), MAX_LAT);
  return (
    (180 -
      (180 / Math.PI) *
        Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))) /
    360
  );
}

/** Inverse of the above. */
function latFromMercatorY(y: number): number {
  return (
    (360 / Math.PI) * Math.atan(Math.exp((180 - y * 360) * (Math.PI / 180))) - 90
  );
}

export interface ViewportBbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * The geographic bounds a map of `widthPx` x `heightPx` shows when centered on
 * `[lng, lat]` at `zoom`. Returns null for a container that has not been laid
 * out yet, so the caller can simply fall back to fetching after map load.
 */
export function bboxForView(
  lng: number,
  lat: number,
  zoom: number,
  widthPx: number,
  heightPx: number,
): ViewportBbox | null {
  if (!(widthPx > 0) || !(heightPx > 0) || !Number.isFinite(zoom)) return null;

  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const halfWidthFrac = widthPx / 2 / worldSize;
  const halfHeightFrac = heightPx / 2 / worldSize;

  const centerY = mercatorYFromLat(lat);
  // y grows southward, so the north edge is the SMALLER y.
  const maxLat = latFromMercatorY(Math.max(centerY - halfHeightFrac, 0));
  const minLat = latFromMercatorY(Math.min(centerY + halfHeightFrac, 1));

  return {
    minLng: lng - halfWidthFrac * 360,
    maxLng: lng + halfWidthFrac * 360,
    minLat,
    maxLat,
  };
}

/**
 * Grow a box by `factor` of its own span on each side. The map fetches a padded
 * area so small pans land inside already-fetched ground; keeping the padding
 * here means the prefetch and the post-load refetch agree on what "covered"
 * means, which is what lets the prefetch satisfy the map's own first request.
 */
export function padBbox(box: ViewportBbox, factor: number): ViewportBbox {
  const lngPad = (box.maxLng - box.minLng) * factor;
  const latPad = (box.maxLat - box.minLat) * factor;
  return {
    minLng: box.minLng - lngPad,
    maxLng: box.maxLng + lngPad,
    minLat: Math.max(box.minLat - latPad, -85),
    maxLat: Math.min(box.maxLat + latPad, 85),
  };
}

/**
 * How many grid cells a fetched box should span. Smaller means a finer grid:
 * less over-fetch, but fewer viewports snap together, so fewer cross-visitor
 * cache hits. Four keeps the extra area modest on top of the padding the caller
 * already applied.
 */
const SNAP_TARGET_CELLS = 4;

/** Round to a "nice" 1/2/5 x 10^k value so a small change in `x` keeps one step. */
function niceStep(x: number): number {
  if (!(x > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / magnitude; // in [1, 10)
  const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nice * magnitude;
}

/** Kill float noise (…0000001) so grid-aligned coords serialize to one string. */
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/**
 * Snap a box OUTWARD to a shared lng/lat grid, so nearby viewports — different
 * device widths on the same default view, a small pan — resolve to the SAME box
 * and therefore the same request URL.
 *
 * This is what makes an edge cache in front of the pin query worth anything:
 * without it every viewport is a unique float bbox, the CDN cache key never
 * repeats, and the hit rate is ~0%. With it, a wave of visitors all landing on
 * the default Denver view collapses to one cached response instead of one DB
 * query each — the exact shape of the 2026-08-14 traffic spike.
 *
 * The step scales with the box (a fixed-degree grid would be far too coarse when
 * zoomed in), and the result always CONTAINS the input, so the map still gets
 * every pin in view — it just fetches a slightly larger, grid-aligned area.
 */
export function snapBbox(box: ViewportBbox): ViewportBbox {
  const span = Math.max(box.maxLng - box.minLng, box.maxLat - box.minLat);
  const step = niceStep(span / SNAP_TARGET_CELLS);
  return {
    minLng: round6(Math.floor(box.minLng / step) * step),
    minLat: round6(Math.max(Math.floor(box.minLat / step) * step, -85)),
    maxLng: round6(Math.ceil(box.maxLng / step) * step),
    maxLat: round6(Math.min(Math.ceil(box.maxLat / step) * step, 85)),
  };
}
