"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, Loader2, MapPin, Navigation, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  VendorMap,
  type ClusterEntry,
  type ClusterOpenPayload,
  type VendorOpenPayload,
} from "@/components/map/vendor-map";
import { ClusterListSheet } from "@/components/map/cluster-list-sheet";
import { VendorFeed, ViewToggle } from "@/components/map/vendor-feed";
import { VendorPinPreview } from "@/components/map/vendor-pin-preview";
import { VerifiedBadge } from "@/components/vendor/verified-badge";
import { FilterChips, type MatchCount } from "@/components/explore/filter-chips";
import { useGuidedCandidates } from "@/components/search/use-guided-candidates";
import {
  ALL_VENDOR_TYPES,
  CATEGORIES,
  CATEGORY_PLURAL,
  VENDOR_TYPES,
  type VendorType,
} from "@/lib/constants/categories";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ProfileMenu } from "@/components/profile-menu";
import { LANDING_HREF } from "@/lib/landing/nav";
import {
  EXPLORE_RADIUS_KEY as RADIUS_KEY,
  MAP_VIEW_KEY,
  readExploreAnchor,
  writeExploreAnchor,
  type ExploreAnchor,
} from "@/lib/map/map-view";
import { zoomToFitRing } from "@/lib/map/ring";
import {
  guidedSelection,
  maxRadius,
  milesBetween,
  runGuidedSearch,
  type GuidedPrefs,
  type GuidedType,
  type RadiusSetting,
} from "@/lib/search/guided";
import { loadJourney } from "@/lib/search/journey-state";
import { useJourneySnapshot, writeGuestCount, writeTypePrefs } from "@/lib/search/wedding-place";
import { cn } from "@/lib/utils";

/**
 * Explore: ONE vendor type at a time, searched within a radius of one place.
 *
 * The search is the guided journey's own (`runGuidedSearch` in
 * lib/search/guided.ts), so the map, the list, the journey's results and the
 * "Show N matches" counts in the filter sheets all come from the same ranked
 * set: vendors of the type within the radius of the anchor, full matches
 * first, then partial ones. The map pins only that set, inside a ring.
 *
 * - The anchor is where the journey says the wedding is, a town picked in the
 *   search bar, the couple's location, or a spot picked with "Search this
 *   area". Panning or zooming never moves it (Milestone 5, step 6).
 * - The radius walks the type's automatic ladder unless the couple picks a
 *   distance; a manual distance holds until "Back to automatic" or a new
 *   anchor.
 * - The filters are the journey's answers for the type (`byType[type]`), so a
 *   budget set here is the journey's budget too (Kiara, 2026-11-07). Guest
 *   count is shared the same way; with none, prices convert at 100 guests.
 *
 * Decided 2026-11-07: radius search, a chip per filter, one shared set of
 * answers. docs/customer-journey-implementation-plan.md, Milestone 5.
 */

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
  /** Vendor Verification badge; resolved server-side by /api/vendor-search. */
  verified: boolean;
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

/** Denver, the soft-launch market: the anchor when nothing else names one. */
const DEFAULT_ANCHOR: ExploreAnchor = { lat: 39.7392, lng: -104.9903, label: "Denver" };

/** The type to open on when nothing else names one: last used, else Venue. */
const LAST_TYPE_KEY = "wr:lastType";
const TYPE_KEY = "wr:typeFilter";


/**
 * The first selectable type a raw value names. Takes a `?types=venue,flowers`
 * deeplink (legacy multi-type links open on their first valid type), the old
 * array payload of `wr:typeFilter`, or a single type string.
 */
function firstType(raw: unknown): GuidedType | null {
  const values =
    typeof raw === "string" ? raw.split(",").map((v) => v.trim()) : Array.isArray(raw) ? raw : [];
  const hit = values.find(
    (t): t is GuidedType => typeof t === "string" && (VENDOR_TYPES as readonly string[]).includes(t),
  );
  return hit ?? null;
}

/**
 * A stored value: parsed JSON, or the raw string when it is not JSON (plain
 * values like a type or "list" are stored as-is, by this page and by the
 * older one before it).
 */
function readJson(storage: Storage, key: string): unknown {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // Storage unavailable: it still works for this page, it just is not remembered.
  }
}

/** A stored distance, kept inside the type's slider (5 to the top of its ladder). */
function parseRadius(raw: unknown, type: GuidedType): RadiusSetting {
  const r = raw as { mode?: string; miles?: unknown } | null;
  if (r?.mode === "manual" && typeof r.miles === "number" && Number.isFinite(r.miles)) {
    return { mode: "manual", miles: Math.min(Math.max(5, Math.round(r.miles / 5) * 5), maxRadius(type)) };
  }
  return { mode: "auto" };
}

/**
 * Normalize a raw `vendor_type` string (which may be legacy or unknown) to a
 * known category. The peek card looks its type up in CATEGORIES with no
 * fallback, so a search suggestion's untyped `vendorType` has to land on a real
 * key — legacy `music` has a CATEGORIES entry, anything else falls to "other".
 */
function toVendorType(raw: string): VendorType {
  return (ALL_VENDOR_TYPES as readonly string[]).includes(raw)
    ? (raw as VendorType)
    : "other";
}

/** The camera that frames the ring on this screen (the app column, under the controls). */
function ringView(anchor: { lat: number; lng: number }, miles: number) {
  const w = typeof window === "undefined" ? 390 : Math.min(window.innerWidth, 480);
  const h = typeof window === "undefined" ? 600 : window.innerHeight - 260;
  return { lng: anchor.lng, lat: anchor.lat, zoom: zoomToFitRing(anchor.lat, miles, w, h) };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ExplorePage() {
  const [cityQuery, setCityQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [vendorResults, setVendorResults] = useState<VendorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // The open cluster list (null = closed). Opened on a cluster tap, or restored
  // when returning from a vendor page (?restore=1).
  const [cluster, setCluster] = useState<{
    entries: ClusterEntry[];
    vendorType: VendorType;
  } | null>(null);
  // The single vendor whose peek card is open (null = closed). Opened on a pin
  // tap, restored on return from the vendor page (?restore=1) like the cluster.
  const [pin, setPin] = useState<{ id: string; vendorType: VendorType } | null>(null);
  // Map or list. The map stays MOUNTED underneath the list, so toggling never
  // re-inits MapLibre or refetches. Applied from storage after mount so the
  // first client render matches the server's "map".
  const [view, setView] = useState<"map" | "list">("map");

  // The search: one type, one anchor, one radius setting. Null until read
  // after mount (storage, the URL and the journey are client-only), so the
  // first client render matches the server's.
  const [type, setType] = useState<GuidedType | null>(null);
  const [anchor, setAnchor] = useState<ExploreAnchor | null>(null);
  const [radius, setRadius] = useState<RadiusSetting>({ mode: "auto" });
  // Where the camera is now, for "Search this area".
  const [cameraCenter, setCameraCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Frame the ring once the search for a new anchor lands, at the radius it
  // actually used (the automatic ladder may have widened past 25 miles).
  const frameNextResult = useRef(false);

  const journey = useJourneySnapshot();
  const prefs = useMemo<GuidedPrefs>(() => (type && journey?.byType[type]) || {}, [journey, type]);
  const guestCount = journey?.guestCount;
  const weddingMonth = journey?.weddingMonth;

  // Restore the last map view whenever Explore mounts — returning from a vendor
  // by any route. With none (a fresh tab), frame the ring around the anchor the
  // page is about to search, so the first thing on screen is the search area.
  // Read once, imperatively, by the map at init: no hydration concern.
  const [initialView] = useState<{ lng: number; lat: number; zoom: number } | null>(() => {
    if (typeof window === "undefined") return null;
    const d = readJson(sessionStorage, MAP_VIEW_KEY) as { center?: [number, number]; zoom?: number } | null;
    if (d?.center && typeof d.zoom === "number") return { lng: d.center[0], lat: d.center[1], zoom: d.zoom };
    const j = loadJourney();
    const a = readExploreAnchor() ?? (j?.location ? { lat: j.location.lat, lng: j.location.lng } : DEFAULT_ANCHOR);
    return ringView(a, 25);
  });

  // Mount: the type (a `?types=` deeplink first, then this tab, then the last
  // type used, then the journey's, then Venue), the anchor and the radius.
  // Deferred a tick so the state is not set synchronously in the effect body.
  useEffect(() => {
    const t = setTimeout(() => {
      const fromUrl = firstType(new URLSearchParams(window.location.search).get("types"));
      const j = loadJourney();
      const nextType =
        fromUrl ??
        firstType(readJson(sessionStorage, TYPE_KEY)) ??
        firstType(readJson(localStorage, LAST_TYPE_KEY)) ??
        j?.selectedVendorType ??
        "venue";
      const nextAnchor =
        readExploreAnchor() ??
        (j?.location ? { lat: j.location.lat, lng: j.location.lng, label: j.location.label } : DEFAULT_ANCHOR);
      setType(nextType);
      setAnchor(nextAnchor);
      // A fresh tab (no remembered camera): frame the search area.
      if (!readJson(sessionStorage, MAP_VIEW_KEY)) frameNextResult.current = true;
      setRadius(parseRadius(readJson(sessionStorage, RADIUS_KEY), nextType));
      write(sessionStorage, TYPE_KEY, nextType);
      write(localStorage, LAST_TYPE_KEY, nextType);
      // The pre-single-type filter payload: superseded by the shared answers.
      try {
        sessionStorage.removeItem("wr:vendorFilters");
      } catch {
        // nothing to clear
      }
      if (readJson(sessionStorage, "wr:view") === "list") setView("list");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const changeType = useCallback((t: GuidedType) => {
    setType(t);
    write(sessionStorage, TYPE_KEY, t);
    write(localStorage, LAST_TYPE_KEY, t);
    // A fixed-location type's ladder stops at 50 miles; keep a manual pick inside it.
    setRadius((r) => {
      const next = r.mode === "manual" && r.miles > maxRadius(t) ? { mode: "manual" as const, miles: maxRadius(t) } : r;
      write(sessionStorage, RADIUS_KEY, next);
      return next;
    });
    setPin(null);
    setCluster(null);
  }, []);

  const changeRadius = useCallback((r: RadiusSetting) => {
    setRadius(r);
    write(sessionStorage, RADIUS_KEY, r);
  }, []);

  // A new anchor: search around it on the automatic ladder, and frame its ring.
  const moveAnchor = useCallback(
    (next: ExploreAnchor, frame = true) => {
      setAnchor(next);
      writeExploreAnchor(next);
      changeRadius({ mode: "auto" });
      if (frame) frameNextResult.current = true;
      setPin(null);
      setCluster(null);
    },
    [changeRadius],
  );

  const changePrefs = useCallback(
    (p: GuidedPrefs) => {
      if (type) writeTypePrefs(type, p);
    },
    [type],
  );

  // ---- the search ----
  const anchorPoint = useMemo(() => (anchor ? { lat: anchor.lat, lng: anchor.lng } : null), [anchor]);
  const { state: candidates, retry } = useGuidedCandidates(type, anchorPoint);

  const selection = useMemo(
    () => (type ? guidedSelection(type, prefs, { guestCount, weddingMonth, assumeGuests: true }) : {}),
    [type, prefs, guestCount, weddingMonth],
  );
  const selections = useMemo(() => (type ? { [type]: selection } : {}), [type, selection]);

  const result = useMemo(() => {
    if (!type || !anchorPoint || candidates.status !== "ready") return null;
    return runGuidedSearch(candidates.rows, type, selection, anchorPoint, radius);
  }, [type, anchorPoint, candidates, selection, radius]);

  // What a filter sheet's draft would give, for its "Show N matches" button.
  const countFor = useCallback(
    (draft: GuidedPrefs, guests: number | undefined): MatchCount => {
      if (!type || !anchorPoint || candidates.status !== "ready") return null;
      const sel = guidedSelection(type, draft, { guestCount: guests, weddingMonth, assumeGuests: true });
      const r = runGuidedSearch(candidates.rows, type, sel, anchorPoint, radius);
      return { confirmed: r.confirmedCount, partial: r.partialCount };
    },
    [type, anchorPoint, candidates, weddingMonth, radius],
  );

  useEffect(() => {
    if (!frameNextResult.current || !result || !anchorPoint) return;
    const t = setTimeout(() => {
      frameNextResult.current = false;
      setFlyTo(ringView(anchorPoint, result.radiusMiles));
    }, 0);
    return () => clearTimeout(t);
  }, [result, anchorPoint]);

  const results = useMemo(
    () => (result ? new Map(result.ranked.map((r) => [r.id, r.rank])) : new Map<string, 0 | 1>()),
    [result],
  );
  const ring = useMemo(
    () => (anchorPoint && result ? { ...anchorPoint, miles: result.radiusMiles } : null),
    [anchorPoint, result],
  );
  const selectedTypes = useMemo(() => (type ? [type] : []), [type]);
  const feedEntries = useMemo(
    () => (result && type ? result.ranked.map((r) => ({ id: r.id, vendorType: type, rank: r.rank })) : []),
    [result, type],
  );

  // "Search this area": offered once the camera has moved well off the anchor.
  const offerSearchHere =
    !!anchorPoint &&
    !!cameraCenter &&
    !!result &&
    milesBetween(anchorPoint, cameraCenter) > Math.max(2, result.radiusMiles * 0.25);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressFetchRef = useRef(false);

  // Persist the tapped cluster's identity so it can be reopened on return
  // (?restore=1), then open the list. The map view is persisted separately by
  // saveMapView, so it isn't duplicated here.
  const openCluster = useCallback((payload: ClusterOpenPayload) => {
    try {
      sessionStorage.setItem(
        "wr:cluster",
        JSON.stringify({ entries: payload.entries, vendorType: payload.vendorType }),
      );
      // Fresh cluster → open at the top (drop any saved feed scroll position).
      sessionStorage.removeItem("wr:clusterScroll");
      // The map previews are mutually exclusive; only one can be restored.
      sessionStorage.removeItem("wr:pin");
    } catch {
      // sessionStorage unavailable — the sheet still opens; only reopen-on-back is lost.
    }
    setPin(null);
    setCluster({ entries: payload.entries, vendorType: payload.vendorType });
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

  // Persist the map view on every settled move, so returning to Explore
  // restores the same view (see initialView), and note the camera centre for
  // "Search this area".
  const saveMapView = useCallback((v: { center: [number, number]; zoom: number }) => {
    write(sessionStorage, MAP_VIEW_KEY, v);
    setCameraCenter({ lng: v.center[0], lat: v.center[1] });
  }, []);

  const updateView = useCallback((next: "map" | "list") => {
    setView(next);
    write(sessionStorage, "wr:view", next);
  }, []);

  // On a restore mount, reopen whichever preview was showing — the cluster
  // sheet or a single pin's card — from its saved payload. Deferred a tick so
  // the portal lands post-hydration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("restore")) return;
    let restoredCluster: { entries: ClusterEntry[]; vendorType: VendorType } | null = null;
    let restoredPin: { id: string; vendorType: VendorType } | null = null;
    try {
      const raw = sessionStorage.getItem("wr:cluster");
      if (raw) {
        const d = JSON.parse(raw) as { entries?: ClusterEntry[]; vendorType?: VendorType };
        if (d.entries?.length && d.vendorType) restoredCluster = { entries: d.entries, vendorType: d.vendorType };
      }
      const rawPin = sessionStorage.getItem("wr:pin");
      if (rawPin) {
        const d = JSON.parse(rawPin) as { id?: string; vendorType?: VendorType };
        if (d.id && d.vendorType) restoredPin = { id: d.id, vendorType: d.vendorType };
      }
    } catch {
      // ignore a malformed payload — the user just lands on the map
    }
    if (!restoredCluster && !restoredPin) {
      window.history.replaceState(null, "", "/explore");
      return;
    }
    const t = setTimeout(() => {
      if (restoredCluster) setCluster(restoredCluster);
      else setPin(restoredPin);
      // Consumed together with the restore, not before it: in development React
      // mounts twice, and the first pass's cleanup cancels this timeout.
      window.history.replaceState(null, "", "/explore");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Debounced autocomplete. Areas (geocode) and vendors (our directory, every
  // type) are fetched in parallel and shown as two groups.
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

  function clearSearchBox() {
    suppressFetchRef.current = true;
    setCityQuery("");
    setSuggestions([]);
    setVendorResults([]);
    setShowSuggestions(false);
  }

  // An area: it becomes the place the search is around.
  function selectSuggestion(s: GeocodeSuggestion) {
    clearSearchBox();
    moveAnchor({ lat: s.lat, lng: s.lng, label: s.name.split(",")[0] });
  }

  // A vendor (any type): fly to its pin and open its card, the same card a pin
  // tap opens. The search itself does not move.
  function selectVendor(v: VendorSuggestion) {
    clearSearchBox();
    setFlyTo({ lng: v.lng, lat: v.lat, zoom: 15 });
    openPin({ id: v.vendorId, vendorType: toVendorType(v.vendorType) });
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q) return;
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
      return;
    }
    if (vendorResults.length > 0) {
      selectVendor(vendorResults[0]);
      return;
    }
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
        moveAnchor({ lat, lng, label: "your location" });
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED ? deniedMessage : "Couldn't get your location. Try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  // "Hair & makeup artists near Denver" does not fit a phone's search bar.
  const plural = type ? (type === "beauty" ? CATEGORIES.beauty.label : capitalize(CATEGORY_PLURAL[type])) : "Vendors";
  const placeholder = anchor
    ? anchor.label
      ? `${plural} near ${anchor.label}`
      : `${plural} in this area`
    : "Search city or vendor…";

  const countText = result
    ? result.confirmedCount === 0 && result.partialCount === 0
      ? `None within ${result.radiusMiles} mi`
      : `${result.confirmedCount} ${result.confirmedCount === 1 ? "match" : "matches"}${
          result.partialCount ? ` · ${result.partialCount} partial` : ""
        }`
    : null;
  const expandedNote =
    result && result.expanded ? `Expanded to ${result.radiusMiles} miles for more matches.` : null;
  const travelNote =
    result && result.radiusMiles > 50 ? "Vendors past 50 miles may charge travel fees." : null;
  const incomplete = candidates.status === "ready" && !candidates.complete;

  return (
    <div className="relative flex min-h-[60vh] flex-1 flex-col">
      {/* Warm the basemap connection early (hoisted to <head> by React). */}
      <link rel="preconnect" href={MAP_TILE_ORIGIN} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={MAP_TILE_ORIGIN} />

      {/* Full-bleed map behind everything, kept mounted in list view. */}
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
          results={results}
          ring={ring}
        />
      </div>

      {/* Everything over the map lives in ONE absolutely-positioned flex column,
          click-through by default so the map stays pannable; each control opts
          back in with pointer-events-auto (a whole row never does: its gaps are
          map). */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        {cluster && (
          <ClusterListSheet
            entries={cluster.entries}
            vendorType={cluster.vendorType}
            selections={selections}
            onClose={() => setCluster(null)}
          />
        )}

        {/* Brand mark, search bar, account control. */}
        <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[520px] items-start gap-2 px-3 pt-3">
          <Link
            href={LANDING_HREF}
            aria-label="About Wedding Recon"
            className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full border bg-background/95 shadow-md backdrop-blur-sm transition-opacity hover:opacity-80"
          >
            <BrandMark className="size-5" />
          </Link>
          {/* min-w-0 is load-bearing: without it the longest suggestion row
              becomes the box's minimum width and pushes the profile icon off a
              390px screen. */}
          <div className="pointer-events-auto min-w-0 flex-1 rounded-xl bg-background/95 shadow-md backdrop-blur-sm">
            <form onSubmit={handleSearch} className="flex items-center gap-2 px-3 py-2">
              <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                // The search in effect reads as the resting text ("Venues near
                // Vail"); typing searches towns and vendor names of every type.
                placeholder={searchFocused ? "Search a town or vendor name…" : placeholder}
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                onFocus={() => {
                  setSearchFocused(true);
                  if (suggestions.length > 0 || vendorResults.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setSearchFocused(false);
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                className={cn(
                  "h-7 border-0 bg-transparent px-0 text-sm shadow-none",
                  "focus-visible:ring-0 focus-visible:border-0",
                  !searchFocused && "placeholder:font-medium placeholder:text-foreground",
                )}
                aria-label="Search a town or vendor name"
                aria-autocomplete="list"
                autoComplete="off"
              />
              {cityQuery.length > 0 && (
                <Button type="submit" size="xs" variant="default" aria-label="Search" disabled={searching}>
                  {searching ? <Loader2 size={12} className="animate-spin" /> : "Go"}
                </Button>
              )}
            </form>

            {showSuggestions && (vendorResults.length > 0 || suggestions.length > 0) && (
              <div className="border-t border-border py-1">
                {vendorResults.length > 0 && (
                  <>
                    {suggestions.length > 0 && (
                      <div className="px-3 pt-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Vendors
                      </div>
                    )}
                    <ul role="listbox" aria-label="Vendors">
                      {vendorResults.map((v) => {
                        const cat = CATEGORIES[v.vendorType as VendorType] ?? CATEGORIES.other;
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
                              <Icon size={13} style={{ color: cat.colorHex }} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1">
                                <span className="min-w-0 truncate font-medium">{v.name}</span>
                                {v.verified && <VerifiedBadge iconOnly />}
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
                          <MapPin size={13} className="shrink-0 text-muted-foreground" />
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

        {/* The type's filters, distance, More, and the Map / List toggle. */}
        {type && (
          <div className="pointer-events-none relative z-10 mx-auto w-full max-w-[520px] shrink-0 px-3 pt-2">
            <FilterChips
              type={type}
              prefs={prefs}
              guestCount={guestCount}
              radius={radius}
              radiusMiles={result?.radiusMiles ?? (radius.mode === "manual" ? radius.miles : 25)}
              maxMiles={maxRadius(type)}
              onType={changeType}
              onPrefs={changePrefs}
              onGuests={writeGuestCount}
              onRadius={changeRadius}
              countFor={countFor}
            />
            {/* The count and any notice: on the map, so each sits on its own
                surface to stay legible over any basemap colour. */}
            <div className="mt-2 flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              {candidates.status === "error" ? (
                <button
                  type="button"
                  onClick={retry}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full border bg-background/95 px-2.5 py-1 text-[13px] font-medium shadow-sm"
                >
                  <RotateCw className="size-3.5" aria-hidden /> Couldn&apos;t load vendors. Try again
                </button>
              ) : countText ? (
                <span
                  aria-live="polite"
                  className="rounded-full border bg-background/95 px-2.5 py-1 text-[13px] font-medium shadow-sm backdrop-blur"
                >
                  {countText}
                  {incomplete && "+"}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border bg-background/95 px-2.5 py-1 text-[13px] text-muted-foreground shadow-sm">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Finding vendors…
                </span>
              )}
              {(expandedNote || travelNote) && (
                <span className="max-w-full rounded-lg bg-background/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
                  {[expandedNote, travelNote].filter(Boolean).join(" ")}
                </span>
              )}
            </div>
            <ViewToggle view={view} onChange={updateView} className="pointer-events-auto shrink-0" />
            </div>
          </div>
        )}

        {/* "Search this area": moves the anchor to where the camera is, on the
            automatic ladder. Panning alone never changes the results. */}
        {offerSearchHere && view === "map" && cameraCenter && (
          <div className="pointer-events-none relative z-10 mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => moveAnchor({ ...cameraCenter, label: null }, false)}
              className="pointer-events-auto rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-md"
            >
              Search this area
            </button>
          </div>
        )}

        {/* List view: the same ranked set the map pins. */}
        {view === "list" && (
          <div className="pointer-events-auto relative z-[5] mt-2 flex min-h-0 flex-1 flex-col bg-background">
            <VendorFeed
              entries={feedEntries}
              scrollKey="wr:screenScroll"
              showCategoryPill={false}
              selections={selections}
              pending={!result && candidates.status !== "error"}
              className="flex-1"
              emptyText="Nothing within this distance yet. Try a wider distance or fewer filters."
              footnote={incomplete ? "There may be more vendors than shown here." : undefined}
            />
          </div>
        )}

        {/* Bottom stack over the map: the pin peek card, or the locate button. */}
        <div className={cn("pointer-events-none relative z-10 mt-auto", view === "list" && "hidden")}>
          {pin ? (
            <div className="pointer-events-auto mx-auto w-full max-w-[480px] px-3 pb-9 pt-3">
              <VendorPinPreview
                vendorId={pin.id}
                vendorType={pin.vendorType}
                selection={pin.vendorType === type ? selection : undefined}
                onClose={closePin}
              />
            </div>
          ) : (
            <div className="flex items-end justify-end px-3 pb-9 pt-3">
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                aria-label="Search around my location"
                className="pointer-events-auto flex size-11 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:text-foreground"
              >
                {locating ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Navigation size={20} aria-hidden />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
