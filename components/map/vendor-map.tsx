"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { CATEGORIES } from "@/lib/constants/categories";
import { type Vendor } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

// MapLibre is browser-only; import deferred to effects.
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

// Denver, CO
const DEFAULT_CENTER: [number, number] = [-104.9903, 39.7392];
const DEFAULT_ZOOM = 9;
const DEBOUNCE_MS = 150;
// Upper bound on pins per fetch. Must stay ABOVE a launched region's true vendor
// count: vendors_in_bbox has no ORDER BY, so when a fetch box holds more than
// this, Postgres returns an arbitrary subset and whole pockets (e.g. Thornton)
// silently drop out until you zoom in far enough to fall under the cap. The real
// fix for genuinely dense regions is marker clustering (deferred round-2 GeoJSON
// rewrite); until then keep comfortable headroom over the region total.
const MAX_ROWS = 1000;

// Fetch beyond the viewport so small pans land inside already-fetched area.
const BBOX_PAD_FACTOR = 0.5; // half a viewport-span extra on each side

interface MarkerRef {
  marker: import("maplibre-gl").Marker;
  vendorId: string;
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
 * coordinate (~11m); any group with more than one member is fanned out so the
 * pins don't stack. Single pins keep their exact coordinate.
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

/** Builds a small colored circle element for a vendor marker. */
function buildMarkerElement(vendor: Vendor, approximate: boolean): HTMLElement {
  const meta = CATEGORIES[vendor.vendor_type] ?? CATEGORIES.other;
  const Icon = meta.icon;

  // Render the Lucide icon as SVG markup (white, 14px).
  const iconSvg = renderToStaticMarkup(
    <Icon size={14} color="#ffffff" strokeWidth={2.5} />,
  );

  // Outer wrapper — MapLibre writes its own translate() transform here for
  // positioning. Never touch el.style.transform or the marker will scatter.
  const el = document.createElement("div");
  el.style.cssText = `width: 30px; height: 30px; cursor: pointer;`;
  el.title = approximate ? `${vendor.name} (approximate area)` : vendor.name;

  // Inner circle — safe to apply visual transforms here. Approximate-location
  // pins get a dashed outline to signal the spot is a region, not an address.
  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: ${meta.colorHex};
    border: 2px ${approximate ? "dashed" : "solid"} #ffffff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.12s ease;
  `;
  inner.innerHTML = iconSvg;
  el.appendChild(inner);

  el.addEventListener("mouseenter", () => {
    inner.style.transform = "scale(1.18)";
  });
  el.addEventListener("mouseleave", () => {
    inner.style.transform = "scale(1)";
  });

  return el;
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
  const markersRef = useRef<MarkerRef[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Area covered by the last *complete* fetch. When the viewport stays inside
  // it, the markers on the map are already correct — skip the refetch.
  const coverageRef = useRef<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const supabase = createClient();

  /** Remove all current markers from the map. */
  const clearMarkers = useCallback(() => {
    for (const { marker } of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];
  }, []);

  /** Query the RPC and refresh markers based on current bounds. */
  const refreshMarkers = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const west = bounds.getWest();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const north = bounds.getNorth();

    // Cache hit: viewport fully inside the area of the last complete fetch —
    // every vendor in view is already a marker on the map.
    const cov = coverageRef.current;
    if (
      cov &&
      west >= cov.minLng &&
      east <= cov.maxLng &&
      south >= cov.minLat &&
      north <= cov.maxLat
    ) {
      return;
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
      return; // keep existing markers and coverage — stale beats blank
    }

    clearMarkers();

    const vendors = (data ?? []) as Vendor[];

    // A truncated result (hit MAX_ROWS) means the padded area is only partially
    // known — zooming into it could reveal vendors we never received, so only a
    // complete result is safe to treat as covered. An empty area is complete,
    // so cover it too (otherwise panning an empty region refetches forever).
    coverageRef.current =
      vendors.length < MAX_ROWS
        ? { minLng: min_lng, minLat: min_lat, maxLng: max_lng, maxLat: max_lat }
        : null;

    if (vendors.length === 0) return;

    // Dynamically import maplibre to avoid SSR issues.
    const maplibregl = (await import("maplibre-gl")).default;

    // Fan out pins that share a coordinate so stacked (approximate) vendors
    // don't pile onto a single spot.
    const positions = resolveDisplayPositions(vendors);

    const newMarkers: MarkerRef[] = [];

    for (const vendor of vendors) {
      const pos = positions.get(vendor.id);
      if (!pos) continue; // missing coordinates

      const el = buildMarkerElement(vendor, isApproximateLocation(vendor));

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        router.push(`/vendor/${vendor.id}`);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);

      newMarkers.push({ marker, vendorId: vendor.id });
    }

    markersRef.current = newMarkers;
  }, [supabase, clearMarkers, router]);

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

      // Compact attribution in the bottom-right.
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      mapRef.current = map;

      map.on("load", () => {
        refreshMarkers();
      });

      map.on("moveend", scheduleRefresh);
    })();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearMarkers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once

  // Fly to an external position when provided (e.g. user's geolocation).
  useEffect(() => {
    if (!flyToPosition || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyToPosition.lng, flyToPosition.lat],
      zoom: flyToPosition.zoom ?? 14,
      duration: 1200,
    });
  }, [flyToPosition]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Vendor map"
    />
  );
}
