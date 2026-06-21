"use client";

import { useState } from "react";
import { Search, LocateFixed, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VendorMap } from "@/components/map/vendor-map";
import { useGeolocation } from "@/components/map/use-geolocation";
import { cn } from "@/lib/utils";

export default function ExplorePage() {
  const [cityQuery, setCityQuery] = useState("");
  const { position, loading: geoLoading, requestLocation } = useGeolocation();

  const handleCitySearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: geocode `cityQuery` via a future geocoding API and fly the map there.
    // For now, we at least have the input value ready.
    console.log("[Explore] city search stub:", cityQuery);
  };

  return (
    <div className="relative flex flex-1 flex-col min-h-[60vh]">
      {/* Full-bleed map behind everything */}
      <div className="absolute inset-0">
        <VendorMap flyToPosition={position} />
      </div>

      {/* Search bar overlay — top of screen */}
      <div className="relative z-10 px-3 pt-3">
        <form
          onSubmit={handleCitySearch}
          className="flex items-center gap-2 rounded-xl bg-background/95 shadow-md backdrop-blur-sm px-3 py-2"
        >
          <Search
            size={16}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search city or neighborhood…"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            className={cn(
              "h-7 border-0 bg-transparent px-0 text-sm shadow-none",
              "focus-visible:ring-0 focus-visible:border-0",
            )}
            aria-label="Search city"
          />
          {cityQuery.length > 0 && (
            <Button
              type="submit"
              size="xs"
              variant="default"
              aria-label="Search"
            >
              Go
            </Button>
          )}
        </form>
      </div>

      {/* Use my location button — bottom-left above bottom nav */}
      <div className="relative z-10 mt-auto pb-3 pl-3">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Use my location"
          onClick={requestLocation}
          disabled={geoLoading}
          className="size-10 rounded-full bg-background/95 shadow-md backdrop-blur-sm"
        >
          {geoLoading ? (
            <Loader2 size={18} className="animate-spin text-primary" />
          ) : (
            <LocateFixed size={18} className="text-primary" />
          )}
        </Button>
      </div>
    </div>
  );
}
