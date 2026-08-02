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

/**
 * Heuristic: does this vendor's pin sit on an *approximate* (city/region
 * centroid) location rather than a precise street address?
 *
 * Google-sourced vendors carry rooftop-precise coordinates. For user/seed
 * vendors we treat the absence of a street/building number in the address as
 * "approximate" — a city or region geocode (e.g. "Denver, Colorado") has no
 * house number, whereas a real address does. This is intentionally a front-end
 * heuristic so it works on existing rows; if we later capture geocode precision
 * at save time (Nominatim bbox / addresstype), swap this for that field.
 */
function isApproximateLocation(vendor: Vendor): boolean {
  if (vendor.source === "google" || vendor.google_place_id) return false;
  const addr = (vendor.address_text ?? "").trim();
  return !/\d/.test(addr);
}

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
): Record<VendorType, GeoJSON.FeatureCollection> {
  const byType = Object.fromEntries(
    VENDOR_TYPES.map((t) => [
      t,
      { type: "FeatureCollection", features: [] as GeoJSON.Feature[] },
    ]),
  ) as Record<VendorType, GeoJSON.FeatureCollection>;

  for (const vendor of vendors) {
    const pos = positions.get(vendor.id);
    if (!pos) continue; // missing coordinates
    const t = bucketType(vendor.vendor_type);
    (byType[t].features as GeoJSON.Feature[]).push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pos.lng, pos.lat] },
      properties: {
        id: vendor.id,
        name: vendor.name,
        icon: pinImageId(t, isApproximateLocation(vendor)),
        // Emphasized variant, swapped in while this vendor's preview is open.
        iconSelected: pinImageId(t, isApproximateLocation(vendor), true),
      },
    });
  }
  return byType;
}

/**
 * Emitted when a cluster pin is tapped: the vendor ids it contains plus the map
 * view at tap time, so the caller can reopen the same view after a round trip to
 * a vendor page.
 */
export interface ClusterOpenPayload {
  ids: string[];
  vendorType: VendorType;
  center: [number, number];
  zoom: number;
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
}

/**
 * What's on screen right now, after the type filter: the true `total`, and the
 * (capped, nearest-center-first) rows a list can actually render. `total` drives
 * the results pill; `entries` is what the list sheet opens on.
 */
export interface VisibleVendorsPayload {
  total: number;
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
   * Called whenever the set of vendors inside the viewport changes — on every
   * settled move, after new rows land, and when the type filter changes. Drives
   * the "see all N results on screen" pill and the list it opens.
   */
  onVisibleVendorsChange?: (payload: VisibleVendorsPayload) => void;
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
  onVisibleVendorsChange,
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
  // Latest selection, read by the init effect once the pin layers first exist.
  const selectedVendorIdRef = useRef(selectedVendorId);
  // Captured once — the map reads center/zoom at init only.
  const initialViewRef = useRef(initialView);
  // Latest type filter, read by the init effect once the layers first exist.
  const selectedTypesRef = useRef(selectedTypes);
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
  const coverageRef = useRef<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
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
  }, [
    onClusterOpen,
    onVendorOpen,
    onBackgroundTap,
    onViewChange,
    onVisibleVendorsChange,
  ]);

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
    // every vendor in view is already in a source.
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

    const lngPad = (east - west) * BBOX_PAD_FACTOR;
    const latPad = (north - south) * BBOX_PAD_FACTOR;
    const min_lng = west - lngPad;
    const max_lng = east + lngPad;
    const min_lat = Math.max(south - latPad, -85);
    const max_lat = Math.min(north + latPad, 85);

    const { data, error } = await supabase.rpc("vendors_in_bbox", {
      min_lng,
      min_lat,
      max_lng,
      max_lat,
      max_rows: MAX_ROWS,
    });

    if (error) {
      console.error("[VendorMap] vendors_in_bbox error:", error.message);
      return null; // keep existing pins and coverage — stale beats blank
    }

    const vendors = (data ?? []) as Vendor[];

    // A truncated result (hit MAX_ROWS) means the padded area is only partially
    // known — zooming into it could reveal vendors we never received, so only a
    // complete result is safe to treat as covered. An empty area is complete,
    // so cover it too (otherwise panning an empty region refetches forever).
    coverageRef.current =
      vendors.length < MAX_ROWS
        ? { minLng: min_lng, minLat: min_lat, maxLng: max_lng, maxLat: max_lat }
        : null;

    return vendors;
  }, [supabase]);

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

    const inView: { id: string; vendorType: VendorType; d: number }[] = [];
    for (const v of vendorsRef.current) {
      const vendorType = bucketType(v.vendor_type);
      if (!showAll && !sel.includes(vendorType)) continue;
      const pos = positionsRef.current.get(v.id);
      if (!pos) continue; // no coordinates — never drawn, so never "on screen"
      if (!bounds.contains([pos.lng, pos.lat])) continue;
      // Squared distance from center, longitude scaled to match latitude at this
      // latitude. Only used for ordering, so no need for a real geodesic.
      const dx = (pos.lng - center.lng) * cosLat;
      const dy = pos.lat - center.lat;
      inView.push({ id: v.id, vendorType, d: dx * dx + dy * dy });
    }

    // Nearest the center first: the closest rows are the ones the user is
    // looking at, and they're the ones kept when the list hits its cap.
    inView.sort((a, b) => a.d - b.d);
    const entries: VisibleVendor[] = inView
      .slice(0, MAX_VISIBLE_ENTRIES)
      .map(({ id, vendorType }) => ({ id, vendorType }));

    const key = `${inView.length}|${entries.map((e) => e.id).join(",")}`;
    if (key === lastVisibleKeyRef.current) return; // nothing changed
    lastVisibleKeyRef.current = key;
    notify({ total: inView.length, entries });
  }, []);

  /** Push vendor rows into the per-type clustered sources. */
  const applyVendors = useCallback(
    (vendors: Vendor[]) => {
      const map = mapRef.current;
      if (!map) return;
      const positions = resolveDisplayPositions(vendors);
      const byType = buildFeatureCollectionsByType(vendors, positions);
      for (const t of VENDOR_TYPES) {
        map.getSource(srcId(t))?.setData(byType[t]);
      }
      // Retain the rows behind the pins so the on-screen list can be recomputed
      // on any move without going back to the network.
      vendorsRef.current = vendors;
      positionsRef.current = positions;
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
   * Mark the vendor whose preview card is open: its pin is bumped up a size and
   * labelled at any zoom. Both are layout expressions on the existing pin layers,
   * so a selection change is two setLayoutProperty calls per type — no new
   * layers, images, or sources. Reads from a ref for the same reason
   * applyTypeFilter does (the run-once init effect calls it after adding layers).
   */
  const applySelection = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const layout = selectionLayout(selectedVendorIdRef.current ?? null);
    for (const t of VENDOR_TYPES) {
      const layer = pinLayerId(t);
      if (!map.getLayer(layer)) continue; // layers not added yet (still loading)
      for (const [prop, value] of Object.entries(layout)) {
        map.setLayoutProperty(layer, prop, value);
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
          });
        }

        const firstData = fetchVendors();

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
              "text-field": ["get", "point_count_abbreviated"],
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
                const ids = leaves
                  .map((l) => l.properties?.id)
                  .filter((id): id is string => typeof id === "string");
                if (ids.length === 0) return;
                const c = map.getCenter();
                onOpen({
                  ids,
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
