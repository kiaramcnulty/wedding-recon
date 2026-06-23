"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VendorMap } from "@/components/map/vendor-map";
import { cn } from "@/lib/utils";

interface GeocodeSuggestion {
  name: string;
  lat: number;
  lng: number;
}

export default function ExplorePage() {
  const [cityQuery, setCityQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null);
  const [searching, setSearching] = useState(false);
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

  return (
    <div className="relative flex flex-1 flex-col min-h-[60vh]">
      {/* Full-bleed map behind everything */}
      <div className="absolute inset-0">
        <VendorMap flyToPosition={flyTo} />
      </div>

      {/* Search bar + autocomplete dropdown */}
      <div className="relative z-10 px-3 pt-3">
        <div className="rounded-xl bg-background/95 shadow-md backdrop-blur-sm">
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-2 px-3 py-2"
          >
            <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search city or neighborhood…"
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
      </div>

    </div>
  );
}
