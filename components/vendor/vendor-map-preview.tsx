"use client";

import * as React from "react";
import { Maximize2 } from "lucide-react";
import { ExternalLink } from "@/components/external-link";
import { vendorPinMarkup } from "@/lib/map/pin-images";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * A small, non-interactive map of one vendor's pin — the Zillow / Google-Maps
 * place-sheet pattern. Shown ONLY for fixed-location vendor types
 * (`!usesServiceRegion` — venues, hotels, bridal shops): those are a property at
 * an address you go to, so the point is the fact. A service-region vendor is
 * deliberately given no map here, because their pin is a base they travel out
 * from, and rendering it at street zoom would assert a precision the row does
 * not have. Same distinction the Explore map draws with the service-area halo,
 * and the same list that gates the Add Recon service-region field.
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

  // Initialize on mount, matching vendor-map.tsx — the pattern that is proven in
  // production on Explore.
  //
  // This was briefly gated behind an IntersectionObserver to avoid loading
  // MapLibre for a page nobody scrolls. It shipped broken: the observer fires an
  // initial callback with `isIntersecting: false` for an element below the fold,
  // and the map only ever started on a LATER truthy callback, which did not
  // reliably arrive — so the preview stayed an empty grey box (reported on a
  // hotel page, 2026-08-04; reproduced headless). The laziness was worth very
  // little anyway: on a venue page the map sits about one screen down and nearly
  // every viewer reaches it. The dynamic `import()` below is where the real win
  // was and it stays — MapLibre is still its own chunk, out of the initial
  // bundle, exactly as on Explore.
  React.useEffect(() => {
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

      map.on("load", () => {
        // MapLibre measures the container once at construction and does not
        // watch it, so a map built before its box has settled keeps a 0-size
        // canvas forever. Cheap insurance.
        map.resize();
        // A compact AttributionControl starts EXPANDED (`-show`), which is fine
        // on Explore's full-screen map but eats 44px of this 174px one. Collapse
        // it to the "i"; the credit is still one tap away, which is exactly what
        // the compact affordance is for. Removing the class rather than
        // overriding the CSS keeps the toggle working.
        containerRef.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
      });
      // Without this a failed style is silent: the canvas stays transparent, the
      // attribution renders empty (so invisible), and the result is an empty box
      // with no clue why — which is exactly how the bug above presented.
      map.on("error", (e: { error?: Error }) => {
        console.error("[VendorMapPreview] map error:", e.error?.message ?? e);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lng, lat, vendorType, approximate]);

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
          //
          // The map container inside is sized `h-full w-full`, NOT
          // `absolute inset-0`. MapLibre stamps `.maplibregl-map` onto whatever
          // element you hand it, and its stylesheet declares that class
          // `position: relative` — the same specificity as Tailwind's
          // `absolute`, and maplibre-gl.css loads after Tailwind's utilities, so
          // it wins. The container then stops being positioned, `inset-0` no
          // longer sizes it, and since every child MapLibre adds is itself
          // absolute, it collapses to ZERO height: canvas, marker and
          // attribution all present in the DOM and all invisible. That was the
          // blank preview reported 2026-08-04. An explicit height sidesteps the
          // whole collision, which is why vendor-map.tsx never hit it.
          // h-32, not taller: this is an orienting glance, and the page's job is
          // to get the reader to the recon.
          "relative h-32 w-full overflow-hidden rounded-xl border bg-muted " +
          "[&_.maplibregl-ctrl-bottom-right]:z-[2]"
        }
      >
        {/* Sized with h-full/w-full, NOT `absolute inset-0` — see the note on
            the wrapper. */}
        <div ref={containerRef} className="h-full w-full" aria-hidden />

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
