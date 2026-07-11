"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VendorMap } from "@/components/map/vendor-map";
import { BrandLockup } from "@/components/brand-lockup";
import { ProfileMenu } from "@/components/profile-menu";
import { cn } from "@/lib/utils";

interface GeocodeSuggestion {
  name: string;
  lat: number;
  lng: number;
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
  const [cityQuery, setCityQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressFetchRef = useRef(false);

  // Debounced autocomplete — always goes through setTimeout to avoid
  // calling setState synchronously in the effect body.
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
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: GeocodeSuggestion[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        // network error — silently ignore
      }
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
    setShowSuggestions(false);
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = cityQuery.trim();
    if (!q) return;

    // Use first suggestion if dropdown is already populated.
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
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
        <VendorMap flyToPosition={flyTo} userPosition={userPosition} />
      </div>

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
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
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

          {showSuggestions && suggestions.length > 0 && (
            <ul role="listbox" className="border-t border-border pb-1">
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
          )}
        </div>

        <ProfileMenu className="shrink-0" />
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
