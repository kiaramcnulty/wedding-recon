"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VendorMap, type ClusterOpenPayload } from "@/components/map/vendor-map";
import { ClusterListSheet } from "@/components/map/cluster-list-sheet";
import { VendorTypeFilter } from "@/components/map/vendor-type-filter";
import { CATEGORIES, VENDOR_TYPES, type VendorType } from "@/lib/constants/categories";
import { BrandLockup } from "@/components/brand-lockup";
import { ProfileMenu } from "@/components/profile-menu";
import { cn } from "@/lib/utils";

interface GeocodeSuggestion {
  name: string;
  lat: number;
  lng: number;
}

// A vendor match from /api/vendor-search — the "Vendors" group in the dropdown.
interface VendorSuggestion {
  vendorId: string;
  vendorType: string;
  source: "google" | "user" | "seed";
  name: string;
  secondaryText: string;
}

// Origin of the basemap tiles — preconnected below so the TLS handshake happens
// during JS parse instead of after MapLibre first asks for the style.
const MAP_TILE_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
        "https://tiles.openfreemap.org/styles/liberty",
    ).origin;
  } catch {
    return "https://tiles.openfreemap.org";
  }
})();

export default function ExplorePage() {
  const router = useRouter();
  const [cityQuery, setCityQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [vendorResults, setVendorResults] = useState<VendorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // The open cluster list (null = closed). Opened on a cluster tap, or restored
  // when returning from a vendor page (?restore=1).
  const [cluster, setCluster] = useState<{ ids: string[]; vendorType: VendorType } | null>(null);
  // Selected vendor-type filter (empty = show all). Starts empty so the first
  // client render matches the server; any persisted selection is restored after
  // mount (see below) to avoid a hydration mismatch on the chip states.
  const [selectedTypes, setSelectedTypes] = useState<VendorType[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressFetchRef = useRef(false);

  // Restore the last map view whenever Explore mounts — returning from a vendor
  // by ANY route (in-app back, browser/OS back gesture, or the bottom nav), not
  // just the in-app back button. The view is persisted on every settled map move
  // (see saveMapView). sessionStorage is per-tab, so a brand-new session still
  // opens on the default region. Read once, SSR-safe (window-guarded); used only
  // imperatively by the map at init, so it can't cause a hydration mismatch.
  const [initialView] = useState<{ lng: number; lat: number; zoom: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("wr:mapView");
      if (!raw) return null;
      const d = JSON.parse(raw) as { center?: [number, number]; zoom?: number };
      if (!d.center || typeof d.zoom !== "number") return null;
      return { lng: d.center[0], lat: d.center[1], zoom: d.zoom };
    } catch {
      return null;
    }
  });

  // Persist the tapped cluster's identity so it can be reopened on return
  // (?restore=1), then open the list. The map view is persisted separately by
  // saveMapView, so it isn't duplicated here.
  const openCluster = useCallback((payload: ClusterOpenPayload) => {
    try {
      sessionStorage.setItem(
        "wr:cluster",
        JSON.stringify({ ids: payload.ids, vendorType: payload.vendorType }),
      );
      // Fresh cluster → open at the top (drop any saved feed scroll position).
      sessionStorage.removeItem("wr:clusterScroll");
    } catch {
      // sessionStorage unavailable (e.g. private mode) — the sheet still opens;
      // only reopen-on-back is lost.
    }
    setCluster({ ids: payload.ids, vendorType: payload.vendorType });
  }, []);

  // Persist the map view on every settled move, so returning to Explore restores
  // the same view (see initialView). Keyed separately from the cluster payload so
  // the two never clobber each other.
  const saveMapView = useCallback(
    (view: { center: [number, number]; zoom: number }) => {
      try {
        sessionStorage.setItem("wr:mapView", JSON.stringify(view));
      } catch {
        // sessionStorage unavailable (e.g. private mode) — restore-on-return is
        // lost, nothing else breaks.
      }
    },
    [],
  );

  // Update the type filter and persist it per-tab, so it survives a round trip to
  // a vendor page (restored on mount, below) just like the map view.
  const updateSelectedTypes = useCallback((next: VendorType[]) => {
    setSelectedTypes(next);
    try {
      sessionStorage.setItem("wr:typeFilter", JSON.stringify(next));
    } catch {
      // sessionStorage unavailable — the filter still applies this session.
    }
  }, []);

  // Restore the persisted type filter after mount. Deferred a tick (setTimeout 0,
  // same pattern as the cluster restore below) so the first client render matches
  // the server's default ("all shown") before any saved selection is applied.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let restored: VendorType[] | null = null;
    try {
      const raw = sessionStorage.getItem("wr:typeFilter");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(
            (t): t is VendorType =>
              typeof t === "string" &&
              (VENDOR_TYPES as readonly string[]).includes(t),
          );
          if (clean.length) restored = clean;
        }
      }
    } catch {
      // malformed payload — fall back to showing all
    }
    if (!restored) return;
    const t = setTimeout(() => setSelectedTypes(restored), 0);
    return () => clearTimeout(t);
  }, []);

  // On a restore mount, reopen the cluster sheet from the saved payload. The
  // setState is deferred a tick (setTimeout 0) — the documented pattern for
  // updating state from an effect without tripping set-state-in-effect, and it
  // also lands the portal post-hydration so it never diffs against server HTML.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("restore")) return;
    let restored: { ids: string[]; vendorType: VendorType } | null = null;
    try {
      const raw = sessionStorage.getItem("wr:cluster");
      if (raw) {
        const d = JSON.parse(raw) as { ids?: string[]; vendorType?: VendorType };
        if (d.ids?.length && d.vendorType) {
          restored = { ids: d.ids, vendorType: d.vendorType };
        }
      }
    } catch {
      // ignore a malformed payload — the user just lands on the map
    }
    // Drop the marker so later in-page navigation doesn't re-trigger a restore.
    window.history.replaceState(null, "", "/explore");
    if (!restored) return;
    const t = setTimeout(() => setCluster(restored), 0);
    return () => clearTimeout(t);
  }, []);

  // Debounced autocomplete — always goes through setTimeout to avoid
  // calling setState synchronously in the effect body. Areas (geocode) and
  // vendors (our directory) are fetched in parallel and shown as two groups,
  // so typing a vendor name — "Spruce Mountain Ranch" — finds the vendor, not
  // just a place to pan to.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = cityQuery.trim();

    debounceRef.current = setTimeout(async () => {
      if (suppressFetchRef.current) {
        suppressFetchRef.current = false;
        return;
      }
      if (q.length < 2) {
        setSuggestions([]);
        setVendorResults([]);
        setShowSuggestions(false);
        return;
      }
      const [areas, vendors] = await Promise.all([
        fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
          .then((r) => (r.ok ? (r.json() as Promise<GeocodeSuggestion[]>) : []))
          .catch(() => [] as GeocodeSuggestion[]),
        fetch(`/api/vendor-search?q=${encodeURIComponent(q)}`)
          .then((r) => (r.ok ? (r.json() as Promise<VendorSuggestion[]>) : []))
          .catch(() => [] as VendorSuggestion[]),
      ]);
      setSuggestions(areas);
      setVendorResults(vendors);
      setShowSuggestions(areas.length > 0 || vendors.length > 0);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cityQuery]);

  function selectSuggestion(s: GeocodeSuggestion) {
    suppressFetchRef.current = true; // prevent cityQuery change from re-opening the dropdown
    setCityQuery(s.name.split(",")[0]);
    setFlyTo({ lng: s.lng, lat: s.lat, zoom: 9 });
    setSuggestions([]);
    setVendorResults([]);
    setShowSuggestions(false);
  }

  // Tapping a vendor result opens its page (with a return path back to Explore),
  // rather than panning the map — the vendor is what the user was looking for.
  function selectVendor(v: VendorSuggestion) {
    setShowSuggestions(false);
    router.push(`/vendor/${v.vendorId}?from=/explore`);
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q) return;

    // Prefer an already-populated area match (submit = "take me there"); fall
    // back to the top vendor match so an Enter on a pure vendor query still lands
    // somewhere useful.
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
      return;
    }
    if (vendorResults.length > 0) {
      selectVendor(vendorResults[0]);
      return;
    }

    // Otherwise geocode on submit.
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data: GeocodeSuggestion[] = await res.json();
      if (data.length > 0) selectSuggestion(data[0]);
    } catch {
      // silently ignore
    } finally {
      setSearching(false);
    }
  }

  async function handleLocate() {
    if (locating) return;
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available in this browser.");
      return;
    }

    const deniedMessage =
      "Location access is blocked — allow it for this site in your browser settings.";

    // Known-denied? The browser won't re-prompt, so skip the doomed attempt
    // and point at settings right away. Unsupported → fall through.
    try {
      const status = await navigator.permissions?.query?.({ name: "geolocation" });
      if (status?.state === "denied") {
        toast.error(deniedMessage);
        return;
      }
    } catch {
      // Permissions API unsupported — getCurrentPosition will report instead.
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { longitude: lng, latitude: lat } = pos.coords;
        setUserPosition({ lng, lat });
        setFlyTo({ lng, lat, zoom: 14 });
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? deniedMessage
            : "Couldn't get your location. Try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  return (
    <div className="relative flex flex-1 flex-col min-h-[60vh]">
      {/* Warm the basemap connection early (hoisted to <head> by React). */}
      <link rel="preconnect" href={MAP_TILE_ORIGIN} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={MAP_TILE_ORIGIN} />

      {/* Full-bleed map behind everything */}
      <div className="absolute inset-0">
        <VendorMap
          flyToPosition={flyTo}
          userPosition={userPosition}
          onClusterOpen={openCluster}
          onViewChange={saveMapView}
          initialView={initialView}
          selectedTypes={selectedTypes}
        />
      </div>

      {/* Cluster list feed (portals to <body>; opens on a cluster tap) */}
      {cluster && (
        <ClusterListSheet
          ids={cluster.ids}
          vendorType={cluster.vendorType}
          onClose={() => setCluster(null)}
        />
      )}

      {/* Search bar + autocomplete dropdown, with the account control beside it */}
      <div className="relative z-10 mx-auto flex w-full max-w-[520px] items-start gap-2 px-3 pt-3">
        <div className="flex-1 rounded-xl bg-background/95 shadow-md backdrop-blur-sm">
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 px-3 py-2"
          >
            <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search city or area for wedding vendors…"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              onFocus={() =>
                (suggestions.length > 0 || vendorResults.length > 0) &&
                setShowSuggestions(true)
              }
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className={cn(
                "h-7 border-0 bg-transparent px-0 text-sm shadow-none",
                "focus-visible:ring-0 focus-visible:border-0",
              )}
              aria-label="Search city"
              aria-autocomplete="list"
              autoComplete="off"
            />
            {cityQuery.length > 0 && (
              <Button
                type="submit"
                size="xs"
                variant="default"
                aria-label="Search"
                disabled={searching}
              >
                {searching ? <Loader2 size={12} className="animate-spin" /> : "Go"}
              </Button>
            )}
          </form>

          {showSuggestions &&
            (vendorResults.length > 0 || suggestions.length > 0) && (
              <div className="border-t border-border py-1">
                {/* Vendors group: a direct match in our directory. */}
                {vendorResults.length > 0 && (
                  <>
                    {suggestions.length > 0 && (
                      <div className="px-3 pt-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Vendors
                      </div>
                    )}
                    <ul role="listbox" aria-label="Vendors">
                      {vendorResults.map((v) => {
                        const cat =
                          CATEGORIES[v.vendorType as VendorType] ??
                          CATEGORIES.other;
                        const Icon = cat.icon;
                        return (
                          <li
                            key={`v:${v.vendorId}`}
                            role="option"
                            aria-selected={false}
                            onMouseDown={() => selectVendor(v)}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                          >
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-full"
                              style={{ backgroundColor: cat.lightHex }}
                            >
                              <Icon
                                size={13}
                                style={{ color: cat.colorHex }}
                                aria-hidden
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {v.name}
                              </span>
                              {v.secondaryText && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {v.secondaryText}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                {/* Areas group: geocoded places to pan the map to (unchanged). */}
                {suggestions.length > 0 && (
                  <>
                    {vendorResults.length > 0 && (
                      <div className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Areas
                      </div>
                    )}
                    <ul role="listbox" aria-label="Areas">
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          role="option"
                          aria-selected={false}
                          onMouseDown={() => selectSuggestion(s)}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <MapPin
                            size={13}
                            className="shrink-0 text-muted-foreground"
                          />
                          <span className="truncate">{s.name}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
        </div>

        <ProfileMenu className="shrink-0" />
      </div>

      {/* Vendor-type filter: scrollable color chips beneath the search bar,
          in the same floating column. Doubles as the map's pin-color legend. */}
      <div className="relative z-10 mx-auto w-full max-w-[520px] px-3 pt-2">
        <VendorTypeFilter selected={selectedTypes} onChange={updateSelectedTypes} />
      </div>

      {/* Bottom row over the map, lifted clear of the map attribution along
          the bottom edge: quiet brand mark on the left, locate button right. */}
      <div className="relative z-10 mt-auto flex items-end justify-between px-3 pb-9 pt-3">
        <div className="inline-flex items-center rounded-full bg-background/90 px-3 py-1.5 shadow-md backdrop-blur-sm">
          <BrandLockup size="sm" />
        </div>
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          aria-label="Center map on my location"
          className="flex size-11 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:text-foreground"
        >
          {locating ? (
            <Loader2 size={20} className="animate-spin" aria-hidden />
          ) : (
            <Navigation size={20} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
