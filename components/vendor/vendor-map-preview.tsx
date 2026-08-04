"use client";

import * as React from "react";
import { Maximize2 } from "lucide-react";
import { ExternalLink } from "@/components/external-link";
import { vendorPinMarkup } from "@/lib/map/pin-images";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * A small, non-interactive map of one vendor's pin — the Zillow / Google-Maps
 * place-sheet pattern. Shown ONLY for fixed-location vendor types (venues and
 * hotel blocks, i.e. `!usesServiceRegion`): those are a property at an address,
 * so the point is the fact. A service-region vendor is deliberately given no map
 * here, because their pin is a base they travel out from, and rendering it at
 * street zoom would assert a precision the row does not have. That is the same
 * distinction the Explore map draws with the service-area halo.
 *
 * Costs nothing extra: MapLibre GL is already a dependency and the tiles are the
 * free OpenFreeMap ones Explore uses. Deliberately NOT Google Static Maps, which
 * is billed per image.
 */

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";

/** Street-level for a real address; pulled back when the point is a centroid. */
const PRECISE_ZOOM = 15;
const APPROXIMATE_ZOOM = 11;

interface VendorMapPreviewProps {
  lng: number;
  lat: number;
  vendorType: string;
  /** Pin sits on a city/region centroid, not a street address. */
  approximate?: boolean;
  /** Vendor name + address, used for the Google Maps hand-off and a11y text. */
  name: string;
  addressText: string | null;
  googlePlaceId: string | null;
}

export function VendorMapPreview({
  lng,
  lat,
  vendorType,
  approximate = false,
  name,
  addressText,
  googlePlaceId,
}: VendorMapPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = React.useRef<any>(null);
  // MapLibre is ~200KB of JS plus tile requests. The preview usually sits below
  // the fold on a phone, so nothing loads until it is actually approached.
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // No IntersectionObserver (or a jsdom-style environment) — just load it.
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!inView) return;
    if (typeof window === "undefined") return;
    if (!containerRef.current) return;
    if (mapRef.current) return; // already initialized

    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [lng, lat],
        zoom: approximate ? APPROXIMATE_ZOOM : PRECISE_ZOOM,
        // A preview, not a map: the page scrolls through it, and a drag-to-pan
        // map inside a scrolling column traps the gesture on touch.
        interactive: false,
        attributionControl: false,
      });
      mapRef.current = map;

      // Basemap credit is required by OpenFreeMap / OpenStreetMap. Compact, and
      // lifted above the tap overlay below so its toggle stays reachable.
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      // The same disc the Explore map draws for this category — one shared
      // markup helper, so the pin here is pixel-identical to the one tapped
      // there (dashed outline for an approximate location included).
      const { svg, box, halo } = vendorPinMarkup(vendorType, { approximate });
      const el = document.createElement("div");
      el.innerHTML = svg;
      el.style.width = `${box}px`;
      el.style.height = `${box}px`;
      // Stands in for the drop shadow the rasterized pins get on canvas.
      if (!halo) el.style.filter = "drop-shadow(0 1px 3px rgba(0,0,0,0.35))";
      new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [inView, lng, lat, vendorType, approximate]);

  // Where a tap goes: the same Google Maps overlay the header address opens, so
  // there is one "see this location properly" destination on the page. The
  // keyless output=embed view frames; the href keeps the precise place URL for
  // the open-in-new-tab hatch.
  const query = [name, addressText].filter(Boolean).join(" ");
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}${googlePlaceId ? `&query_place_id=${googlePlaceId}` : ""}`;

  return (
    <div className="px-4">
      <div
        className={
          // The attribution corner is lifted over the tap overlay; without it
          // the link swallows the credit toggle.
          "relative h-44 w-full overflow-hidden rounded-xl border bg-muted " +
          "[&_.maplibregl-ctrl-bottom-right]:z-[2]"
        }
      >
        <div ref={containerRef} className="absolute inset-0" aria-hidden />

        <ExternalLink
          href={href}
          embed
          embedSrc={`https://maps.google.com/maps?q=${encodeURIComponent(
            query,
          )}&output=embed`}
          overlayTitle="Google Maps"
          aria-label={`Open ${name} in Google Maps`}
          // Chip pinned TOP-right, not bottom-right: MapLibre's compact
          // attribution collapses to an "i" only on a narrow map and expands to
          // a full-width credit bar on a wide one, which sat straight on top of
          // a bottom-right chip on desktop.
          className="absolute inset-0 z-[1] flex items-start justify-end p-2"
        >
          <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
            <Maximize2 className="size-3" />
            View larger map
          </span>
        </ExternalLink>
      </div>

      {approximate && (
        // The pin is a city/region centroid. Saying so beats a street-zoom map
        // implying a precision the row does not have.
        <p className="mt-1.5 text-xs text-muted-foreground">
          Approximate location — this vendor has no street address on file.
        </p>
      )}
    </div>
  );
}
