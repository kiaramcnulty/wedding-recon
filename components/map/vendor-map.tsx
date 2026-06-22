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
const DEFAULT_ZOOM = 8;
const DEBOUNCE_MS = 300;
const MAX_ROWS = 200;

interface MarkerRef {
  marker: import("maplibre-gl").Marker;
  vendorId: string;
}

/** Builds a small colored circle element for a vendor marker. */
function buildMarkerElement(vendor: Vendor): HTMLElement {
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
  el.title = vendor.name;

  // Inner circle — safe to apply visual transforms here.
  const inner = document.createElement("div");
  inner.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: ${meta.colorHex};
    border: 2px solid #ffffff;
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
    const min_lng = bounds.getWest();
    const min_lat = bounds.getSouth();
    const max_lng = bounds.getEast();
    const max_lat = bounds.getNorth();

    const { data, error } = await supabase.rpc("vendors_in_bbox", {
      min_lng,
      min_lat,
      max_lng,
      max_lat,
      max_rows: MAX_ROWS,
    });

    if (error) {
      console.error("[VendorMap] vendors_in_bbox error:", error.message);
      return;
    }

    clearMarkers();

    const vendors = (data ?? []) as Vendor[];

    if (vendors.length === 0) return;

    // Dynamically import maplibre to avoid SSR issues.
    const maplibregl = (await import("maplibre-gl")).default;

    const newMarkers: MarkerRef[] = [];

    for (const vendor of vendors) {
      if (vendor.lng == null || vendor.lat == null) continue;

      const el = buildMarkerElement(vendor);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        router.push(`/vendor/${vendor.id}`);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([vendor.lng, vendor.lat])
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
