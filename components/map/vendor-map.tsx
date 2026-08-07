"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import { type Vendor } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  registerPinImages,
  pinImageId,
  clusterImageId,
} from "@/lib/map/pin-images";
import { isApproximateLocation } from "@/lib/map/vendor-location";
import { bboxForView, padBbox, type ViewportBbox } from "@/lib/map/viewport";
import {
  filterRankFor,
  filterMatchFor,
  matchedFraction,
  hasAnySelection,
  type FilterMatchDetail,
  type FilterSelections,
} from "@/lib/filters/match";

// MapLibre is browser-only; import deferred to effects.
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

// Denver, CO
const DEFAULT_CENTER: [number, number] = [-104.9903, 39.7392];
const DEFAULT_ZOOM = 9;
const DEBOUNCE_MS = 150;
// Upper bound on pins per fetch. vendors_in_bbox has no ORDER BY, so if a fetch
// box holds more than this, Postgres returns an arbitrary subset and whole
// pockets silently drop out. Pins now render on the GPU via clustered symbol
// layers (not DOM markers), so a high cap is cheap — keep it well above any
// single launched region's vendor count. Genuinely dense multi-metro views would
// want server-side clustering (PostGIS), out of scope here.
const MAX_ROWS = 5000;

// Fetch beyond the viewport so small pans land inside already-fetched area.
const BBOX_PAD_FACTOR = 0.5; // half a viewport-span extra on each side

// Clustering is per GeoJSON source and can't segment by a property, so each
// vendor type gets its OWN clustered source + layers. That yields per-type
// clusters (a green "5 venues" bubble next to a blue "10 photographers" bubble)
// instead of one mixed grey blob.
const srcId = (t: VendorType) => `vendors-${t}`;
const clusterLayerId = (t: VendorType) => `clusters-${t}`;
const pinLayerId = (t: VendorType) => `pins-${t}`;

const CLUSTER_RADIUS = 50;
const CLUSTER_MAX_ZOOM = 14;

// Zoom at which pins start carrying their vendor's name. Set BELOW
// CLUSTER_MAX_ZOOM so names appear earlier on the way in, while cluster bubbles
// are still around. That's safe because the pin layer is filtered to
// unclustered points (`["!", ["has", "point_count"]]`), so anything wearing a
// label is a single vendor either way — a label can never be mistaken for a
// group's. What it costs is density: at these zooms the survivors are the
// isolated pins between clusters, and `text-optional` + no-overlap collide-drops
// the rest, so a crowded area quietly shows fewer names rather than a mess.
// Still at/below the zoom a vendor search flies to, so a searched pin arrives
// named.
const LABEL_MIN_ZOOM = 12;

// Bottom strip of the map the open preview card sits over (the card plus the
// control row and attribution gap beneath it). A tapped pin landing inside it
// gets panned up so the card never covers the pin it describes.
const PREVIEW_SAFE_PX = 300;

// How many on-screen vendors the map hands to the "see all results" list. The
// full count is always reported (the pill must not lie), but the id list is
// capped: the list sheet's preview fetch puts every id in one PostgREST `in.()`
// filter, and a few thousand uuids would blow past the URL limit long before the
// feed became browsable. The nearest-to-center rows are kept, so zooming out
// past the cap degrades to "the closest N" rather than an arbitrary subset.
const MAX_VISIBLE_ENTRIES = 200;

// What every vendor scores when no attribute filter is active: a full match,
// nothing asked, nothing missing. Hoisted so the hot loop does not allocate one
// per row per pan.
const UNFILTERED_MATCH: FilterMatchDetail = { rank: 1, unknown: 0, active: 0 };

// Label sizes: the selected pin's name is set larger than its neighbours', and
// offset further down to clear its bigger disc (offsets are in ems of text-size).
const LABEL_SIZE = 11;
const SELECTED_LABEL_SIZE = 13;
const LABEL_OFFSET: [number, number] = [0, 1.7];
const SELECTED_LABEL_OFFSET: [number, number] = [0, 2];

type Expr = import("maplibre-gl").ExpressionSpecification;

/** `["case", <feature is the selected vendor>, whenSelected, otherwise]`. */
function whenSelected(selectedId: string, whenTrue: unknown, whenFalse: unknown) {
  return ["case", ["==", ["get", "id"], selectedId], whenTrue, whenFalse] as Expr;
}

/**
 * How far a rank-0 pin recedes. It is silent on something the couple filtered
 * for, not a miss, so it stays on the map — but well back, so the pins that DO
 * match read as the answer and these as texture behind them.
 *
 * The label goes fainter than the disc rather than tracking it. A disc is a
 * shape and survives being pale; text at low opacity fades its white halo too,
 * so it stops being legible while still adding clutter — and the name is the
 * least useful thing about a vendor whose attributes are unknown anyway.
 */
const PARTIAL_ICON_OPACITY = 0.22;
const PARTIAL_LABEL_OPACITY = 0.28;

/**
 * The paint properties that depend on the selection: opacity.
 *
 * The SELECTED pin is always fully opaque whatever its rank. Without that, at
 * these opacities, tapping a faded pin opens its card next to a ghost — the one
 * pin the couple has actively asked about, and the only one the card refers to.
 * The rank fade is the resting state, not a permanent handicap.
 */
function selectionPaint(selectedId: string | null) {
  const faded = (partial: number) =>
    (selectedId
      ? whenSelected(selectedId, 1, ["case", ["==", ["get", "rank"], 0], partial, 1])
      : ["case", ["==", ["get", "rank"], 0], partial, 1]) as Expr;
  return {
    "icon-opacity": faded(PARTIAL_ICON_OPACITY),
    "text-opacity": faded(PARTIAL_LABEL_OPACITY),
  };
}

/**
 * The layout properties that depend on which vendor's preview is open. The pin
 * whose card is showing swaps to its emphasized image (bigger disc + a ring — see
 * `pin-images.ts`) and gets a larger name label at ANY zoom, so it's obvious which
 * pin the card belongs to. Every other pin keeps the plain treatment.
 *
 * `text-field` carries the zoom rule too: the name shows from LABEL_MIN_ZOOM up,
 * and below that only for the selected pin. The zoom test sits at the OUTERMOST
 * level, which is what lets a layout property mix zoom with a per-feature lookup.
 */
function selectionLayout(selectedId: string | null) {
  return {
    "icon-image": selectedId
      ? whenSelected(selectedId, ["get", "iconSelected"], ["get", "icon"])
      : (["get", "icon"] as Expr),
    "text-field": [
      "step",
      ["zoom"],
      selectedId ? whenSelected(selectedId, ["get", "name"], "") : "",
      LABEL_MIN_ZOOM,
      ["get", "name"],
    ] as Expr,
    "text-size": selectedId
      ? whenSelected(selectedId, SELECTED_LABEL_SIZE, LABEL_SIZE)
      : LABEL_SIZE,
    "text-offset": selectedId
      ? whenSelected(
          selectedId,
          ["literal", SELECTED_LABEL_OFFSET],
          ["literal", LABEL_OFFSET],
        )
      : LABEL_OFFSET,
  };
}

// Co-located type-clusters (e.g. venues + photographers downtown) would stack on
// top of each other. Give each type a small fixed screen offset arranged on a
// ring, so overlapping type-clusters splay into a tidy rosette instead of piling
// up. Sized so two big co-located discs stay separately readable; an isolated
// cluster sits within the ~50px area it already represents, so the offset reads
// as intentional rather than misplaced.
const ROSETTE_RADIUS_PX = 18;
const CLUSTER_OFFSET: Record<VendorType, [number, number]> = Object.fromEntries(
  VENDOR_TYPES.map((t, i) => {
    const angle = (i / VENDOR_TYPES.length) * 2 * Math.PI;
    return [
      t,
      [
        Math.round(Math.cos(angle) * ROSETTE_RADIUS_PX),
        Math.round(Math.sin(angle) * ROSETTE_RADIUS_PX),
      ],
    ];
  }),
) as Record<VendorType, [number, number]>;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Normalize any vendor_type to one of our known category buckets. */
function bucketType(vendorType: string): VendorType {
  return (VENDOR_TYPES as readonly string[]).includes(vendorType)
    ? (vendorType as VendorType)
    : "other";
}

// The approximate-location heuristic that drives the dashed pin outline lives in
// lib/map/vendor-location.ts — the vendor page's mini-map draws the same pin and
// has to reach the same verdict.

// Deterministic "fan out" for pins that share an (approximate) coordinate.
// Identical centroids never separate under plain clustering, so we scatter a
// colliding group across a compact sunflower/phyllotaxis disc: even density,
// stable per-index, and tight enough to still read as "somewhere in this area".
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996 rad
const FAN_SPREAD_M = 110; // base spacing between successive fanned pins (meters)

/** Geographic offset (in degrees) for the i-th pin of a colliding group. */
function fanOutOffset(index: number, lat: number): { dLng: number; dLat: number } {
  if (index === 0) return { dLng: 0, dLat: 0 }; // one stays on the centroid
  const radius = FAN_SPREAD_M * Math.sqrt(index); // meters from centroid
  const theta = index * GOLDEN_ANGLE;
  const east = radius * Math.cos(theta);
  const north = radius * Math.sin(theta);
  return {
    dLat: north / 111_320,
    dLng: east / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

/**
 * Resolve each vendor's display position. Vendors are grouped by rounded
 * coordinate (~11m) ACROSS types; any group with more than one member is fanned
 * out so pins (even of different types) don't stack. Single pins keep their exact
 * coordinate.
 */
function resolveDisplayPositions(
  vendors: Vendor[],
): Map<string, { lng: number; lat: number }> {
  const groups = new Map<string, Vendor[]>();
  for (const v of vendors) {
    if (v.lng == null || v.lat == null) continue;
    const key = `${v.lng.toFixed(4)},${v.lat.toFixed(4)}`;
    const arr = groups.get(key);
    if (arr) arr.push(v);
    else groups.set(key, [v]);
  }

  const positions = new Map<string, { lng: number; lat: number }>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      const v = group[0];
      positions.set(v.id, { lng: v.lng!, lat: v.lat! });
      continue;
    }
    // Stable order → a vendor keeps the same offset across refreshes/pans.
    group.sort((a, b) => a.id.localeCompare(b.id));
    group.forEach((v, i) => {
      const { dLng, dLat } = fanOutOffset(i, v.lat!);
      positions.set(v.id, { lng: v.lng! + dLng, lat: v.lat! + dLat });
    });
  }
  return positions;
}

/**
 * Bucket vendors into one GeoJSON FeatureCollection per type, using the
 * already-resolved display positions (resolved globally, so cross-type
 * co-located pins still separate) split by type for the per-type clustered
 * sources.
 */
function buildFeatureCollectionsByType(
  vendors: Vendor[],
  positions: Map<string, { lng: number; lat: number }>,
  filterSelections?: FilterSelections,
): Record<VendorType, GeoJSON.FeatureCollection> {
  const byType = Object.fromEntries(
    VENDOR_TYPES.map((t) => [
      t,
      { type: "FeatureCollection", features: [] as GeoJSON.Feature[] },
    ]),
  ) as Record<VendorType, GeoJSON.FeatureCollection>;

  const active = hasAnySelection(filterSelections);

  for (const vendor of vendors) {
    const pos = positions.get(vendor.id);
    if (!pos) continue; // missing coordinates
    // A contradicting vendor is dropped from the source entirely rather than
    // hidden by a layer filter, so the cluster counts drawn on screen agree
    // with the pins — MapLibre clusters the source, not the visible subset.
    const t = bucketType(vendor.vendor_type);
    // Each vendor is judged against ITS OWN type's filters, so several types can
    // be filtered at once without one type's criteria touching another.
    const rank = active ? filterRankFor(t, vendor.filters, filterSelections) : 1;
    if (rank < 0) continue;
    // Migration 0034 computes this server-side (a boolean is far cheaper than
    // the three columns the heuristic reads). Pre-0034 the column is absent and
    // those columns are still present, so fall back to the shared client-side
    // heuristic — the two are deliberate twins.
    const approximate =
      vendor.approximate ?? isApproximateLocation(vendor);
    (byType[t].features as GeoJSON.Feature[]).push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pos.lng, pos.lat] },
      properties: {
        id: vendor.id,
        name: vendor.name,
        icon: pinImageId(t, approximate),
        // Emphasized variant, swapped in while this vendor's preview is open.
        iconSelected: pinImageId(t, approximate, true),
        // 1 matches everything asked, 0 is silent on at least one thing. Drives
        // the faded pin — a vendor nobody has written the answer for is still a
        // real candidate, so it stays on the map rather than vanishing.
        rank,
      },
    });
  }
  return byType;
}

/**
 * Emitted when a cluster pin is tapped: the vendors it contains plus the map
 * view at tap time, so the caller can reopen the same view after a round trip to
 * a vendor page.
 */
export interface ClusterOpenPayload {
  /**
   * The cluster's vendors, each with its match rank, ordered full matches
   * first — the same two-tier ordering `reportVisibleVendors` gives the results
   * feed, so the cluster feed can draw the same divider rather than presenting
   * a demoted vendor as a match.
   */
  entries: ClusterEntry[];
  vendorType: VendorType;
  center: [number, number];
  zoom: number;
}

/** One vendor in a tapped cluster. The type is a per-cluster fact, so it is not repeated per row. */
export interface ClusterEntry {
  id: string;
  /** 1 matches every active attribute filter, 0 is silent on at least one. */
  rank: 0 | 1;
}

/** Emitted when an individual (non-cluster) vendor pin is tapped. */
export interface VendorOpenPayload {
  id: string;
  vendorType: VendorType;
}

/** One vendor currently inside the viewport, in the "see all results" list. */
export interface VisibleVendor {
  id: string;
  vendorType: VendorType;
  /**
   * 1 matches every active attribute filter, 0 is silent on at least one. Lets
   * the list draw its second tier without re-running the matcher, and is always
   * 1 when no attribute filter is active.
   */
  rank: 0 | 1;
}

/**
 * What's on screen right now, after both filters: the true `total`, and the
 * (capped, nearest-center-first) rows a list can actually render. `total` drives
 * the results pill; `entries` is what the list sheet opens on. `partial` is how
 * many of `total` are the faded, missing-information kind.
 */
export interface VisibleVendorsPayload {
  total: number;
  partial: number;
  entries: VisibleVendor[];
}

interface VendorMapProps {
  /** External position to fly to. Pass zoom to override the default (14). */
  flyToPosition?: { lng: number; lat: number; zoom?: number } | null;
  /** The user's geolocated position — rendered as a "you are here" dot. */
  userPosition?: { lng: number; lat: number } | null;
  /**
   * Called when a cluster pin is tapped, with the vendors it contains. When
   * provided, a cluster tap opens this list instead of zooming in.
   */
  onClusterOpen?: (payload: ClusterOpenPayload) => void;
  /**
   * Called when a single vendor pin is tapped. When provided, the tap surfaces a
   * preview (the caller's job) instead of navigating straight to the vendor page.
   */
  onVendorOpen?: (payload: VendorOpenPayload) => void;
  /**
   * Called on a tap that hits no pin and no cluster — i.e. empty map. Lets the
   * caller dismiss an open preview the way Zillow does.
   */
  onBackgroundTap?: () => void;
  /**
   * The vendor whose preview is open. Its pin is enlarged and keeps its name
   * label at any zoom, so the card is visibly tied to a pin.
   */
  selectedVendorId?: string | null;
  /**
   * Called after every map move settles, with the new center/zoom. The caller
   * persists it so returning to Explore — by any route: in-app back, browser/OS
   * back, or the bottom nav — reopens on the same view instead of the default.
   */
  onViewChange?: (view: { center: [number, number]; zoom: number }) => void;
  /**
   * Initial center/zoom — e.g. restoring the view after returning from a vendor
   * page. Read once at map init; later changes are ignored.
   */
  initialView?: { lng: number; lat: number; zoom: number } | null;
  /**
   * Vendor types to show. Empty (the default) shows all. Applied as a per-type
   * layer-visibility toggle — no refetch, since every type already has its own
   * source + layers.
   */
  selectedTypes?: VendorType[];
  /**
   * Attribute filters PER VENDOR TYPE, applied locally against the `filters`
   * each row already carries — no refetch, so a chip tap is instant and the fetched-area cache
   * in `coverageRef` stays valid. A vendor that contradicts the selection is
   * dropped from its source; one that is merely silent is kept and faded.
   */
  filterSelections?: FilterSelections;
  /**
   * Whether this session needs the per-vendor `filters` attributes at all.
   *
   * They are two thirds of the map payload (about 257 of 625 bytes per row,
   * measured over the real corpus) and most sessions never open the filter
   * sheet, so migration 0034 moved them out of `vendors_in_bbox` into their own
   * function. Set this true when the couple opens the sheet — the map then
   * fetches the attributes for the covered area, merges them into the rows it
   * already holds, re-applies, and re-emits via `onVendorsChange`. Once true it
   * should stay true for the session: later pans fetch both together.
   *
   * Leaving it false is safe, not lossy — with no filters loaded every vendor
   * ranks 1 (unfiltered), which is exactly the state a session that never
   * filters is in anyway.
   */
  withFilters?: boolean;
  /**
   * Called whenever the set of vendors inside the viewport changes — on every
   * settled move, after new rows land, and when either filter changes. Drives
   * the "see all N results on screen" pill and the list it opens.
   */
  onVisibleVendorsChange?: (payload: VisibleVendorsPayload) => void;
  /**
   * Called with the raw rows behind the pins whenever a fetch lands. The filter
   * sheet needs the `filters` on them to show live match counts and to rescale
   * its histograms — that data is already in hand, so handing it over avoids a
   * second query for rows the map is holding anyway.
   */
  onVendorsChange?: (vendors: Vendor[]) => void;
}

export function VendorMap({
  flyToPosition,
  userPosition,
  onClusterOpen,
  onVendorOpen,
  onBackgroundTap,
  selectedVendorId,
  onViewChange,
  initialView,
  selectedTypes,
  filterSelections,
  withFilters,
  onVisibleVendorsChange,
  onVendorsChange,
}: VendorMapProps) {
  const router = useRouter();
  // Latest onClusterOpen, callable from the run-once init effect's handlers.
  const onClusterOpenRef = useRef(onClusterOpen);
  // Latest pin-tap / empty-map-tap handlers, same reason.
  const onVendorOpenRef = useRef(onVendorOpen);
  const onBackgroundTapRef = useRef(onBackgroundTap);
  // Latest onViewChange, same reason (init effect wires the moveend handler once).
  const onViewChangeRef = useRef(onViewChange);
  // Latest on-screen-vendors handler, same reason.
  const onVisibleVendorsChangeRef = useRef(onVisibleVendorsChange);
  // Latest raw-rows handler, same reason.
  const onVendorsChangeRef = useRef(onVendorsChange);
  // Latest selection, read by the init effect once the pin layers first exist.
  const selectedVendorIdRef = useRef(selectedVendorId);
  // Captured once — the map reads center/zoom at init only.
  const initialViewRef = useRef(initialView);
  // Latest type filter, read by the init effect once the layers first exist.
  const selectedTypesRef = useRef(selectedTypes);
  // Latest attribute filter, same reason — and read by applyVendors, which runs
  // both on new rows and on a filter change.
  const filterSelectionsRef = useRef(filterSelections);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Rows from the last applied fetch plus their resolved display positions —
  // kept so "what's on screen" can be answered from memory on every move, with
  // no refetch and no dependence on what MapLibre happens to have rasterized.
  const vendorsRef = useRef<Vendor[]>([]);
  const positionsRef = useRef<Map<string, { lng: number; lat: number }>>(
    new Map(),
  );
  // Identity of the last emitted visible set, so an idle pan that changes
  // nothing doesn't push a new array (and a re-render) at the page.
  const lastVisibleKeyRef = useRef<string | null>(null);
  // Area covered by the last *complete* fetch. When the viewport stays inside
  // it, the pins on the map are already correct — skip the refetch.
  const coverageRef = useRef<ViewportBbox | null>(null);
  // Whether this session wants the `filters` attributes at all — read inside the
  // fetch, which is not re-created when the prop changes.
  const withFiltersRef = useRef(withFilters);
  // Area the filter attributes have been loaded for. Tracked separately from
  // `coverageRef` because the two are fetched at different times: pins land
  // immediately, attributes only once the filter sheet is opened.
  const filtersLoadedRef = useRef<ViewportBbox | null>(null);
  // Overlay shown only during a *truly-new* fetch (first load + search jumps),
  // never on ordinary pans/zooms. Safety timeout hides it if the map never
  // settles (e.g. tiles fail) so it can't get stuck.
  const [loading, setLoading] = useState(true);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  // Keep the refs current so the once-only init effect's handlers always call
  // the latest callbacks (updating a ref during render is disallowed).
  useEffect(() => {
    onClusterOpenRef.current = onClusterOpen;
    onVendorOpenRef.current = onVendorOpen;
    onBackgroundTapRef.current = onBackgroundTap;
    onViewChangeRef.current = onViewChange;
    onVisibleVendorsChangeRef.current = onVisibleVendorsChange;
    onVendorsChangeRef.current = onVendorsChange;
  }, [
    onClusterOpen,
    onVendorOpen,
    onBackgroundTap,
    onViewChange,
    onVisibleVendorsChange,
    onVendorsChange,
  ]);

  /**
   * Fetch the per-vendor filter attributes for a box and merge them onto rows.
   *
   * Split out of the pin payload by migration 0034: `filters` is about 257 of
   * the 625 bytes a row used to cost, and it is read by nothing until the couple
   * opens the filter sheet. Returns the merged rows, or null if the fetch failed
   * or the function is not there yet (pre-0034 hosted DB), in which case the
   * caller keeps the unmerged rows and every vendor simply ranks as unfiltered.
   */
  const fetchFiltersFor = useCallback(
    async (box: ViewportBbox, vendors: Vendor[]): Promise<Vendor[] | null> => {
      const { data, error } = await supabase.rpc("vendor_filters_in_bbox", {
        min_lng: box.minLng,
        min_lat: box.minLat,
        max_lng: box.maxLng,
        max_lat: box.maxLat,
        max_rows: MAX_ROWS,
      });

      if (error) {
        // Until 0034 is hand-applied this function does not exist. That is not
        // a broken state: pre-0034 `vendors_in_bbox` still returns filters
        // inline, so this path is never reached on that schema.
        console.error(
          "[VendorMap] vendor_filters_in_bbox error:",
          error.message,
        );
        return null;
      }

      const byId = new Map<string, Record<string, unknown> | null>();
      for (const row of (data ?? []) as {
        id: string;
        filters: Record<string, unknown> | null;
      }[]) {
        byId.set(row.id, row.filters);
      }

      filtersLoadedRef.current = box;
      // A vendor with no row in the result genuinely has no attributes, so it
      // gets null rather than staying undefined — that is what stops a later
      // `filters !== undefined` check from re-triggering this fetch forever.
      return vendors.map((v) => ({ ...v, filters: byId.get(v.id) ?? null }));
    },
    [supabase],
  );

  /**
   * Run the bbox query for an explicit box and record it as the covered area.
   *
   * Takes the box as an argument rather than reading it off the map, which is
   * what lets the first fetch start at MOUNT — before MapLibre has even been
   * downloaded — instead of inside `map.on("load")`. See the init effect.
   */
  const fetchBbox = useCallback(
    async (box: ViewportBbox): Promise<Vendor[] | null> => {
      const args = {
        min_lng: box.minLng,
        min_lat: box.minLat,
        max_lng: box.maxLng,
        max_lat: box.maxLat,
        max_rows: MAX_ROWS,
      };

      const { data, error } = await supabase.rpc("vendors_in_bbox", args);

      if (error) {
        console.error("[VendorMap] vendors_in_bbox error:", error.message);
        return null; // keep existing pins and coverage — stale beats blank
      }

      const vendors = (data ?? []) as Vendor[];

      // A truncated result (hit MAX_ROWS) means the padded area is only
      // partially known — zooming into it could reveal vendors we never
      // received, so only a complete result is safe to treat as covered. An
      // empty area is complete, so cover it too (otherwise panning an empty
      // region refetches forever).
      coverageRef.current = vendors.length < MAX_ROWS ? box : null;

      // Migration 0034 moved `filters` out of this payload (two thirds of its
      // bytes, read only by the filter sheet). Pre-0034 the rows still carry it
      // inline, which is the signal that no companion fetch is needed — see
      // fetchFiltersFor. Post-0034 the key is absent and filters arrive only
      // once the couple opens the sheet.
      const inlineFilters = vendors.some((v) => v.filters !== undefined);
      filtersLoadedRef.current = inlineFilters ? box : null;
      if (!inlineFilters && withFiltersRef.current) {
        const merged = await fetchFiltersFor(box, vendors);
        if (merged) return merged;
      }

      return vendors;
    },
    [supabase, fetchFiltersFor],
  );

  /**
   * Query the RPC for the current bounds. Returns the vendor rows, or null when
   * nothing needs applying (cache hit or error). Kept separate from applying so
   * the first fetch can run concurrently with map image baking on load.
   */
  const fetchVendors = useCallback(async (): Promise<Vendor[] | null> => {
    const map = mapRef.current;
    if (!map) return null;

    const bounds = map.getBounds();
    const west = bounds.getWest();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const north = bounds.getNorth();

    // Cache hit: viewport fully inside the area of the last complete fetch —
    // every vendor in view is already in a source. This is also what lets the
    // mount-time prefetch satisfy the map's own first request: the prefetch
    // sets coverage before `load` fires, so this returns null and the load
    // handler applies the already-arrived rows.
    const cov = coverageRef.current;
    if (
      cov &&
      west >= cov.minLng &&
      east <= cov.maxLng &&
      south >= cov.minLat &&
      north <= cov.maxLat
    ) {
      return null;
    }

    return fetchBbox(
      padBbox(
        { minLng: west, minLat: south, maxLng: east, maxLat: north },
        BBOX_PAD_FACTOR,
      ),
    );
  }, [fetchBbox]);

  /**
   * Report every vendor currently inside the viewport, after the type filter —
   * the pill's count and the list it opens.
   *
   * Answered from the rows we already hold (`vendorsRef`) against the map's
   * current bounds, using each pin's *display* position, so what's counted is
   * exactly what's drawn (fanned-out pins included). Deliberately NOT
   * `queryRenderedFeatures`: that answers "what's rasterized", which collapses
   * clusters and misses pins just outside the painted tiles.
   *
   * Reads everything from refs, so it's stable enough for the run-once init
   * effect to call from its own handlers.
   */
  const reportVisibleVendors = useCallback(() => {
    const map = mapRef.current;
    const notify = onVisibleVendorsChangeRef.current;
    if (!map || !notify) return;

    const bounds = map.getBounds();
    const center = map.getCenter();
    const cosLat = Math.cos((center.lat * Math.PI) / 180);
    const sel = selectedTypesRef.current ?? [];
    const showAll = sel.length === 0;

    const selections = filterSelectionsRef.current;
    const filtering = hasAnySelection(selections);

    const inView: {
      id: string;
      vendorType: VendorType;
      rank: 0 | 1;
      matched: number;
      priced: boolean;
      photo: boolean;
      d: number;
    }[] = [];
    for (const v of vendorsRef.current) {
      const vendorType = bucketType(v.vendor_type);
      if (!showAll && !sel.includes(vendorType)) continue;
      const pos = positionsRef.current.get(v.id);
      if (!pos) continue; // no coordinates — never drawn, so never "on screen"
      if (!bounds.contains([pos.lng, pos.lat])) continue;
      // Same predicate the pins were built with, so the pill can never disagree
      // with what is drawn. The detail form additionally carries how many of the
      // filters the vendor was silent on, which orders the partial tier below.
      const match = filtering
        ? filterMatchFor(vendorType, v.filters, selections)
        : UNFILTERED_MATCH;
      const rank = match.rank;
      if (rank < 0) continue;
      // Squared distance from center, longitude scaled to match latitude at this
      // latitude. Only used for ordering, so no need for a real geodesic.
      const dx = (pos.lng - center.lng) * cosLat;
      const dy = pos.lat - center.lat;
      inView.push({
        id: v.id,
        vendorType,
        rank: rank as 0 | 1,
        matched: matchedFraction(match),
        // `=== true` rather than a truthiness test: both flags are undefined on
        // every row until migration 0035 is applied, and that has to read as
        // false for all rows alike so the two keys drop out and leave the old
        // nearest-first order — not as NaN, which would corrupt the comparator.
        priced: v.has_price === true,
        photo: v.has_photo === true,
        d: dx * dx + dy * dy,
      });
    }

    // Five keys, in order:
    //
    //   rank     full matches before the "missing some information" ones. This
    //            has to stay outermost: it is the partition the list draws its
    //            divider on, and what the cap keeps when it bites.
    //   matched  how MUCH of the ask a vendor met — the partial tier is itself
    //            graded, so a venue silent on 1 filter of 3 outranks one silent
    //            on 2. A no-op above the divider, where every row matched
    //            everything and scores 1, which is why it can sit here rather
    //            than being special-cased to rank 0.
    //   priced   a vendor with an extracted price before one without. A couple
    //            is shopping on budget, and a card that can answer "what does
    //            this cost" is worth more than one that cannot. No divider —
    //            this tier is internal, unlike rank.
    //   photo    a card that draws an image before one that falls through to a
    //            category placeholder.
    //   d        then nearest the map center, as before.
    //
    // Each key only ever reorders within the tier above it, so distance still
    // decides everything at the bottom.
    inView.sort(
      (a, b) =>
        b.rank - a.rank ||
        b.matched - a.matched ||
        Number(b.priced) - Number(a.priced) ||
        Number(b.photo) - Number(a.photo) ||
        a.d - b.d,
    );
    const entries: VisibleVendor[] = inView
      .slice(0, MAX_VISIBLE_ENTRIES)
      .map(({ id, vendorType, rank }) => ({ id, vendorType, rank }));
    const partial = inView.reduce((n, e) => n + (e.rank === 0 ? 1 : 0), 0);

    const key = `${inView.length}|${partial}|${entries.map((e) => e.id).join(",")}`;
    if (key === lastVisibleKeyRef.current) return; // nothing changed
    lastVisibleKeyRef.current = key;
    notify({ total: inView.length, partial, entries });
  }, []);

  /** Push vendor rows into the per-type clustered sources. */
  const applyVendors = useCallback(
    (vendors: Vendor[]) => {
      const map = mapRef.current;
      if (!map) return;
      // Positions are resolved over EVERY row, including ones the filter will
      // drop. The fan-out for pins sharing a coordinate is derived from the set
      // that shares it, so resolving over the filtered subset would make the
      // survivors re-fan and visibly jump on every chip tap.
      const positions = resolveDisplayPositions(vendors);
      const byType = buildFeatureCollectionsByType(
        vendors,
        positions,
        filterSelectionsRef.current,
      );
      for (const t of VENDOR_TYPES) {
        map.getSource(srcId(t))?.setData(byType[t]);
      }
      // Retain the rows behind the pins so the on-screen list can be recomputed
      // on any move without going back to the network.
      vendorsRef.current = vendors;
      positionsRef.current = positions;
      onVendorsChangeRef.current?.(vendors);
      reportVisibleVendors();
    },
    [reportVisibleVendors],
  );

  const refreshMarkers = useCallback(async () => {
    const vendors = await fetchVendors();
    if (vendors) applyVendors(vendors);
    // Whatever triggered this fetch has now settled — clear any loading overlay.
    // (Ordinary pans never set it, so this is usually a no-op.)
    setLoading(false);
  }, [fetchVendors, applyVendors]);

  /** Debounced wrapper for refreshMarkers — called on 'moveend'. */
  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refreshMarkers();
    }, DEBOUNCE_MS);
  }, [refreshMarkers]);

  /**
   * Show only the selected vendor types (empty selection = show all). Cheap: the
   * per-type pin + cluster layers already exist, so this is just a visibility
   * toggle — no refetch, no source churn. Hidden layers also can't be tapped, so
   * the cluster-list sheet respects the filter for free. Reads the selection from
   * a ref so the run-once init effect can call it right after adding the layers.
   */
  const applyTypeFilter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const sel = selectedTypesRef.current ?? [];
    const showAll = sel.length === 0;
    for (const t of VENDOR_TYPES) {
      const visibility = showAll || sel.includes(t) ? "visible" : "none";
      // Guarded: on early renders the layers don't exist yet (map still loading).
      if (map.getLayer(pinLayerId(t))) {
        map.setLayoutProperty(pinLayerId(t), "visibility", visibility);
      }
      if (map.getLayer(clusterLayerId(t))) {
        map.setLayoutProperty(clusterLayerId(t), "visibility", visibility);
      }
    }
  }, []);

  // Re-apply on every selection change, keeping the ref in sync so the init
  // effect's post-load call sees the current value too. A no-op until the layers
  // exist, so a change mid-load is safe (the load handler applies it then).
  useEffect(() => {
    selectedTypesRef.current = selectedTypes;
    applyTypeFilter();
    // The filter changes what's on screen, so the results pill/list move with it.
    reportVisibleVendors();
  }, [selectedTypes, applyTypeFilter, reportVisibleVendors]);

  /**
   * Re-apply the attribute filter. Unlike the type filter this cannot be a
   * visibility toggle: the decision is per-vendor, not per-layer, so the source
   * data is rebuilt from the rows already in hand. Still no network — that is
   * the whole reason the filter runs client-side (see migration 0033) — and
   * rebuilding the source is also what keeps cluster counts honest, since
   * MapLibre clusters the source rather than the drawn subset.
   */
  useEffect(() => {
    filterSelectionsRef.current = filterSelections;
    if (vendorsRef.current.length) applyVendors(vendorsRef.current);
    reportVisibleVendors();
  }, [filterSelections, applyVendors, reportVisibleVendors]);

  /**
   * Load the filter attributes the first time this session needs them.
   *
   * Post-0034 the pin payload carries no `filters`, so opening the filter sheet
   * is what pays for them — a second, much smaller query over the same box.
   * Until it lands every vendor ranks 1 (unfiltered), which is a benign
   * transient: nothing dims yet, rather than anything dimming wrongly. In
   * practice the sheet is opened before any chip can be tapped, so the
   * attributes are almost always in hand by the time a selection exists.
   */
  useEffect(() => {
    withFiltersRef.current = withFilters;
    if (!withFilters) return;

    const cov = coverageRef.current;
    const rows = vendorsRef.current;
    if (!cov || rows.length === 0) return;
    if (filtersLoadedRef.current === cov) return; // already have them for this box

    let cancelled = false;
    (async () => {
      const merged = await fetchFiltersFor(cov, rows);
      // Guard against a pan having replaced the rows while this was in flight.
      if (cancelled || !merged || vendorsRef.current !== rows) return;
      applyVendors(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [withFilters, fetchFiltersFor, applyVendors]);

  /**
   * Mark the vendor whose preview card is open: its pin is bumped up a size and
   * labelled at any zoom. Both are layout expressions on the existing pin layers,
   * so a selection change is two setLayoutProperty calls per type — no new
   * layers, images, or sources. Reads from a ref for the same reason
   * applyTypeFilter does (the run-once init effect calls it after adding layers).
   */
  const applySelection = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = selectedVendorIdRef.current ?? null;
    const layout = selectionLayout(selected);
    const paint = selectionPaint(selected);
    for (const t of VENDOR_TYPES) {
      const layer = pinLayerId(t);
      if (!map.getLayer(layer)) continue; // layers not added yet (still loading)
      for (const [prop, value] of Object.entries(layout)) {
        map.setLayoutProperty(layer, prop, value);
      }
      // Opacity is paint, not layout, so it needs its own pass — a selected
      // rank-0 pin must come back to full opacity.
      for (const [prop, value] of Object.entries(paint)) {
        map.setPaintProperty(layer, prop, value);
      }
    }
  }, []);

  useEffect(() => {
    selectedVendorIdRef.current = selectedVendorId;
    applySelection();
  }, [selectedVendorId, applySelection]);

  // Initialize the map once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current) return;
    if (mapRef.current) return; // already initialized

    // Failsafe: never let the loading overlay outlive a stuck map load.
    loadTimeoutRef.current = setTimeout(() => setLoading(false), 10000);

    let map: import("maplibre-gl").Map;

    // Ask for the vendors NOW, before MapLibre is even downloaded.
    //
    // This fetch used to live inside `map.on("load")`, which put it at the end
    // of a long serial chain — ~1 MB MapLibre chunk, construct the map, fetch
    // the basemap style from a third-party CDN, parse it, fire `load` — none of
    // which the query actually depends on. It only needs a bounding box, and
    // the box is a pure function of the initial center, zoom and container
    // size, all known right here. Measured on a 4x-CPU / 1.6 Mbps / 150 ms
    // profile, the style request had not even STARTED until +5.9 s, so the pins
    // were queued behind someone else's CDN for no reason.
    //
    // The result is not awaited here: `fetchBbox` records the box as covered,
    // so the `fetchVendors()` call in the load handler sees a cache hit and
    // returns null, and the load handler applies whatever this resolved to. If
    // the container has not been laid out yet, `bboxForView` returns null and
    // we simply fall back to the old fetch-after-load path.
    const iv0 = initialViewRef.current;
    const initialBox = bboxForView(
      iv0?.lng ?? DEFAULT_CENTER[0],
      iv0?.lat ?? DEFAULT_CENTER[1],
      iv0?.zoom ?? DEFAULT_ZOOM,
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
    const prefetch = initialBox
      ? fetchBbox(padBbox(initialBox, BBOX_PAD_FACTOR))
      : null;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;

      const iv = initialViewRef.current;
      map = new maplibregl.Map({
        container: containerRef.current!,
        style: MAP_STYLE_URL,
        center: iv ? [iv.lng, iv.lat] : DEFAULT_CENTER,
        zoom: iv?.zoom ?? DEFAULT_ZOOM,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      mapRef.current = map;

      // MapLibre reports a failed style, a rejected layer expression, or a bad
      // source through this event and NOWHERE else — without it the map simply
      // renders blank with a clean console, which is the single most misleading
      // failure mode here. The vendor-page mini-map already had one; this one
      // did not, and that cost a debugging round on 2026-08-05.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("error", (e: any) => {
        console.error("[VendorMap] maplibre error:", e?.error?.message ?? e);
      });

      map.on("load", async () => {
        // Sources need no images, so add them first and kick off the first
        // fetch immediately — the network round trip then overlaps the (now
        // parallel) icon rasterization instead of running after it.
        for (const t of VENDOR_TYPES) {
          map.addSource(srcId(t), {
            type: "geojson",
            data: EMPTY_FC,
            cluster: true,
            clusterRadius: CLUSTER_RADIUS,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            // How many of a bubble's vendors are FULL matches. `rank` is 1 or 0
            // per point (contradicting rows never reach the source), so summing
            // it counts the matches. Without this a bubble reports point_count
            // and silently claims every vendor under it matched — the whole
            // reason a filter could say "5 matches" over a map of 126 pins
            // (Kiara, 2026-08-06). The individual pins have receded the partial
            // tier since the filter shipped; at cluster zooms there are no
            // individual pins, so nothing was carrying that signal. Recomputed
            // automatically: a filter change rebuilds the source via
            // applyVendors.
            clusterProperties: { matched: ["+", ["get", "rank"]] },
          });
        }

        // Usually already resolved (or in flight) from the mount-time prefetch
        // above; fetchVendors() then sees the covered box and returns null, so
        // this resolves to the prefetched rows rather than issuing a second
        // query. Falls back to a real fetch when there was no prefetch, or when
        // the map settled somewhere the prefetched box does not cover.
        const firstData = (async () =>
          (prefetch ? await prefetch : null) ?? (await fetchVendors()))();

        // Pre-rasterize category pins + cluster discs before layers use them.
        await registerPinImages(map);
        if (!mapRef.current) return; // unmounted mid-load

        // Individual vendor pins (added first so cluster bubbles sit on top).
        // From LABEL_MIN_ZOOM up each pin also carries its vendor's name beneath
        // it. Labels collide-drop (`text-optional` + no overlap) so a dense block
        // shows as many names as fit and NEVER hides a pin: the icon ignores
        // placement entirely, so only the text can be dropped.
        for (const t of VENDOR_TYPES) {
          map.addLayer({
            id: pinLayerId(t),
            type: "symbol",
            source: srcId(t),
            filter: ["!", ["has", "point_count"]],
            layout: {
              // icon-image / text-field / text-size / text-offset all depend on
              // the current selection — see selectionLayout + applySelection.
              ...selectionLayout(selectedVendorIdRef.current ?? null),
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              "text-font": ["Noto Sans Regular"],
              // Anchored top; the offsets are in ems of text-size, so a label
              // keeps clearing its disc if either size is ever changed.
              "text-anchor": "top",
              "text-max-width": 9,
              "text-padding": 2,
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-optional": true,
            },
            paint: {
              // Dark text in a white casing — legible on the light basemap
              // regardless of the app's own light/dark theme.
              "text-color": "#1f2937",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
              "text-halo-blur": 0.5,
              // rank 0 means the vendor is silent on something you filtered
              // for. It fades rather than disappearing: low coverage mostly
              // means nobody wrote the answer down, so hiding it would bury a
              // real candidate. Updated on selection change — see
              // selectionPaint.
              ...selectionPaint(null),
            },
          });
        }

        // Per-type cluster bubbles: category disc + icon, with the count below
        // it (icon-above-count). icon-size/text-size step up together with the
        // count so the number stays proportionally placed. Both icon and text
        // carry the same rosette offset so they move as one.
        for (const t of VENDOR_TYPES) {
          const off = CLUSTER_OFFSET[t];
          map.addLayer({
            id: clusterLayerId(t),
            type: "symbol",
            source: srcId(t),
            filter: ["has", "point_count"],
            layout: {
              "icon-image": clusterImageId(t),
              "icon-size": ["step", ["get", "point_count"], 1, 10, 1.15, 25, 1.3],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              // The number is what MATCHED, not what is underneath. Three cases,
              // in order: every leaf matched (always true with no filter active)
              // shows the abbreviated total, so nothing changes for the common
              // case and big counts keep their "1.2k" form; a partial hit shows
              // the match count; a bubble with no matches falls back to its
              // total and recedes below, reading as "12 here, none confirmed"
              // rather than a bare "0".
              "text-field": [
                "case",
                ["==", ["get", "matched"], ["get", "point_count"]],
                ["get", "point_count_abbreviated"],
                [">", ["get", "matched"], 0],
                ["to-string", ["get", "matched"]],
                ["get", "point_count_abbreviated"],
              ],
              "text-font": ["Noto Sans Regular"],
              "text-size": ["step", ["get", "point_count"], 13, 10, 15, 25, 17],
              // Sit the count in the lower half of the disc (icon is up top);
              // em-based so it tracks text-size as the disc scales with count.
              "text-offset": [0, 0.6],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "rgba(0,0,0,0.25)",
              "text-halo-width": 1,
              // A bubble holding nothing that matches recedes exactly as far as
              // an individual rank-0 pin, and for the same reason: it is still
              // worth tapping, because low coverage mostly means nobody wrote
              // the answer down. No selection case here — a cluster is never
              // the selected vendor.
              "icon-opacity": [
                "case",
                ["==", ["get", "matched"], 0],
                PARTIAL_ICON_OPACITY,
                1,
              ],
              "text-opacity": [
                "case",
                ["==", ["get", "matched"], 0],
                PARTIAL_LABEL_OPACITY,
                1,
              ],
              "icon-translate": off,
              "text-translate": off,
            },
          });
        }

        // All layers now exist — apply any active type filter before wiring
        // interactions (hidden layers emit no clicks).
        applyTypeFilter();

        // Interaction: cluster → zoom to expansion; pin → open vendor page.
        for (const t of VENDOR_TYPES) {
          const clusters = clusterLayerId(t);
          const pins = pinLayerId(t);
          const source = srcId(t);

          map.on("click", clusters, (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const clusterId = feature.properties?.cluster_id;
            const src = map.getSource(source) as import("maplibre-gl").GeoJSONSource;

            // With a list handler wired up, a cluster tap opens the feed of its
            // vendors instead of zooming in. Pass the cluster's own point_count
            // as the leaf limit so we get every vendor, not the default 10.
            const onOpen = onClusterOpenRef.current;
            if (onOpen) {
              const count = (feature.properties?.point_count as number) ?? 0;
              src.getClusterLeaves(clusterId, count, 0).then((leaves) => {
                const entries = leaves
                  .map((l) => ({
                    id: l.properties?.id,
                    // Leaves are the original points, so each carries the rank
                    // buildFeatureCollectionsByType stamped on it.
                    rank: l.properties?.rank === 0 ? 0 : 1,
                  }))
                  .filter((e): e is ClusterEntry => typeof e.id === "string")
                  // Full matches first, mirroring the results feed. Leaf order
                  // is supercluster's, which has nothing to do with relevance.
                  .sort((a, b) => b.rank - a.rank);
                if (entries.length === 0) return;
                const c = map.getCenter();
                onOpen({
                  entries,
                  vendorType: t,
                  center: [c.lng, c.lat],
                  zoom: map.getZoom(),
                });
              });
              return;
            }

            // Fallback (no handler): zoom to the cluster's expansion zoom.
            src.getClusterExpansionZoom(clusterId).then((zoom) => {
              const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
              map.easeTo({ center: [lng, lat], zoom });
            });
          });

          map.on("click", pins, (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const id = feature.properties?.id;
            if (typeof id !== "string") return;

            // No preview handler wired up → straight to the vendor page (the
            // original behavior, kept for any other consumer of this map).
            const onOpen = onVendorOpenRef.current;
            if (!onOpen) {
              router.push(`/vendor/${id}`);
              return;
            }

            onOpen({ id, vendorType: t });

            // The preview card covers the bottom of the map; if the tapped pin
            // sits behind it, pan just enough to bring it back into view.
            const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
            const point = map.project([lng, lat]);
            const safeBottom = map.getCanvas().clientHeight - PREVIEW_SAFE_PX;
            if (point.y > safeBottom) {
              map.panBy([0, point.y - safeBottom], { duration: 300 });
            }
          });

          for (const layer of [clusters, pins]) {
            map.on("mouseenter", layer, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", layer, () => {
              map.getCanvas().style.cursor = "";
            });
          }
        }

        // A tap that hits neither a pin nor a cluster is a tap on empty map —
        // report it so an open preview can dismiss. Hidden layers (filtered-out
        // types) render nothing, so they can't keep a preview alive.
        map.on("click", (e) => {
          const onTap = onBackgroundTapRef.current;
          if (!onTap) return;
          const layers = [
            ...VENDOR_TYPES.map(pinLayerId),
            ...VENDOR_TYPES.map(clusterLayerId),
          ].filter((l) => map.getLayer(l));
          if (map.queryRenderedFeatures(e.point, { layers }).length === 0) {
            onTap();
          }
        });

        const vendors = await firstData;
        if (vendors) applyVendors(vendors);
        setLoading(false); // first load done — reveal the map
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        // On every settled move: refresh pins for the new bounds, and report the
        // view so the page can persist it for restore-on-return.
        map.on("moveend", () => {
          scheduleRefresh();
          // Recount immediately off the rows already in hand, rather than
          // waiting on the (debounced, often cache-hit) refetch — the pill has
          // to track the viewport as it moves.
          reportVisibleVendors();
          const c = map.getCenter();
          onViewChangeRef.current?.({
            center: [c.lng, c.lat],
            zoom: map.getZoom(),
          });
        });
      });
    })();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (mapRef.current) {
        mapRef.current.remove(); // also removes any markers on the map
        mapRef.current = null;
        userMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once

  // Fly to an external position when provided (e.g. a search or geolocation).
  // A jump lands in new territory → treat it as a truly-new fetch and show the
  // overlay until the follow-on moveend fetch settles.
  useEffect(() => {
    if (!flyToPosition || !mapRef.current) return;
    setLoading(true);
    mapRef.current.flyTo({
      center: [flyToPosition.lng, flyToPosition.lat],
      zoom: flyToPosition.zoom ?? 14,
      duration: 1200,
    });
  }, [flyToPosition]);

  // "You are here" dot: created on the first geolocation, moved on later ones.
  // One-shot pulse ring re-added per update so repeat taps re-announce the dot.
  useEffect(() => {
    if (!userPosition) return;
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      const map = mapRef.current;
      if (!map || cancelled) return;
      if (!userMarkerRef.current) {
        const dot = document.createElement("div");
        dot.className = "user-location-dot";
        userMarkerRef.current = new maplibregl.Marker({ element: dot })
          .setLngLat([userPosition.lng, userPosition.lat])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]);
      }
      const el = userMarkerRef.current.getElement() as HTMLElement;
      el.querySelector(".user-location-pulse")?.remove();
      const pulse = document.createElement("div");
      pulse.className = "user-location-pulse";
      el.appendChild(pulse);
    })();
    return () => {
      cancelled = true;
    };
  }, [userPosition]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Vendor map"
      />
      {loading && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
          role="status"
          aria-label="Loading vendors"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Finding vendors…</span>
          </div>
        </div>
      )}
    </div>
  );
}
