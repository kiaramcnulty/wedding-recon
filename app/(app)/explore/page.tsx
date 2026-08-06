"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  VendorMap,
  type ClusterOpenPayload,
  type VendorOpenPayload,
  type VisibleVendorsPayload,
} from "@/components/map/vendor-map";
import { ClusterListSheet } from "@/components/map/cluster-list-sheet";
import { VendorFeed, ViewToggle } from "@/components/map/vendor-feed";
import { VendorPinPreview } from "@/components/map/vendor-pin-preview";
import {
  VendorFilterSheet,
  FilterButton,
  type FilterState,
  type DateContext,
} from "@/components/map/vendor-filter-sheet";
import { filtersForType } from "@/lib/constants/vendor-filters";
import {
  buildSelection,
  countSelections,
  type FilterSelections,
} from "@/lib/filters/match";
import type { Vendor } from "@/lib/types";
import {
  CATEGORIES,
  VENDOR_TYPES,
  type VendorType,
} from "@/lib/constants/categories";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ProfileMenu } from "@/components/profile-menu";
import { LANDING_HREF } from "@/lib/landing/nav";
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
  lng: number;
  lat: number;
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

/**
 * Read a vendor-type selection from either source that can supply one: a
 * `?types=venue,flowers` deeplink (comma-separated string) or the persisted
 * `wr:typeFilter` payload (array of strings).
 *
 * Unknown and legacy values are dropped individually rather than rejecting the
 * whole list, so an old link still filters to whatever it names that is still a
 * selectable category. Returns null when nothing usable survives — the caller
 * treats that as "show everything", which is also the no-filter default.
 */
function parseTypeList(raw: unknown): VendorType[] | null {
  const values =
    typeof raw === "string"
      ? raw.split(",").map((v) => v.trim())
      : Array.isArray(raw)
        ? raw
        : [];
  const clean = values.filter(
    (t): t is VendorType =>
      typeof t === "string" && (VENDOR_TYPES as readonly string[]).includes(t),
  );
  return clean.length ? [...new Set(clean)] : null;
}

export default function ExplorePage() {
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
  // The single vendor whose peek card is open (null = closed). Opened on a pin
  // tap, restored on return from the vendor page (?restore=1) like the cluster.
  const [pin, setPin] = useState<{ id: string; vendorType: VendorType } | null>(null);
  // Everything the map is currently showing, after the type filter — the live
  // count behind the results pill, plus the rows its list opens on.
  const [visible, setVisible] = useState<VisibleVendorsPayload>({
    total: 0,
    partial: 0,
    entries: [],
  });
  // Selected vendor-type filter (empty = show all). Starts empty so the first
  // client render matches the server; any persisted selection is restored after
  // mount (see below) to avoid a hydration mismatch on the chip states.
  const [selectedTypes, setSelectedTypes] = useState<VendorType[]>([]);
  // Attribute filters, keyed BY VENDOR TYPE. Filters are type-scoped (a venue
  // has no cuisine), but that scopes which filters apply to a vendor — it is
  // not a reason to allow only one type at a time. A couple shops for a venue
  // and a photographer in the same session, so several categories can be
  // filtered at once and each vendor is judged only against its own type.
  const [filterStates, setFilterStates] = useState<
    Partial<Record<VendorType, FilterState>>
  >({});
  const [dateContexts, setDateContexts] = useState<
    Partial<Record<VendorType, DateContext>>
  >({});
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Map or list. The list is a VIEW, not a modal: that is what lets it render
  // live off `visible.entries` instead of the frozen snapshot the old bottom
  // sheet needed (a modal list cannot reshuffle under a scroll, so it had to be
  // pinned at open time). The map stays MOUNTED underneath either way — see the
  // render — so toggling never re-inits MapLibre or refetches.
  const [view, setView] = useState<"map" | "list">("map");
  // Rows the map currently holds, so the sheet can rescale its histograms
  // against what is actually in view.
  const [mapVendors, setMapVendors] = useState<Vendor[]>([]);

  const filterSelections = useMemo<FilterSelections>(() => {
    const out: FilterSelections = {};
    for (const t of selectedTypes) {
      const st = filterStates[t];
      if (!st || Object.keys(st).length === 0) continue;
      out[t] = buildSelection(filtersForType(t), st, dateContexts[t] ?? {});
    }
    return out;
  }, [selectedTypes, filterStates, dateContexts]);

  const activeFilterCount = countSelections(filterSelections);
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
      // The map previews are mutually exclusive; only one can be restored.
      sessionStorage.removeItem("wr:pin");
    } catch {
      // sessionStorage unavailable (e.g. private mode) — the sheet still opens;
      // only reopen-on-back is lost.
    }
    setPin(null);
    setCluster({ ids: payload.ids, vendorType: payload.vendorType });
  }, []);

  // A single pin tap peeks the vendor rather than navigating — persisted the same
  // way the cluster is, so returning from the vendor page reopens the card.
  const openPin = useCallback((payload: VendorOpenPayload) => {
    try {
      sessionStorage.setItem("wr:pin", JSON.stringify(payload));
      sessionStorage.removeItem("wr:cluster");
    } catch {
      // sessionStorage unavailable — the card still opens.
    }
    setPin({ id: payload.id, vendorType: payload.vendorType });
  }, []);

  const closePin = useCallback(() => {
    try {
      sessionStorage.removeItem("wr:pin");
    } catch {
      // nothing persisted to clear
    }
    setPin(null);
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
    // Drop the filters of any category that was just DESELECTED, and keep the
    // rest. Clearing everything on any change would throw away a venue filter
    // the moment a photographer category is added alongside it.
    const keep = new Set(next);
    setFilterStates((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([t]) => keep.has(t as VendorType))),
    );
    setDateContexts((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([t]) => keep.has(t as VendorType))),
    );
    try {
      sessionStorage.setItem("wr:typeFilter", JSON.stringify(next));
    } catch {
      // sessionStorage unavailable — the filter still applies this session.
    }
  }, []);

  // Apply the type filter after mount, from a `?types=` deeplink if there is
  // one and the persisted selection otherwise. Deferred a tick (setTimeout 0,
  // same pattern as the cluster restore below) so the first client render matches
  // the server's default ("all shown") before any selection is applied.
  //
  // The URL wins over sessionStorage on purpose: `?types=` is an explicit
  // request from outside the app (the landing page's category grid links one
  // URL per category), and silently overriding it with a stale tab-local filter
  // would make those links look broken.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let restored: VendorType[] | null = null;
    try {
      const fromUrl = parseTypeList(
        new URLSearchParams(window.location.search).get("types"),
      );
      if (fromUrl) {
        restored = fromUrl;
      } else {
        const raw = sessionStorage.getItem("wr:typeFilter");
        if (raw) restored = parseTypeList(JSON.parse(raw) as unknown);
      }
    } catch {
      // malformed payload — fall back to showing all
    }
    if (!restored) return;
    const next = restored;
    const t = setTimeout(() => {
      setSelectedTypes(next);
      // Persist it like a tapped chip, so it survives the round trip to a
      // vendor page — which returns via ?restore=1 and drops the query string.
      try {
        sessionStorage.setItem("wr:typeFilter", JSON.stringify(next));
      } catch {
        // sessionStorage unavailable — the filter still applies this session.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // On a restore mount, reopen whichever preview was showing — the cluster
  // sheet, the on-screen results list, or a single pin's card — from its saved
  // payload. The setState is deferred a tick (setTimeout 0) — the documented
  // pattern for updating state from an effect without tripping
  // set-state-in-effect, and it also lands the portal post-hydration so it never
  // diffs against server HTML.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("restore")) return;
    let restoredCluster: { ids: string[]; vendorType: VendorType } | null = null;
    let restoredPin: { id: string; vendorType: VendorType } | null = null;
    try {
      const raw = sessionStorage.getItem("wr:cluster");
      if (raw) {
        const d = JSON.parse(raw) as { ids?: string[]; vendorType?: VendorType };
        if (d.ids?.length && d.vendorType) {
          restoredCluster = { ids: d.ids, vendorType: d.vendorType };
        }
      }
      const rawPin = sessionStorage.getItem("wr:pin");
      if (rawPin) {
        const d = JSON.parse(rawPin) as { id?: string; vendorType?: VendorType };
        if (d.id && d.vendorType) {
          restoredPin = { id: d.id, vendorType: d.vendorType };
        }
      }
    } catch {
      // ignore a malformed payload — the user just lands on the map
    }
    if (!restoredCluster && !restoredPin) {
      // Nothing to reopen — still drop the marker so a later in-page navigation
      // doesn't re-trigger a restore.
      window.history.replaceState(null, "", "/explore");
      return;
    }
    const t = setTimeout(() => {
      if (restoredCluster) setCluster(restoredCluster);
      else setPin(restoredPin);
      // Consumed together with the restore, NOT before it: in development React
      // mounts twice, and the first pass's cleanup cancels this timeout. Dropping
      // the marker up front would leave the second pass with nothing to restore.
      window.history.replaceState(null, "", "/explore");
    }, 0);
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

  // Tapping a vendor flies the map straight to its pin (rather than opening the
  // vendor page) — the vendor is centered on the map, ready to tap. Zoom 15 is
  // close enough that a single pin reads clearly.
  function selectVendor(v: VendorSuggestion) {
    suppressFetchRef.current = true; // don't reopen the dropdown on the query change
    setCityQuery(v.name);
    setFlyTo({ lng: v.lng, lat: v.lat, zoom: 15 });
    setSuggestions([]);
    setVendorResults([]);
    setShowSuggestions(false);
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
    <div className="relative flex min-h-[60vh] flex-1 flex-col">
      {/* Warm the basemap connection early (hoisted to <head> by React). */}
      <link rel="preconnect" href={MAP_TILE_ORIGIN} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={MAP_TILE_ORIGIN} />

      {/* Full-bleed map behind everything. Kept MOUNTED in list view rather
          than unmounted: MapLibre re-initialising costs a style load and a full
          refetch, and the map would lose its centre and zoom, so switching back
          would dump the couple somewhere else. `invisible` also stops it
          painting while hidden. */}
      <div className={cn("absolute inset-0", view === "list" && "invisible")}>
        <VendorMap
          flyToPosition={flyTo}
          userPosition={userPosition}
          onClusterOpen={openCluster}
          onVendorOpen={openPin}
          onBackgroundTap={closePin}
          selectedVendorId={pin?.id ?? null}
          onViewChange={saveMapView}
          initialView={initialView}
          selectedTypes={selectedTypes}
          filterSelections={filterSelections}
          onVisibleVendorsChange={setVisible}
          onVendorsChange={setMapVendors}
        />
      </div>

      {/* Everything over the map lives in ONE absolutely-positioned flex
          column. That is what gives the list a bounded height: `absolute
          inset-0` makes this box exactly as tall as the page container, so a
          `flex-1 min-h-0` child resolves against a DEFINITE height and scrolls
          internally.

          In normal flow it could not. The chain up to <main> is sized by
          min-height (min-h-dvh) with no definite height anywhere, so a tall
          feed grew every ancestor instead of scrolling — 875 results rendered a
          12,324px-tall list that simply ran off the page (Kiara, 2026-08-05).
          Clipping the container did not help, because the growth is in the
          ancestors, not the overflow.

          Click-through by default so the map stays pannable; each control opts
          back in with pointer-events-auto. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">

      {/* Cluster list feed (portals to <body>; opens on a cluster tap) */}
      {cluster && (
        <ClusterListSheet
          ids={cluster.ids}
          vendorType={cluster.vendorType}
          onClose={() => setCluster(null)}
        />
      )}

      {/* Everything on screen, as one feed (portals to <body>; opens on the
          results pill). Same sheet as the cluster feed, but mixed-type. */}

      {/* Brand mark, search bar, account control. The mark is the route back to
          the landing page: it used to be a wordmark pill in the bottom-left
          corner, which read as decoration rather than a control (Kiara,
          2026-08-04). Top-left next to the search bar is where a logo is
          expected to be clickable. LANDING_HREF, not "/", or the first-visit
          gate bounces the visitor straight back here.

          Click-through row, controls opt back in — same rule as every other
          overlay here. The row must NOT take pointer events as a whole: it is a
          full-width band across the top of the map, and the gaps between the
          three controls are map the couple can still pan. */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[520px] items-start gap-2 px-3 pt-3">
        <Link
          href={LANDING_HREF}
          aria-label="About Wedding Recon"
          className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full border bg-background/95 shadow-md backdrop-blur-sm transition-opacity hover:opacity-80"
        >
          <BrandMark className="size-5" />
        </Link>
        <div className="pointer-events-auto flex-1 rounded-xl bg-background/95 shadow-md backdrop-blur-sm">
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

        <ProfileMenu className="pointer-events-auto shrink-0" />
      </div>

      {/* One control row: what to show, how many there are, and which view.
          The count is deliberately NOT a button — it used to be a
          "see all N results on screen" pill doing double duty as both the count
          and the only way into the list, which the view toggle now states far
          more plainly (Kiara, 2026-08-05).

          Click-through except for the controls themselves, so it cannot steal a
          pin tap from the map underneath. */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[520px] shrink-0 items-center gap-2 px-3 pt-2">
        <FilterButton
          selectedTypes={selectedTypes}
          activeCount={activeFilterCount}
          onClick={() => setFilterSheetOpen(true)}
          className="pointer-events-auto max-w-[42%] [&>span]:truncate"
        />
        <span className="flex-1" aria-hidden />
        {/* The count sits ON the map, so it needs its own surface. A text
            shadow was not enough: the basemap runs from near-white fields to
            mid-grey urban blocks and dark green parks, so no single text colour
            stays legible across it. A chip matching the neighbouring controls
            fixes the contrast and makes the row read as one set. */}
        <span
          // aria-live so a screen reader hears the count settle after a pan.
          aria-live="polite"
          className="min-w-0 shrink truncate rounded-full border border-border bg-background/95 px-2.5 py-1 text-center text-[13px] font-medium shadow-sm backdrop-blur"
        >
          {visible.total === 1 ? "1 result" : `${visible.total} results`}
        </span>
        <span className="flex-1" aria-hidden />
        <ViewToggle
          view={view}
          onChange={setView}
          className="pointer-events-auto"
        />
      </div>

      {/* List view. In normal FLOW after the control row, not absolutely
          positioned over it: an absolute overlay had to guess a top inset to
          clear the header, that guess was wrong, and the first card slid under
          the controls. As a flex child it simply takes the space that is left,
          so it cannot overlap whatever sits above it. */}
      {view === "list" && (
        <div className="pointer-events-auto relative z-[5] flex min-h-0 flex-1 flex-col bg-background">
          <VendorFeed
            entries={visible.entries}
            scrollKey="wr:screenScroll"
            className="flex-1"
            footnote={
              visible.entries.length < visible.total
                ? `Showing the ${visible.entries.length} nearest of ${visible.total}. Zoom in to narrow the list.`
                : undefined
            }
          />
        </div>
      )}

      {filterSheetOpen && (
        <VendorFilterSheet
          selectedTypes={selectedTypes}
          onSelectedTypesChange={updateSelectedTypes}
          vendors={mapVendors}
          visibleTotal={visible.total}
          visiblePartial={visible.partial}
          states={filterStates}
          dateContexts={dateContexts}
          onChangeType={(t, next) =>
            setFilterStates((prev) => ({ ...prev, [t]: next }))
          }
          onDateContextChange={(t, next) =>
            setDateContexts((prev) => ({ ...prev, [t]: next }))
          }
          onClearAll={() => {
            setFilterStates({});
            setDateContexts({});
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}


      {/* Bottom stack over the map: the single-pin peek card (Zillow-style) sits
          on top of the control row, so the brand mark and locate button stay
          reachable beneath it rather than being pushed above the card. In the
          flow, so it sits above the bottom nav and pushes nothing around.

          Hidden in list view: these are map controls (a locate button and the
          basemap-anchored brand mark), and a pin peek describes a pin nobody
          can see. */}
      <div
        className={cn(
          "pointer-events-none relative z-10 mt-auto",
          view === "list" && "hidden",
        )}
      >
        {pin && (
          <div className="pointer-events-auto mx-auto w-full max-w-[480px] px-3">
            <VendorPinPreview
              vendorId={pin.id}
              vendorType={pin.vendorType}
              onClose={closePin}
            />
          </div>
        )}

        {/* Locate button, lifted clear of the map attribution along the bottom
            edge. The brand pill that used to sit opposite it moved to the top
            bar, so this row is just the one control now.

            The row stays click-through and only the button takes taps, which
            also settles the long-standing complaint that this full-width row
            ate every map tap in its ~90px band — a pin sitting down there could
            not be tapped at all. */}
        <div className="flex items-end justify-end px-3 pb-9 pt-3">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            aria-label="Center map on my location"
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:text-foreground"
          >
            {locating ? (
              <Loader2 size={20} className="animate-spin" aria-hidden />
            ) : (
              <Navigation size={20} aria-hidden />
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
