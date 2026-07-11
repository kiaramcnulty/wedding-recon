# Spec: map marker clustering (perf round 2)

> **Built (2026-07-11), decisions resolved:** clusters are **segmented by vendor
> type** — each type gets its own clustered source and a category-colored bubble
> (icon above the count), not one neutral grey cluster. Co-located type-clusters
> splay via a small per-type "rosette" screen offset. Other resolved calls: row
> cap raised to 5000 (no RPC migration); no hover-grow; `clusterRadius: 50`,
> `clusterMaxZoom: 14`. The "one source, neutral grey clusters" description below
> is the original proposal — kept for context; the per-type design supersedes it.

**Status:** DRAFT for Kiara's review. Do not build until approved. This is the
deferred "round 2" from `docs/perf-plan-map-vendor-page.md` — the proper fix
for the two things the round-1 stopgaps only patched:

1. **Low-zoom marker lag.** Round 1 renders every vendor as its own DOM
   `maplibre-gl.Marker`. MapLibre repositions each element on every animation
   frame, so a few hundred pins at metro zoom is the ceiling. Clustering
   renders on the GPU and collapses dense areas into a handful of circles.
2. **"Dead spots" (Thornton).** Root cause is `vendors_in_bbox` truncating an
   *unordered* result at `MAX_ROWS`, dropping whole pockets. Round 1 raised the
   cap to 1000 as headroom. Clustering lets us render far more points cheaply,
   so we can raise the cap much higher (or remove the client-side pressure
   entirely) without reintroducing lag — see § "Interaction with the row cap".

## The core change

Replace per-vendor DOM markers with **one MapLibre GeoJSON source
(`cluster: true`) feeding three style layers**, all rendered on the GPU:

- `vendor-clusters` — `circle` layer, filtered to features with `point_count`.
  Size + color step up with count (e.g. 1–9 / 10–24 / 25+).
- `vendor-cluster-count` — `symbol` layer, `text-field: {point_count_abbreviated}`.
- `vendor-unclustered` — `symbol` layer for individual pins, using pre-rendered
  category icons (see § "Preserving the pin look").

On each `moveend` we keep the round-1 fetch pipeline unchanged (padded bbox +
coverage cache + debounce) and simply call `source.setData(geojson)` instead of
tearing down and rebuilding DOM markers. A data swap is dramatically cheaper
than N DOM element create/destroy cycles.

## Preserving the pin look (the one non-trivial part)

Today each pin is a colored circle (category `colorHex`) with a white Lucide
icon, and **approximate-location pins get a dashed white outline** instead of a
solid one. A MapLibre `circle` layer can't embed the Lucide glyph or draw a
dashed stroke, so the unclustered layer must be a **`symbol` layer backed by
pre-rendered icon images**:

- On map load, render each category's marker to an offscreen canvas **once** —
  the colored disc + white Lucide icon + white outline — in two variants
  (solid outline, dashed outline). ~12 categories × 2 = ~24 images, registered
  via `map.addImage("pin-<type>-<solid|dashed>", ...)`.
- Each GeoJSON feature carries `properties.icon = "pin-photographer-dashed"`
  (etc.); the symbol layer's `icon-image` reads that property. Pixel-identical
  to today's pins, but GPU-drawn.
- This also **retires `renderToStaticMarkup` from the render hot path** (round-1
  note flagged it as wasteful): we rasterize each category once at startup
  instead of per pin per refresh.

The existing category → color/icon mapping stays sourced from
`lib/constants/categories.ts` (`CATEGORIES`) — no hardcoded colors, per the
repo contract.

## Fan-out for stacked approximate pins

`resolveDisplayPositions()` (the deterministic phyllotaxis fan-out for pins
sharing a coordinate) is **kept as-is** and applied when we build the GeoJSON —
we fan out the feature coordinates before handing them to the cluster source.
At low zoom those fanned pins cluster together anyway; past `clusterMaxZoom`
they separate exactly as they do now. No behavior change.

## Interaction (replaces per-marker listeners)

- **Click a cluster** → `getClusterExpansionZoom()` then `map.easeTo()` to zoom
  into it. One `click` handler on `vendor-clusters`.
- **Click a pin** → `router.push('/vendor/' + feature.properties.id)`. One
  `click` handler on `vendor-unclustered` (replaces the per-element listeners).
- **Cursor** → pointer on `mouseenter` of both layers, default on `mouseleave`.
- **Hover grow** (the current `scale(1.18)` on hover): optional. With a symbol
  layer this needs `feature-state` + an `icon-size` expression. Minor polish;
  flagged as a decision below, default = drop it to keep the first cut simple.

## Interaction with the row cap (dead spots)

Clustering is **client-side** — we still fetch individual vendor rows, so the
unordered `MAX_ROWS` truncation in `vendors_in_bbox` is still the thing that
drops geographic pockets. Clustering doesn't fix that by itself; it makes it
*cheap to raise the cap* because rendering thousands of points is no longer a
DOM cost. Two options, decision below:

- **(A) Just raise `MAX_ROWS`** (e.g. 5000) now that render cost is gone.
  Simple; fine until a single viewport truly exceeds it.
- **(B) Add `order by` to the RPC** (new migration) so truncation, when it
  happens, is at least spatially deterministic (e.g. order by distance from
  bbox center). Belt-and-suspenders; still drops the farthest pins but never
  arbitrarily.

Recommend **(A) for this PR**, note (B) as a future option. Genuinely dense
regions (multiple metros in view) would eventually want **server-side**
clustering (PostGIS `ST_ClusterDBSCAN` via a new RPC) — explicitly out of scope
here; client-side MapLibre clustering covers the soft-launch and well beyond.

## Files touched

- `components/map/vendor-map.tsx` — the whole marker subsystem: remove
  `buildMarkerElement` + the DOM-marker refs/loop; add image pre-rendering,
  the source + 3 layers, `setData` refresh, and the two layer click handlers.
  Keep `refreshMarkers`'s fetch/cache logic, `resolveDisplayPositions`,
  `isApproximateLocation`, `fanOutOffset`, and the `flyTo` effect.
- Possibly a small `lib/map/pin-images.ts` helper for the canvas rasterization,
  to keep the component readable.
- No DB migration for option (A). No changes to the RPC, categories, or types.

## Acceptance / verification

- `npm run build` + `npm run lint` pass.
- **Behavior (validate on the Vercel preview — the CI sandbox can't reach the
  tile host or Supabase):**
  - [ ] Dense metro zoom shows clusters with counts; zoom in splits them down
        to individual pins; fully zoomed in matches today's pins pixel-for-pixel
        (color, icon, dashed outline on approximate).
  - [ ] Clicking a cluster zooms into it; clicking a pin opens the vendor page.
  - [ ] No dead spots at any zoom for the Denver data.
  - [ ] Pan/zoom is smooth at the fully-zoomed-out (whole-region) view — the
        round-1 DOM ceiling is gone.
  - [ ] Approximate stacked pins still fan out at high zoom.

## Open decisions for Kiara (blocking the build)

1. **Cluster circle style** — neutral grey discs with a count (recommended, a
   cluster can mix categories), or something more branded?
2. **Row cap** — go with option (A) raise `MAX_ROWS` to ~5000, or also do (B)
   ordered truncation via a migration now?
3. **Hover-grow on pins** — keep the current scale-on-hover effect (small extra
   complexity with symbol layers) or drop it for the first cut?
4. **Cluster tuning** — defaults `clusterRadius: 50`, `clusterMaxZoom: 14` are a
   sensible start; flag if you want tighter/looser grouping.

Once these are settled I'll build it on this branch and open one PR.
