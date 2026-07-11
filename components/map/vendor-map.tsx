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
 * Bucket vendors into one GeoJSON FeatureCollection per type. Positions are
 * resolved globally (so cross-type co-located pins still separate) then split by
 * type for the per-type clustered sources.
 */
function buildFeatureCollectionsByType(
  vendors: Vendor[],
): Record<VendorType, GeoJSON.FeatureCollection> {
  const positions = resolveDisplayPositions(vendors);
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
        icon: pinImageId(t, isApproximateLocation(vendor)),
      },
    });
  }
  return byType;
}

interface VendorMapProps {
  /** External position to fly to. Pass zoom to override the default (14). */
  flyToPosition?: { lng: number; lat: number; zoom?: number } | null;
}

export function VendorMap({ flyToPosition }: VendorMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** Push vendor rows into the per-type clustered sources. */
  const applyVendors = useCallback((vendors: Vendor[]) => {
    const map = mapRef.current;
    if (!map) return;
    const byType = buildFeatureCollectionsByType(vendors);
    for (const t of VENDOR_TYPES) {
      map.getSource(srcId(t))?.setData(byType[t]);
    }
  }, []);

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

      map = new maplibregl.Map({
        container: containerRef.current!,
        style: MAP_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
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
        for (const t of VENDOR_TYPES) {
          map.addLayer({
            id: pinLayerId(t),
            type: "symbol",
            source: srcId(t),
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": ["get", "icon"],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
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
            src.getClusterExpansionZoom(clusterId).then((zoom) => {
              const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
              map.easeTo({ center: [lng, lat], zoom });
            });
          });

          map.on("click", pins, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === "string") router.push(`/vendor/${id}`);
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

        const vendors = await firstData;
        if (vendors) applyVendors(vendors);
        setLoading(false); // first load done — reveal the map
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        map.on("moveend", scheduleRefresh);
      });
    })();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
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
